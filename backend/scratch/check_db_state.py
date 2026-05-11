import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import User, PendingUser, Profile

def check_db():
    app = create_app()
    with app.app_context():
        print(f"User count: {User.objects.count()}")
        print(f"PendingUser count: {PendingUser.objects.count()}")
        print(f"Profile count: {Profile.objects.count()}")
        
        from mongoengine.connection import get_db
        db_conn = get_db()
        print(f"Collections: {db_conn.list_collection_names()}")

if __name__ == "__main__":
    check_db()
