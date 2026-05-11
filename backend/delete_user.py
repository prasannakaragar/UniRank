import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import User

def delete_user(email):
    app = create_app()
    with app.app_context():
        user = User.objects(email=email).first()
        if user:
            user.delete()
            print(f"User {email} deleted successfully.")
        else:
            print(f"User {email} not found.")

if __name__ == "__main__":
    delete_user("ugcet2502154@reva.edu.in")
