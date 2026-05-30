import sys
import os

# Add the parent directory of the current directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import User
from flask_jwt_extended import create_access_token

def test_api():
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
            
            # Let's simulate the API request to /api/admin/users
            # We can use the Flask test client!
            client = app.test_client()
            headers = {
                "Authorization": f"Bearer {token}"
            }
            print("Sending GET /api/admin/users request...")
            res = client.get("/api/admin/users", headers=headers)
            print(f"Response status code: {res.status_code}")
            print(f"Response data: {res.get_data(as_text=True)}")
            
        except Exception as e:
            import traceback
            print(f"ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    test_api()
