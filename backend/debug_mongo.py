import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv('MONGO_URI')
client = MongoClient(uri)
db_name = uri.split('/')[-1].split('?')[0] or 'unirank'
db = client[db_name]

print(f"Connected to database: {db_name}")
collections = db.list_collection_names()
print(f"Collections in '{db_name}': {collections}")

for coll_name in collections:
    count = db[coll_name].count_documents({})
    print(f"Collection '{coll_name}': {count} documents")
