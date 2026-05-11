import sys
import os
from flask_mongoengine import MongoEngine
from flask import Flask
from dotenv import load_dotenv

# Load env vars
load_dotenv()

app = Flask(__name__)
app.config['MONGODB_SETTINGS'] = {
    'host': os.getenv('MONGO_URI')
}
db = MongoEngine(app)

class PendingUser(db.Document):
    meta = {'collection': 'pending_users'}
    email = db.StringField()

class User(db.Document):
    meta = {'collection': 'users'}
    email = db.StringField()

def count_users():
    with app.app_context():
        user_count = User.objects.count()
        pending_count = PendingUser.objects.count()
        print(f"Total Users: {user_count}")
        print(f"Total Pending Users: {pending_count}")

if __name__ == "__main__":
    count_users()
