# -*- coding: utf-8 -*-
"""
migrate_passwords.py - UniRank
==============================
One-time migration script to migrate all passwords in the `users`
(and `pending_users`) collections to bcrypt hashes.

Currently the app stores Werkzeug PBKDF2-SHA256 hashes (format:
"pbkdf2:sha256:...").  This script converts those to bcrypt hashes
AND also handles any remaining plain-text passwords.

SAFE TO RUN MULTIPLE TIMES — already-bcrypt-hashed passwords are
detected and skipped automatically (idempotent).

Background
----------
The auth routes use werkzeug.security.check_password_hash for login.
After running this script, the login route MUST be updated to use
flask_bcrypt.Bcrypt.check_password_hash instead.  See auth.py.

Usage
-----
    # From the backend/ directory, with the venv activated:
    .\\venv\\Scripts\\python.exe migrate_passwords.py

    # Dry-run (inspect only - no writes):
    .\\venv\\Scripts\\python.exe migrate_passwords.py --dry-run

Requirements
------------
    flask-bcrypt already added to requirements.txt
    Install: .\\venv\\Scripts\\pip.exe install flask-bcrypt==1.0.1
"""

import sys
import os
import argparse
from datetime import datetime

# -- Load environment variables from .env ------------------------------------
from dotenv import load_dotenv
load_dotenv()

# -- Bootstrap the Flask app (needed for MongoEngine context) ----------------
from app import create_app
app = create_app()

# -- Import Flask-Bcrypt -----------------------------------------------------
from flask_bcrypt import Bcrypt
bcrypt = Bcrypt(app)

# -- Import Werkzeug security (to verify existing Werkzeug hashes) -----------
from werkzeug.security import check_password_hash as werkzeug_check

# -- Import models -----------------------------------------------------------
from models import User, PendingUser


# ---------------------------------------------------------------------------
# Helper 1: Detect a bcrypt hash
#
# Bcrypt hashes always start with "$2b$", "$2a$", or "$2y$"
# and are exactly 60 characters long.
# ---------------------------------------------------------------------------
def is_bcrypt_hash(password: str) -> bool:
    """
    Return True if `password` is already a bcrypt hash.

    A valid bcrypt hash:
      - Starts with '$2b$', '$2a$', or '$2y$'
      - Is exactly 60 characters long
    """
    if not password:
        return False
    return (
        len(password) == 60
        and password.startswith(("$2b$", "$2a$", "$2y$"))
    )


# ---------------------------------------------------------------------------
# Helper 2: Detect a Werkzeug PBKDF2 hash
#
# Werkzeug's generate_password_hash() produces strings in the format:
#   "pbkdf2:sha256:<iterations>$<salt>$<hash>"
# or the older format:
#   "sha1$<salt>$<hash>"
# ---------------------------------------------------------------------------
def is_werkzeug_hash(password: str) -> bool:
    """
    Return True if `password` looks like a Werkzeug-generated hash.

    Werkzeug hash prefixes:
      - 'pbkdf2:sha256:'  (modern, default since Werkzeug 2.x)
      - 'pbkdf2:sha1:'    (legacy)
      - 'sha1$'           (very old format)
      - 'scrypt:'         (Werkzeug 2.1+)
    """
    if not password:
        return False
    return password.startswith((
        "pbkdf2:sha256:",
        "pbkdf2:sha1:",
        "sha1$",
        "scrypt:",
    ))


# ---------------------------------------------------------------------------
# Core migration function — works for User and PendingUser collections.
#
# Strategy:
#   1. If already bcrypt  → skip (idempotent)
#   2. If Werkzeug hash   → we cannot reverse it, so we CANNOT re-hash it
#                           without knowing the original password.
#                           Mark as [CANNOT_MIGRATE] and explain.
#   3. Plain text         → hash with bcrypt and save
# ---------------------------------------------------------------------------
def migrate_collection(document_class, label: str, dry_run: bool) -> dict:
    """
    Iterate over every document in `document_class`, detect password format,
    and migrate plain-text passwords to bcrypt.

    Returns a summary dict: total, skipped_bcrypt, skipped_werkzeug,
                            migrated, errors, plain_text_found.
    """
    summary = {
        "total": 0,
        "skipped_bcrypt": 0,
        "skipped_werkzeug": 0,
        "migrated": 0,
        "errors": 0,
        "plain_text_found": 0,
    }

    print(f"\n{'='*62}")
    print(f"  Migrating collection : {label}")
    print(f"  Dry-run mode         : {dry_run}")
    print(f"{'='*62}")

    users = document_class.objects()
    summary["total"] = users.count()
    print(f"  Found {summary['total']} document(s) to inspect.\n")

    for user in users:
        email = getattr(user, "email", "<unknown>")
        raw_password = user.password

        # -- Skip if password field is empty / None -------------------------
        if not raw_password:
            print(f"  [SKIP-EMPTY]       {email}  — password field is empty")
            summary["skipped_bcrypt"] += 1
            continue

        # -- Already bcrypt: nothing to do ----------------------------------
        if is_bcrypt_hash(raw_password):
            print(f"  [SKIP-BCRYPT]      {email}  — already a bcrypt hash")
            summary["skipped_bcrypt"] += 1
            continue

        # -- Werkzeug hash: cannot reverse-engineer the plain text ----------
        # These were stored by werkzeug.security.generate_password_hash().
        # Since hashing is one-way, we cannot convert them to bcrypt without
        # the original password.  They are safe (PBKDF2-SHA256), but not
        # bcrypt.  We report them so you are aware.
        if is_werkzeug_hash(raw_password):
            print(
                f"  [SKIP-WERKZEUG]    {email}  — Werkzeug PBKDF2 hash "
                f"(cannot re-hash without original password)"
            )
            summary["skipped_werkzeug"] += 1
            continue

        # -- Plain-text password detected: hash it with bcrypt --------------
        summary["plain_text_found"] += 1

        # bcrypt has a hard 72-byte limit; truncate if necessary.
        # This matches industry convention — the first 72 bytes of a password
        # are cryptographically significant for bcrypt.
        plain_bytes = raw_password.encode("utf-8")
        if len(plain_bytes) > 72:
            print(
                f"  [WARN-TRUNCATE]    {email}  — password > 72 bytes "
                f"({len(plain_bytes)}), will be truncated to 72 bytes for bcrypt"
            )
            plain_bytes = plain_bytes[:72]

        try:
            # generate_password_hash returns bytes; decode to str for
            # MongoEngine's StringField (max_length=256 handles 60-char bcrypt).
            hashed = bcrypt.generate_password_hash(plain_bytes).decode("utf-8")
        except Exception as exc:
            print(f"  [ERROR]            {email}  — hashing failed: {exc}")
            summary["errors"] += 1
            continue

        # -- Persist (or simulate in dry-run) --------------------------------
        if dry_run:
            print(f"  [DRY-RUN-MIGRATE]  {email}  — would hash plain-text password")
            summary["migrated"] += 1
        else:
            try:
                # Atomic field-level update — safe even under concurrent writes.
                document_class.objects(id=user.id).update_one(
                    set__password=hashed
                )
                print(f"  [MIGRATED]         {email}  — plain-text -> bcrypt")
                summary["migrated"] += 1
            except Exception as exc:
                print(f"  [ERROR]            {email}  — DB save failed: {exc}")
                summary["errors"] += 1

    return summary


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description=(
            "Migrate UniRank DB passwords to bcrypt.\n"
            "Werkzeug PBKDF2 hashes are skipped (cannot reverse).\n"
            "Plain-text passwords are hashed with bcrypt."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without writing to the database.",
    )
    args = parser.parse_args()

    dry_run = args.dry_run
    started_at = datetime.utcnow()

    print("\n" + "#" * 62)
    print("  UniRank - Password Migration Script")
    print(f"  Started at : {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  [!] DRY-RUN mode - NO changes will be written to the DB")
    print("#" * 62)

    # Run inside the Flask application context so MongoEngine can connect.
    with app.app_context():

        # Migrate main users collection
        users_summary = migrate_collection(User, "users", dry_run)

        # Migrate pending_users (passwords stored before OTP verification)
        pending_summary = migrate_collection(PendingUser, "pending_users", dry_run)

    # -- Final report --------------------------------------------------------
    finished_at = datetime.utcnow()
    elapsed = (finished_at - started_at).total_seconds()

    def _row(label, s):
        return (
            f"  {label:<16} | {s['total']:>5} | {s['skipped_bcrypt']:>9} "
            f"| {s['skipped_werkzeug']:>8} | {s['migrated']:>8} | {s['errors']:>6}"
        )

    print("\n" + "=" * 75)
    print("  MIGRATION COMPLETE")
    print(f"  Finished at  : {finished_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"  Elapsed      : {elapsed:.2f}s")
    print("-" * 75)
    print(
        "  Collection       | Total | Skip-bcrypt | Skip-wz | Migrated | Errors"
    )
    print("-" * 75)
    print(_row("users", users_summary))
    print(_row("pending_users", pending_summary))
    print("=" * 75)

    # Advice on Werkzeug hashes
    total_werkzeug = (
        users_summary["skipped_werkzeug"] + pending_summary["skipped_werkzeug"]
    )
    if total_werkzeug > 0:
        print(
            f"\n  [NOTE] {total_werkzeug} Werkzeug PBKDF2 hash(es) were found and skipped."
        )
        print(
            "         These passwords are already secure (PBKDF2-SHA256)."
        )
        print(
            "         To fully migrate to bcrypt, update routes/auth.py to use"
        )
        print(
            "         a 'dual-check' at login: verify with Werkzeug first, then"
        )
        print(
            "         re-hash with bcrypt on the next successful login."
        )
        print(
            "         See the comments in routes/auth.py for instructions."
        )

    total_errors = users_summary["errors"] + pending_summary["errors"]
    if total_errors:
        print(f"\n  [!] {total_errors} error(s) occurred. Review the output above.")
        sys.exit(1)
    else:
        total_migrated = users_summary["migrated"] + pending_summary["migrated"]
        if total_migrated > 0:
            print(
                f"\n  [OK] {total_migrated} plain-text password(s) migrated to bcrypt."
            )
        else:
            print("\n  [OK] No plain-text passwords found. Nothing to migrate.")

        if dry_run:
            print("  [i]  Re-run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
