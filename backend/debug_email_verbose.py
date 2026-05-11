import os
import sys
import smtplib
from dotenv import load_dotenv

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

def test_gmail_smtp_details():
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    smtp_login = os.getenv("GMAIL_USER")
    smtp_password = os.getenv("GMAIL_APP_PASS")
    
    print("--- Gmail SMTP Diagnostic ---")
    print(f"Host: {smtp_server}")
    print(f"Port: {smtp_port}")
    print(f"Login: {smtp_login}")
    print(f"Password provided: {'YES' if smtp_password else 'NO'}")
    print("-----------------------------")

    if not smtp_login or not smtp_password:
        print("Error: Missing credentials in .env (GMAIL_USER or GMAIL_APP_PASS)")
        return

    try:
        print("Connecting to server...")
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.set_debuglevel(1) # This will print the full SMTP transaction
        
        print("Sending EHLO...")
        server.ehlo()
        
        print("Starting TLS...")
        server.starttls()
        
        print("Sending EHLO again...")
        server.ehlo()
        
        print(f"Attempting login with {smtp_login}...")
        server.login(smtp_login, smtp_password)
        
        print("SUCCESS: Authentication successful!")
        server.quit()
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"FAILED: Authentication Error: {e}")
        print("\nPossible solutions:")
        print("1. Ensure you are using an 'App Password', not your regular Gmail password.")
        print("2. Check if 2-Step Verification is enabled (required for App Passwords).")
        print("3. Verify that the email address is correct.")
    except Exception as e:
        print(f"FAILED: Unexpected error: {e}")


if __name__ == "__main__":
    test_gmail_smtp_details()

