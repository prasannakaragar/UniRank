import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import College

def seed_colleges():
    app = create_app()
    with app.app_context():
        colleges = [
            {"name": "IISER Bhopal", "domain": "iiserb.ac.in"},
            {"name": "IISER Pune", "domain": "iiserpune.ac.in"},
            {"name": "IISER Mohali", "domain": "iisermohali.ac.in"},
            {"name": "IISER Kolkata", "domain": "iiserkol.ac.in"},
            {"name": "IISER Thiruvananthapuram", "domain": "iisertvm.ac.in"},
            {"name": "IISER Tirupati", "domain": "iisertirupati.ac.in"},
            {"name": "IISER Berhampur", "domain": "iiserberhampur.ac.in"},
            {"name": "IIT Bombay", "domain": "iitb.ac.in"},
            {"name": "IIT Delhi", "domain": "iitd.ac.in"},
            {"name": "IIT Kanpur", "domain": "iitk.ac.in"},
            {"name": "IIT Kharagpur", "domain": "iitkgp.ac.in"},
            {"name": "IIT Madras", "domain": "iitm.ac.in"},
            {"name": "IIT Roorkee", "domain": "iitr.ac.in"},
            {"name": "IIT Guwahati", "domain": "iitg.ac.in"},
            {"name": "IIT BHU", "domain": "iitbhu.ac.in"},
            {"name": "IIT Hyderabad", "domain": "iith.ac.in"},
            {"name": "IIT Indore", "domain": "iiti.ac.in"},
            {"name": "IIT Ropar", "domain": "iitror.ac.in"},
            {"name": "IIT Mandi", "domain": "iitmandi.ac.in"},
            {"name": "IIT Jodhpur", "domain": "iitj.ac.in"},
            {"name": "IIT Patna", "domain": "iitp.ac.in"},
            {"name": "IIT Gandhinagar", "domain": "iitgn.ac.in"},
            {"name": "IIT Bhubaneswar", "domain": "iitbbs.ac.in"},
        ]
        
        for c in colleges:
            if not College.objects(domain=c["domain"]).first():
                College(name=c["name"], domain=c["domain"]).save()
                print(f"Added: {c['name']} ({c['domain']})")
            else:
                print(f"Already exists: {c['name']}")

if __name__ == "__main__":
    seed_colleges()
