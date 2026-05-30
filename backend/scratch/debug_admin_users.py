import sys
import os

# Add the parent directory of the current directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import User, Profile

def test_admin_users():
    app = create_app()
    with app.app_context():
        try:
            print("Querying users...")
            users = User.objects().order_by('-created_at')
            print(f"Found {len(users)} users.")
            
            user_list = []
            for u in users:
                print(f"User: {u.name} (id: {u.id}), Role: {u.role}")
                profile = Profile.objects(user=u).first()
                print(f"Profile: {profile}")
                if profile:
                    print(f"Global score: {profile.global_score}")
                user_list.append({
                    "id": str(u.id),
                    "name": u.name,
                    "email": u.email,
                    "role": u.role,
                    "branch": u.branch,
                    "year": u.year,
                    "college": u.college,
                    "global_score": profile.global_score if profile else 0
                })
            print("Successfully processed all users!")
            print(f"User list size: {len(user_list)}")
        except Exception as e:
            import traceback
            print(f"ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    test_admin_users()
