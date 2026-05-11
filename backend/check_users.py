import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import User

def list_users():
    app = create_app()
    with app.app_context():
        users = User.objects()
        if not users:
            print("\nNo users found in the database.")
            return

        print(f"\n{'ID':<30} | {'Name':<20} | {'Email':<30} | {'Role':<10}")
        print("-" * 95)
        for u in users:
            print(f"{str(u.id):<30} | {u.name:<20} | {u.email:<30} | {u.role:<10}")
        print("-" * 95)
        print(f"Total users: {len(users)}\n")

if __name__ == "__main__":
    list_users()
