import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import User, Profile, PendingUser

def clear_users():
    app = create_app()
    with app.app_context():
        # Delete all documents in these collections
        User.objects.delete()
        Profile.objects.delete()
        PendingUser.objects.delete()
        print("Successfully deleted all Users, Profiles, and Pending registrations.")

if __name__ == "__main__":
    clear_users()
