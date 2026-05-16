import sys
import os
from mongoengine import connect
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models import User

load_dotenv()
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/unirank")
connect(host=mongo_uri)

user = User.objects(email="pes1ug25cs393@stu.pes.edu").first()
if user:
    user.role = "student"
    user.save()
    print("Successfully set role to student.")
else:
    print("User not found.")
