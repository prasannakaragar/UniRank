import sys
import os

# Add the current directory to sys.path so we can import app and models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db

def reset_db():
    app = create_app()
    with app.app_context():
        print("Dropping database...")
        # Get the underlying pymongo database object and drop it
        from mongoengine.connection import get_db
        db_conn = get_db()
        db_conn.client.drop_database(db_conn.name)
        print("Database reset successfully.")

if __name__ == "__main__":
    reset_db()
