import sys
import os

# Add the parent directory of the current directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import User
from flask_jwt_extended import create_access_token
import requests

def test_prod_api():
    app = create_app()
    with app.app_context():
        try:
            print("Fetching Prasanna Karagar user...")
            u = User.objects(email="ugcet2502059@reva.edu.in").first()
            if not u:
                print("Prasanna Karagar not found in DB!")
                return
            
            print(f"User role: {u.role}")
            
            # Let's generate a token
            token = create_access_token(identity=str(u.id))
            print(f"Generated JWT Token: {token[:20]}...")
            
            # Let's make an actual HTTP request to the production backend!
            url = "https://unirank-1.onrender.com/api/admin/users"
            headers = {
                "Authorization": f"Bearer {token}"
            }
            print(f"Sending GET request to {url}...")
            res = requests.get(url, headers=headers)
            print(f"Response status code: {res.status_code}")
            print(f"Response json: {res.json()}")
            
        except Exception as e:
            import traceback
            print(f"ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    test_prod_api()
