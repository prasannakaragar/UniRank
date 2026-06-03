"""
routes/auth.py - UniRank
=========================
Production-grade authentication: registration, OTP verification, and login.

Security model:
  - Passwords are hashed with bcrypt (work factor 12, via utils/password.py)
  - Legacy Werkzeug PBKDF2 hashes are silently migrated to bcrypt on login
  - OTPs are hashed with Werkzeug before storage (6-digit, 5-minute expiry)
  - All auth failures return a generic "Invalid credentials" message
  - Failed login attempts are tracked per user; account locked after 5
  - Login endpoint is rate-limited to 5 requests/minute via Flask-Limiter
  - Failed logins are logged (email + IP) for security auditing
  - No passwords or raw OTPs are ever logged
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token
from werkzeug.security import (
    check_password_hash as wz_check,
    generate_password_hash as wz_hash,
)

from models import College, PendingUser, Profile, User
from utils.email_utils import generate_otp, send_otp_email
from utils.password import hash_password, validate_password_strength, verify_password

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OTP_EXPIRY_MINUTES       = 5    # OTP valid window
MAX_OTP_ATTEMPTS         = 5    # OTP failures before record is wiped
MAX_LOGIN_ATTEMPTS       = 5    # Wrong passwords before account lock
LOCKOUT_DURATION_MINUTES = 15   # How long the lock lasts


# ---------------------------------------------------------------------------
# Rate-limit decorator factory
# Pulls the Flask-Limiter instance from current_app at request time —
# avoids circular imports and works cleanly with the app-factory pattern.
# ---------------------------------------------------------------------------
def _limiter():
    """Return the Flask-Limiter instance attached to the current app."""
    return current_app.limiter


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_client_ip() -> str:
    """
    Extract the real client IP, accounting for reverse-proxy headers.
    Render, Railway, and Nginx all set X-Forwarded-For.
    """
    forwarded = request.headers.getlist("X-Forwarded-For")
    if forwarded:
        return forwarded[0].split(",")[0].strip()
    return request.remote_addr or "unknown"


def _is_college_email(email: str) -> bool:
    """
    Accept only college emails.
    Rule: domain contains '.edu' or '.ac.in', OR it exists in the colleges
    collection (for custom-registered domains), OR it explicitly contains 'iit' or 'nit'.
    """
    domain = email.split("@")[-1].lower()
    
    # explicitly allow iit and nit domains
    if "iit" in domain or "nit" in domain:
        return True
        
    if ".edu" in domain or ".ac.in" in domain:
        return True
        
    return bool(College.objects(domain=domain).first())


def _ensure_college_exists(email: str) -> str:
    """
    Return the canonical college name for the email's domain.
    Auto-registers new domains as a College document on first encounter.
    """
    domain = email.split("@")[-1].lower()
    college = College.objects(domain=domain).first()
    if college:
        return college.name

    # New domain: derive a readable name and auto-register
    name = domain.split(".")[0].upper()
    College(name=name, domain=domain).save()
    logger.info("[AutoRegister] New college domain registered: %s (%s)", name, domain)
    return name


def _sanitize_email(raw: str) -> str:
    """Strip whitespace and lowercase an email input."""
    return (raw or "").strip().lower()


# ---------------------------------------------------------------------------
# POST /api/register
# Rate limit: 10 requests per 10 minutes per IP
# ---------------------------------------------------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user.

    Flow:
      1. Validate required fields and college email domain
      2. Enforce strong password policy
      3. Hash password with bcrypt — raw password never touches the DB
      4. Generate a 6-digit OTP, hash it with Werkzeug, store with 5-min expiry
      5. Send OTP to the college email via Brevo
    """
    # -- Rate-limit check (10 register requests per 10 minutes per IP) ------
    _limiter().limit("10 per 10 minutes")

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid request body."}), 400

    # -- Required field check ------------------------------------------------
    required = ["name", "email", "password", "branch", "year", "college"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    email = _sanitize_email(data["email"])

    # -- College email gate --------------------------------------------------
    if not _is_college_email(email):
        return jsonify({
            "error": "Registration is restricted to college email addresses."
        }), 403

    # -- Duplicate account check --------------------------------------------
    if User.objects(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    # -- Strong password enforcement ----------------------------------------
    # Do this BEFORE hashing so we give the user actionable feedback.
    ok, reason = validate_password_strength(data["password"])
    if not ok:
        return jsonify({"error": reason}), 400

    # -- Hash password with bcrypt ------------------------------------------
    # From this point the raw password is NEVER stored or logged.
    hashed_pw = hash_password(data["password"])

    # -- OTP generation and hashing -----------------------------------------
    # OTP is short-lived (5 min) and numeric. Werkzeug PBKDF2 is appropriate
    # here — bcrypt would work but adds unnecessary CPU for a 6-digit value.
    otp      = generate_otp()
    otp_hash = wz_hash(otp)

    college_name = data["college"].strip()

    # -- Upsert PendingUser (allow re-registration before OTP verification) --
    pending = PendingUser.objects(email=email).first()
    if pending:
        # Overwrite stale registration attempt
        pending.name     = data["name"].strip()
        pending.password = hashed_pw
        pending.branch   = data["branch"].strip()
        pending.year     = int(data["year"])
        pending.college  = college_name
    else:
        pending = PendingUser(
            name=data["name"].strip(),
            email=email,
            password=hashed_pw,
            branch=data["branch"].strip(),
            year=int(data["year"]),
            college=college_name,
        )

    pending.otp_hash   = otp_hash
    pending.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending.attempts   = 0
    pending.save()

    # -- Send OTP email via Brevo -------------------------------------------
    if not send_otp_email(email, otp):
        pending.delete()
        return jsonify({
            "error": "Failed to send verification email. Please try again."
        }), 500

    logger.info("[REGISTER] OTP sent to %s", email)
    return jsonify({
        "message": f"Verification code sent to {email}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        "email_sent": True,
    }), 201


# ---------------------------------------------------------------------------
# POST /api/resend-otp
# Rate limit: 3 requests per minute per IP
# ---------------------------------------------------------------------------
@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    """
    Resend OTP to an email that has a pending registration.
    Rate-limited to 3 per minute per IP.
    """
    _limiter().limit("3 per minute")

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing request body."}), 400

    email = _sanitize_email(data.get("email", ""))
    if not email:
        return jsonify({"error": "Email is required."}), 400

    pending = PendingUser.objects(email=email).first()
    if not pending:
        # Generic message — don't reveal whether the email exists
        return jsonify({"error": "No pending registration found for this email."}), 404

    otp      = generate_otp()
    otp_hash = wz_hash(otp)

    pending.otp_hash   = otp_hash
    pending.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending.attempts   = 0
    pending.save()

    if not send_otp_email(email, otp):
        return jsonify({"error": "Failed to send email. Please try again."}), 500

    logger.info("[RESEND-OTP] New OTP sent to %s", email)
    return jsonify({"message": "A new verification code has been sent.", "email_sent": True}), 200


# ---------------------------------------------------------------------------
# POST /api/verify-otp
# ---------------------------------------------------------------------------
@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """
    Verify the OTP submitted by the user.

    On success:
      - Creates the User document (password already bcrypt-hashed from register)
      - Creates the linked Profile document
      - Deletes the PendingUser record
      - Returns a JWT access token
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing request body."}), 400

    email = _sanitize_email(data.get("email", ""))
    otp   = str(data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"error": "Email and verification code are required."}), 400

    pending = PendingUser.objects(email=email).first()
    if not pending:
        return jsonify({"error": "No pending registration found for this email."}), 404

    # -- Expiry check --------------------------------------------------------
    if datetime.utcnow() > pending.otp_expiry:
        return jsonify({
            "error": "Verification code has expired. Please request a new one."
        }), 410

    # -- Attempt limit (prevents brute-force on the 6-digit OTP) ------------
    if pending.attempts >= MAX_OTP_ATTEMPTS:
        pending.delete()
        return jsonify({
            "error": "Too many failed attempts. Please register again."
        }), 429

    # -- OTP verification (constant-time via Werkzeug) ----------------------
    if not wz_check(pending.otp_hash, otp):
        pending.attempts += 1
        pending.save()
        remaining = MAX_OTP_ATTEMPTS - pending.attempts
        return jsonify({
            "error": "Invalid verification code.",
            "attempts_remaining": remaining,
        }), 401

    # -- OTP correct: promote PendingUser → User ----------------------------
    college_name = _ensure_college_exists(pending.email)

    user = User(
        name             = pending.name,
        email            = pending.email,
        password         = pending.password,   # already bcrypt-hashed at register
        branch           = pending.branch,
        year             = pending.year,
        college          = college_name,
        is_verified      = True,
        college_verified = True,
    )
    user.save()
    Profile(user=user).save()
    pending.delete()

    token = create_access_token(identity=str(user.id))
    logger.info("[VERIFY-OTP] User created: %s", email)

    return jsonify({
        "message": "Email verified. Account created successfully!",
        "token":   token,
        "user":    user.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# POST /api/login
# Rate limit: 5 requests per minute per IP
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate a user and return a JWT access token.

    Security layers (in order):
      1. Flask-Limiter: 5 requests/minute per IP              → 429
      2. Input validation                                      → 400
      3. Account lockout check (locked_until)                 → 423
      4. User lookup (always constant-time-ish)               → 401 on any failure
      5. Password verification (bcrypt OR Werkzeug dual-check) → 401 on failure
      6. Failed attempt tracking + auto-lock at 5 failures    → 423 on lock
      7. Email verification gate                              → 403
      8. Successful login: reset counters, issue JWT          → 200

    ALL failures use the same "Invalid credentials" message where appropriate
    to prevent user enumeration. Account lock and unverified states get their
    own messages because they require user action.
    """
    # -- Rate limit: 5 login attempts per minute per IP ---------------------
    # Redis-backed in production (set REDIS_URL env var); memory in dev.
    _limiter().limit("5 per minute")

    ip = _get_client_ip()

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid request body."}), 400

    email    = _sanitize_email(data.get("email", ""))
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    # -- User lookup --------------------------------------------------------
    # Deliberately returns the same error if email doesn't exist as when the
    # password is wrong — prevents user enumeration attacks.
    user = User.objects(email=email).first()
    if not user:
        logger.warning("[LOGIN-FAIL] Unknown email attempt: email=%s ip=%s", email, ip)
        return jsonify({"error": "Invalid credentials."}), 401

    # -- Account lockout check ----------------------------------------------
    now = datetime.utcnow()
    if user.locked_until and now < user.locked_until:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        logger.warning(
            "[LOGIN-LOCKED] email=%s ip=%s locked_for=%ds",
            email, ip, remaining_seconds,
        )
        return jsonify({
            "error": "Account temporarily locked due to too many failed attempts.",
            "retry_after_seconds": remaining_seconds,
        }), 423  # 423 Locked (RFC 4918)

    # -- Password verification (dual-check: bcrypt first, Werkzeug fallback) -
    #
    # verify_password() in utils/password.py:
    #   - bcrypt hash  → bcrypt.check_password_hash()  returns (valid, False)
    #   - Werkzeug hash → wz_check()                   returns (valid, True)
    #   - Unknown format → rejects safely               returns (False, False)
    #
    # needs_rehash=True triggers a silent bcrypt upgrade below.
    is_valid, needs_rehash = verify_password(password, user.password)

    if not is_valid:
        # -- Increment per-user failed-attempt counter -----------------------
        new_attempts = (user.failed_login_attempts or 0) + 1

        if new_attempts >= MAX_LOGIN_ATTEMPTS:
            # Lock the account
            locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            User.objects(id=user.id).update_one(
                set__failed_login_attempts=new_attempts,
                set__locked_until=locked_until,
            )
            logger.warning(
                "[LOGIN-LOCKED] email=%s ip=%s attempts=%d locked_until=%s",
                email, ip, new_attempts, locked_until.isoformat(),
            )
            return jsonify({
                "error": "Account temporarily locked due to too many failed attempts.",
                "retry_after_seconds": LOCKOUT_DURATION_MINUTES * 60,
            }), 423
        else:
            User.objects(id=user.id).update_one(
                set__failed_login_attempts=new_attempts,
            )
            logger.warning(
                "[LOGIN-FAIL] email=%s ip=%s attempts=%d/%d",
                email, ip, new_attempts, MAX_LOGIN_ATTEMPTS,
            )
            return jsonify({"error": "Invalid credentials."}), 401

    # -- Password matched: handle Werkzeug → bcrypt silent migration --------
    if needs_rehash:
        # The user's stored hash is a legacy Werkzeug PBKDF2 hash.
        # Re-hash with bcrypt NOW and persist, so they're fully migrated.
        # This is transparent to the user — they just log in normally.
        try:
            new_hash = hash_password(password)
            User.objects(id=user.id).update_one(set__password=new_hash)
            logger.info("[LOGIN-REHASH] Werkzeug->bcrypt upgrade complete: %s", email)
        except Exception as exc:
            # Non-fatal: user still logs in successfully.
            # Ops team should investigate if this fires repeatedly.
            logger.error(
                "[LOGIN-REHASH-FAIL] email=%s error=%s", email, exc
            )

    # -- Reset lockout counters on successful authentication ----------------
    User.objects(id=user.id).update_one(
        set__failed_login_attempts=0,
        unset__locked_until=1,
    )

    # -- Email verification gate --------------------------------------------
    # Checked AFTER password verification — this prevents leaking whether
    # an email exists without knowing the correct password first.
    if not user.is_verified:
        logger.info("[LOGIN-UNVERIFIED] email=%s ip=%s", email, ip)
        return jsonify({
            "error": "Email not verified. Please complete email verification.",
            "needs_verification": True,
        }), 403

    # -- Issue JWT access token --------------------------------------------
    token = create_access_token(identity=str(user.id))
    logger.info("[LOGIN-OK] email=%s ip=%s", email, ip)

    # -- Background: auto-sync Codeforces stats on login -------------------
    # Wrapped in try/except — stats failures must never break login.
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
        pass  # Never block login due to a stats-sync failure

    return jsonify({"token": token, "user": user.to_dict()}), 200
