"""
utils/password.py - UniRank
============================
Central module for all password security logic.

Responsibilities:
  - Hashing new passwords with bcrypt (work factor 12)
  - Verifying passwords against bcrypt OR legacy Werkzeug PBKDF2 hashes
  - Transparently reporting when a hash needs upgrading (for login rehash)
  - Enforcing strong password policy at registration time
  - Detecting hash formats without leaking information

This module is the SINGLE source of truth for password operations.
Nothing outside this module should call bcrypt or werkzeug directly.
"""

import re
import logging
from typing import Tuple, Optional

from flask_bcrypt import Bcrypt
from werkzeug.security import check_password_hash as _wz_check

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bcrypt instance
# Lazily initialized — call init_app(app) from create_app() to bind it.
# ---------------------------------------------------------------------------
bcrypt = Bcrypt()


# ---------------------------------------------------------------------------
# Hash-format detectors
# These are intentionally strict so an unknown format is handled gracefully
# rather than silently falling through to an insecure comparison.
# ---------------------------------------------------------------------------

def _is_bcrypt_hash(stored: str) -> bool:
    """
    Return True if `stored` is a bcrypt hash.

    Bcrypt hashes always:
      - Start with '$2b$', '$2a$', or '$2y$'
      - Are exactly 60 characters long
    """
    if not stored or len(stored) != 60:
        return False
    return stored.startswith(("$2b$", "$2a$", "$2y$"))


def _is_werkzeug_hash(stored: str) -> bool:
    """
    Return True if `stored` is a Werkzeug-generated hash.

    Werkzeug prefixes (all versions):
      - 'pbkdf2:sha256:'  modern default (Werkzeug 2.x)
      - 'pbkdf2:sha1:'    legacy
      - 'scrypt:'         Werkzeug 2.1+ scrypt variant
      - 'sha1$'           very old Werkzeug format
    """
    if not stored:
        return False
    return stored.startswith((
        "pbkdf2:sha256:",
        "pbkdf2:sha1:",
        "scrypt:",
        "sha1$",
    ))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """
    Hash a plain-text password using bcrypt (work factor from app config,
    defaults to 12).

    Returns the 60-character bcrypt hash string.
    NEVER call this with an already-hashed value.
    """
    # generate_password_hash returns bytes; decode to str for MongoEngine.
    return bcrypt.generate_password_hash(plain).decode("utf-8")


def verify_password(plain: str, stored: str) -> Tuple[bool, bool]:
    """
    Verify `plain` against `stored` hash using constant-time comparison.

    Implements the dual-check migration strategy:
      1. If stored is a bcrypt hash   → verify with bcrypt (fast path, new users)
      2. If stored is a Werkzeug hash → verify with Werkzeug, flag for rehash
      3. Unknown / corrupted format   → return (False, False) safely

    Returns:
        (is_valid: bool, needs_rehash: bool)

        needs_rehash=True signals the caller to immediately re-hash `plain`
        with bcrypt and persist it — completing the silent migration.

    Security:
        - Both bcrypt and Werkzeug use constant-time comparison internally.
        - We NEVER fall back to plain string comparison.
        - Unknown formats are rejected, not guessed.
    """
    if not plain or not stored:
        return False, False

    # -- Fast path: already a bcrypt hash ------------------------------------
    if _is_bcrypt_hash(stored):
        try:
            return bcrypt.check_password_hash(stored, plain), False
        except Exception:
            # Corrupted hash — treat as invalid, log for ops visibility.
            logger.warning("bcrypt.check_password_hash raised an exception; hash may be corrupted.")
            return False, False

    # -- Migration path: legacy Werkzeug hash --------------------------------
    if _is_werkzeug_hash(stored):
        try:
            valid = _wz_check(stored, plain)
            # needs_rehash=True → caller must upgrade to bcrypt immediately
            return valid, True
        except Exception:
            logger.warning("werkzeug.check_password_hash raised an exception; hash may be corrupted.")
            return False, False

    # -- Unknown / corrupted format ------------------------------------------
    # Do NOT attempt plain-text comparison — that would be a security hole.
    logger.error(
        "verify_password: unrecognised password format (len=%d, prefix=%r). "
        "Returning invalid to prevent security bypass.",
        len(stored), stored[:12] if stored else ""
    )
    return False, False


def validate_password_strength(plain: str) -> Tuple[bool, Optional[str]]:
    """
    Enforce a strong password policy.

    Rules:
      - At least 8 characters
      - At least 1 uppercase letter  (A-Z)
      - At least 1 lowercase letter  (a-z)
      - At least 1 digit             (0-9)
      - At least 1 special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)

    Returns:
        (ok: bool, reason: str | None)
        reason is None when ok=True.
    """
    if not plain:
        return False, "Password is required."

    if len(plain) < 8:
        return False, "Password must be at least 8 characters long."

    if not re.search(r"[A-Z]", plain):
        return False, "Password must contain at least one uppercase letter."

    if not re.search(r"[a-z]", plain):
        return False, "Password must contain at least one lowercase letter."

    if not re.search(r"\d", plain):
        return False, "Password must contain at least one number."

    if not re.search(r"[!@#$%^&*()\-_=+\[\]{}|;':\",./<>?`~\\]", plain):
        return False, "Password must contain at least one special character."

    return True, None
