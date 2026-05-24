"""
fix_missing_colleges.py
Scans all users in the DB, extracts their email domain,
and auto-creates a College entry if one doesn't exist yet.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import User, College

def fix_missing_colleges():
    app = create_app()
    with app.app_context():
        users = User.objects()
        print(f"Total users found: {users.count()}\n")

        added   = []
        skipped = []

        for u in users:
            domain = u.email.split("@")[-1].lower()
            college = College.objects(domain=domain).first()

            if college:
                # College already exists — make sure user's college field is correct
                if u.college != college.name:
                    old = u.college
                    u.college = college.name
                    u.save()
                    print(f"  [FIXED]  {u.email}  →  '{old}' corrected to '{college.name}'")
                else:
                    skipped.append(f"{u.email} ({college.name})")
            else:
                # New domain — auto-create college
                college_name = domain.split(".")[0].upper()
                College(name=college_name, domain=domain).save()
                u.college = college_name
                u.save()
                added.append(f"{college_name} ({domain})")
                print(f"  [ADDED]  New college: {college_name} ({domain})  ← from {u.email}")

        print(f"\n✅ Done.")
        print(f"   New colleges created : {len(added)}")
        print(f"   Users already mapped : {len(skipped)}")

if __name__ == "__main__":
    fix_missing_colleges()
