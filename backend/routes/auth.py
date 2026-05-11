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
from models import db, User, Profile, PendingUser
from utils.email_utils import generate_otp, send_otp_email
from utils.rate_limiter import rate_limit

auth_bp = Blueprint("auth", __name__)

COLLEGE_DOMAIN = os.getenv("COLLEGE_EMAIL_DOMAIN", "reva.edu.in")
OTP_EXPIRY_MINUTES = 5


# ── Signup ────────────────────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=600)
def register():
    """
    POST /api/register
    Body: { name, email, password, branch, year }
    Creates an unverified user and sends an OTP to their email via Mailgun.
    """
    data = request.get_json()
    required = ["name", "email", "password", "branch", "year"]

    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required"}), 400

    email = data["email"].strip().lower()

    # Check duplicate
    if User.objects(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    # Generate and hash OTP
    otp = generate_otp()
    otp_hash = generate_password_hash(otp)

    # Upsert into PendingUser
    pending_user = PendingUser.objects(email=email).first()
    if not pending_user:
        pending_user = PendingUser(
            name=data["name"].strip(),
            email=email,
            password=generate_password_hash(data["password"]),
            branch=data["branch"].strip(),
            year=int(data["year"])
        )
    else:
        pending_user.name = data["name"].strip()
        pending_user.password = generate_password_hash(data["password"])
        pending_user.branch = data["branch"].strip()
        pending_user.year = int(data["year"])

    pending_user.otp_hash = otp_hash
    pending_user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending_user.attempts = 0
    pending_user.save()

    # Send OTP email via Gmail SMTP
    email_sent = send_otp_email(email, otp)
    
    if not email_sent:
        # If email failed to send, delete the pending user so they can try again
        pending_user.delete()
        return jsonify({"error": "Failed to send OTP email. Please check backend configuration or try again later."}), 500

    return jsonify({
        "message": "Registration initiated. Please verify your email with the OTP sent.",
        "email_sent": email_sent,
    }), 201


# ── Resend OTP ────────────────────────────────────────────────────────────────
@auth_bp.route("/resend-otp", methods=["POST"])
@rate_limit(max_requests=3, window_seconds=300)
def resend_otp():
    """
    POST /api/resend-otp
    Body: { email }
    Generates a fresh OTP and emails it via Mailgun. Rate-limited to 3 per 5 min.
    """
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()

    if User.objects(email=email).first():
        return jsonify({"message": "Email is already verified"}), 200

    pending_user = PendingUser.objects(email=email).first()
    if not pending_user:
        # Also check for legacy unverified users in main DB
        user = User.objects(email=email, is_verified=False).first()
        if user:
            otp = generate_otp()
            user.otp_hash = generate_password_hash(otp)
            user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
            user.save()
            email_sent = send_otp_email(email, otp)
            if not email_sent:
                return jsonify({"error": "Failed to send OTP email. Please try again later."}), 500
            
            return jsonify({
                "message": "A new OTP has been sent to your email.",
                "email_sent": email_sent,
            }), 200
        return jsonify({"error": "No pending registration found with this email"}), 404

    otp = generate_otp()
    pending_user.otp_hash = generate_password_hash(otp)
    pending_user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending_user.attempts = 0
    pending_user.save()

    email_sent = send_otp_email(email, otp)
    
    if not email_sent:
        return jsonify({"error": "Failed to send OTP email. Please try again later."}), 500

    return jsonify({
        "message": "A new OTP has been sent to your email.",
        "email_sent": email_sent,
    }), 200


# ── Verify OTP ────────────────────────────────────────────────────────────────
@auth_bp.route("/verify-otp", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=300)
def verify_otp():
    """
    POST /api/verify-otp
    Body: { email, otp }
    Verifies the OTP and sets is_verified + college_verified flags.
    """
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    otp = (data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    if User.objects(email=email, is_verified=True).first():
        return jsonify({"message": "Email is already verified"}), 200

    pending_user = PendingUser.objects(email=email).first()
    user = None
    
    if pending_user:
        if pending_user.attempts >= 5:
            pending_user.delete()
            return jsonify({"error": "Too many failed attempts. Please register again."}), 429
            
        if not pending_user.otp_expiry or datetime.utcnow() > pending_user.otp_expiry:
            return jsonify({"error": "OTP has expired. Please request a new one."}), 410
            
        if not pending_user.otp_hash or not check_password_hash(pending_user.otp_hash, otp):
            pending_user.attempts += 1
            pending_user.save()
            return jsonify({"error": "Invalid OTP"}), 401
            
        domain = email.split("@")[-1]
        college_verified = (domain == COLLEGE_DOMAIN)
        
        user = User(
            name=pending_user.name,
            email=pending_user.email,
            password=pending_user.password,
            branch=pending_user.branch,
            year=pending_user.year,
            is_verified=True,
            college_verified=college_verified
        )
        user.save()
        Profile(user=user).save()
        pending_user.delete()
        
    else:
        # Check legacy unverified users
        user = User.objects(email=email, is_verified=False).first()
        if not user:
            return jsonify({"error": "No pending registration found with this email"}), 404
            
        if not user.otp_expiry or datetime.utcnow() > user.otp_expiry:
            return jsonify({"error": "OTP has expired. Please request a new one."}), 410
            
        if user.attempts >= 5:
            user.delete()
            return jsonify({"error": "Too many failed attempts. Please register again."}), 429

        if not user.otp_hash or not check_password_hash(user.otp_hash, otp):
            user.attempts += 1
            user.save()
            return jsonify({"error": "Invalid OTP"}), 401
            
        user.is_verified = True
        domain = email.split("@")[-1]
        user.college_verified = (domain == COLLEGE_DOMAIN)
        user.otp_hash = None
        user.otp_expiry = None
        user.save()

    response = {
        "message": "Email verified successfully!",
        "is_verified": True,
        "college_verified": user.college_verified,
    }

    if user.college_verified:
        token = create_access_token(identity=str(user.id))
        response["token"] = token
        response["user"] = user.to_dict()
    else:
        response["warning"] = (
            f"Your email domain '{email.split('@')[-1]}' is not recognised as a college domain. "
            f"Only @{COLLEGE_DOMAIN} emails get full access. "
            "Your account has been flagged for manual verification."
        )

    return jsonify(response), 200


# ── Login ─────────────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
@rate_limit(max_requests=15, window_seconds=300)
def login():
    """
    POST /api/login
    Body: { email, password }
    Returns JWT token only if the user is verified AND college-verified.
    """
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.objects(email=email).first()
    if not user:
        if PendingUser.objects(email=email).first():
            return jsonify({
                "error": "Email not verified. Please check your inbox for the OTP or register again.",
                "needs_verification": True,
            }), 403
        return jsonify({"error": "Invalid email or password"}), 401

    if not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Enforce email verification
    if not user.is_verified:
        return jsonify({
            "error": "Email not verified. Please verify your email first.",
            "needs_verification": True,
        }), 403

    # Enforce college domain verification
    if not user.college_verified:
        return jsonify({
            "error": (
                f"Your email domain is not recognised. "
                f"Only @{COLLEGE_DOMAIN} emails are allowed full access. "
                "Please contact admin for manual verification."
            ),
            "college_verified": False,
        }), 403

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
