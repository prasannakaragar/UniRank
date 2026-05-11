import os
import sys
from dotenv import load_dotenv

# Add the current directory to sys.path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.email_utils import send_otp_email

load_dotenv()

def test_production_email():
    if len(sys.argv) < 2:
        print("Usage: python backend/debug_email.py <recipient_email>")
        sys.exit(1)
        
    recipient = sys.argv[1]
    otp = "123456"

    print(f"Testing production OTP delivery to: {recipient}")
    print(f"Using Sender: {os.getenv('GMAIL_USER')}")
    
    success = send_otp_email(recipient, otp)
    
    if success:
        print("SUCCESS: The email was sent successfully!")
    else:
        print("FAILED: Check your .env credentials.")

if __name__ == "__main__":
    test_production_email()
