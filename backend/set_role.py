import sys
import os

# Add the current directory to sys.path so it can find 'app' and 'models'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import User

def set_user_role(email, role):
    app = create_app()
    with app.app_context():
        user = User.objects(email=email).first()
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return
        
        allowed_roles = ['student', 'mentor', 'admin']
        if role not in allowed_roles:
            print(f"Error: Invalid role '{role}'. Allowed roles are: {', '.join(allowed_roles)}")
            return
            
        user.role = role
        user.save()
        print(f"Success: {user.name}'s role has been updated to '{role}'.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python set_role.py <email> <role>")
    else:
        set_user_role(sys.argv[1].strip().lower(), sys.argv[2].strip().lower())
