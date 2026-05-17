"""
routes/auth.py
Registration, email verification (OTP via Mailgun), and password-based login.
College email domain is validated after OTP verification.
"""
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Profile, PendingUser, College
from utils.email_utils import generate_otp, send_otp_email
from utils.rate_limiter import rate_limit

auth_bp = Blueprint("auth", __name__)

OTP_EXPIRY_MINUTES = 5


def is_college_email(email):
    """
    Checks if an email belongs to a college.
    Rule: Must contain '.edu' OR match a domain in our 'colleges' collection.
    """
    domain = email.split("@")[-1].lower()
    if ".edu" in domain or ".ac.in" in domain:
        return True
    # Check if domain exists in the colleges collection
    if College.objects(domain=domain).first():
        return True
    return False


def get_college_name(domain):
    """Detect college name from domain."""
    college = College.objects(domain=domain).first()
    if college:
        return college.name
    # Fallback: capitalize the first part of domain (e.g. rvce.edu.in -> Rvce)
    parts = domain.split(".")
    return parts[0].capitalize() if parts else "Unknown"


# ── Signup ────────────────────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=600)
def register():
    """
    POST /api/register
    Body: { name, email, password, branch, year }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    required = ["name", "email", "password", "branch", "year", "college"]

    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required"}), 400

    email = data["email"].strip().lower()

    # 1. College Email Validation
    if not is_college_email(email):
        return jsonify({
            "error": "Only college emails (.edu) are allowed for registration."
        }), 403

    # Check duplicate
    if User.objects(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    # Generate and hash OTP
    otp = generate_otp()
    otp_hash = generate_password_hash(otp)

    college_name = data["college"].strip()

    # Upsert into PendingUser
    pending_user = PendingUser.objects(email=email).first()
    if not pending_user:
        pending_user = PendingUser(
            name=data["name"].strip(),
            email=email,
            password=generate_password_hash(data["password"]),
            branch=data["branch"].strip(),
            year=int(data["year"]),
            college=college_name
        )
    else:
        pending_user.name = data["name"].strip()
        pending_user.password = generate_password_hash(data["password"])
        pending_user.branch = data["branch"].strip()
        pending_user.year = int(data["year"])
        pending_user.college = college_name

    pending_user.otp_hash = otp_hash
    pending_user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending_user.attempts = 0
    pending_user.save()

    # Send OTP email
    email_sent = send_otp_email(email, otp)
    
    if not email_sent:
        pending_user.delete()
        return jsonify({"error": "Failed to send OTP email. Please try again later."}), 500

    return jsonify({
        "message": f"OTP sent to {email}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        "email_sent": True,
    }), 201


# ── Resend OTP ────────────────────────────────────────────────────────────────
@auth_bp.route("/resend-otp", methods=["POST"])
@rate_limit(max_requests=3, window_seconds=600)
def resend_otp():
    """
    POST /api/resend-otp
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    email = (data.get("email") or "").strip().lower()

    pending_user = PendingUser.objects(email=email).first()
    if not pending_user:
        return jsonify({"error": "No pending registration found"}), 404

    otp = generate_otp()
    pending_user.otp_hash = generate_password_hash(otp)
    pending_user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending_user.attempts = 0
    pending_user.save()

    email_sent = send_otp_email(email, otp)
    if not email_sent:
        return jsonify({"error": "Failed to send email"}), 500

    return jsonify({"message": "A new OTP has been sent.", "email_sent": True}), 200


# ── Verify OTP ────────────────────────────────────────────────────────────────
@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """
    POST /api/verify-otp
    Body: { email, otp }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    email = (data.get("email") or "").strip().lower()
    otp = (data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    pending_user = PendingUser.objects(email=email).first()
    if not pending_user:
        return jsonify({"error": "No pending registration found"}), 404

    # Security: OTP Expiry
    if datetime.utcnow() > pending_user.otp_expiry:
        return jsonify({"error": "OTP has expired. Please request a new one."}), 410

    # Security: Max attempts
    if pending_user.attempts >= 5:
        pending_user.delete()
        return jsonify({"error": "Too many failed attempts. Please register again."}), 429

    # Verify OTP
    if not check_password_hash(pending_user.otp_hash, otp):
        pending_user.attempts += 1
        pending_user.save()
        return jsonify({"error": "Invalid OTP"}), 401

    # Success: Create the user
    user = User(
        name=pending_user.name,
        email=pending_user.email,
        password=pending_user.password,
        branch=pending_user.branch,
        year=pending_user.year,
        college=pending_user.college,
        is_verified=True,
        college_verified=True # Any college email verified via OTP is trusted
    )
    user.save()
    Profile(user=user).save()
    pending_user.delete()

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Email verified and account created!",
        "token": token,
        "user": user.to_dict()
    }), 200


# ── Login ─────────────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
@rate_limit(max_requests=15, window_seconds=300)
def login():
    """
    POST /api/login
    Body: { email, password }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.objects(email=email).first()
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_verified:
        return jsonify({"error": "Email not verified.", "needs_verification": True}), 403

    token = create_access_token(identity=str(user.id))

    # Auto-sync CP stats on login
    try:
        profile = Profile.objects(user=user).first()
        if profile and profile.cf_handle:
            from utils.codeforces import sync_user_stats
            from utils.scoring import update_user_scores

            stats = sync_user_stats(profile.cf_handle)
            profile.cf_rating          = stats.get("cf_rating", 0)
            profile.cf_max_rating      = stats.get("cf_max_rating", 0)
            profile.cf_rank            = stats.get("cf_rank", "unrated")
            profile.cf_problems_solved = stats.get("cf_problems_solved", 0)
            profile.avatar_url         = stats.get("avatar_url")
            profile.last_synced        = datetime.utcnow()
            profile.save()
            update_user_scores(str(user.id))
    except Exception:
        pass  # Don't block login if sync fails

    return jsonify({"token": token, "user": user.to_dict()}), 200
