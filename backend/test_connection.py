from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')  # check connection
    db = client["unirank"]
    print("[OK] MongoDB Connected Successfully")
except Exception as e:
    print("[ERROR] MongoDB Connection Failed:", e)
