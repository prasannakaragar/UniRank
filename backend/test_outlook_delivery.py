#!/usr/bin/env python3
"""
Test script for verifying OTP email delivery to Outlook and other providers
USAGE: python test_outlook_delivery.py <outlook_email>
"""
import os
import sys
import smtplib
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import socket

load_dotenv()

def test_outlook_delivery(recipient_email):
    """Test comprehensive email delivery to Outlook"""
    
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    smtp_login = os.getenv("GMAIL_USER")
    smtp_password = os.getenv("GMAIL_APP_PASS")
    sender_email = smtp_login
    
    print("=" * 60)
    print("📧 OUTLOOK EMAIL DELIVERY TEST")
    print("=" * 60)
    
    # Verify credentials
    print("\n1️⃣  CHECKING CREDENTIALS...")
    print(f"   GMAIL_USER: {smtp_login}")
    print(f"   GMAIL_APP_PASS: {'✅ SET' if smtp_password else '❌ NOT SET'}")
    
    if not smtp_login or not smtp_password:
        print("\n❌ ERROR: Missing credentials!")
        print("   Set GMAIL_USER and GMAIL_APP_PASS in .env file")
        return False
    
    # Build test email with proper headers
    print("\n2️⃣  BUILDING EMAIL WITH PROPER HEADERS...")
    
    msg = MIMEMultipart('alternative')
    
    # ✅ IMPORTANT: From header uses ONLY email address
    msg['From'] = sender_email
    msg['To'] = recipient_email
    msg['Subject'] = "Test OTP Email - Outlook Delivery"
    
    # ✅ Add all required headers
    msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')
    msg['Message-ID'] = f"<{datetime.utcnow().timestamp()}@{socket.getfqdn()}>"
    msg['X-Mailer'] = "UniRank Test Service/1.0"
    msg['X-Priority'] = "3"
    msg['Return-Path'] = sender_email
    msg['Reply-To'] = sender_email
    msg['MIME-Version'] = "1.0"
    
    try:
        msg['X-Originating-IP'] = f"[{socket.gethostbyname(socket.gethostname())}]"
    except:
        msg['X-Originating-IP'] = "[127.0.0.1]"
    
    print("   Headers added:")
    print(f"   ✅ From: {sender_email}")
    print(f"   ✅ To: {recipient_email}")
    print(f"   ✅ Date: {msg['Date']}")
    print(f"   ✅ Message-ID: {msg['Message-ID'][:50]}...")
    print(f"   ✅ Return-Path: {msg['Return-Path']}")
    print(f"   ✅ Reply-To: {msg['Reply-To']}")
    
    # Email content
    otp = "123456"
    text_content = f"""Test Email from UniRank

Your test OTP: {otp}

This is a test email to verify delivery to Outlook.
Check your Inbox and Junk folder.

Time sent: {datetime.utcnow().isoformat()}
"""
    
    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
    <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1;">Test OTP Email</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f5f5f5; border: 2px solid #6366f1; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 4px; color: #000;">{otp}</p>
        </div>
        <p style="color: #666; font-size: 14px;">Sent at: {datetime.utcnow().isoformat()}</p>
    </div>
</body>
</html>"""
    
    msg.attach(MIMEText(text_content, 'plain'))
    msg.attach(MIMEText(html_content, 'html'))
    
    print("\n3️⃣  CONNECTING TO GMAIL SMTP...")
    print(f"   Server: {smtp_server}:{smtp_port}")
    
    try:
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            print("   ✅ Connected to server")
            
            server.ehlo()
            print("   ✅ EHLO sent")
            
            server.starttls()
            print("   ✅ TLS started")
            
            server.ehlo()
            print("   ✅ EHLO sent again")
            
            server.login(smtp_login, smtp_password)
            print("   ✅ Authentication successful")
            
            server.send_message(msg)
            print("   ✅ Message sent via SMTP")
        
        print("\n" + "=" * 60)
        print("✅ EMAIL SENT SUCCESSFULLY!")
        print("=" * 60)
        print("\nNEXT STEPS:")
        print(f"1. Check your Outlook inbox for: {recipient_email}")
        print("2. Wait 30-60 seconds for delivery")
        print("3. If not in Inbox, check JUNK folder")
        print("\nIf email appears in JUNK:")
        print("   → Right-click and select 'Mark as Not Junk'")
        print("   → Add sender to Safe Senders list")
        print("\nIf email doesn't appear anywhere:")
        print("   → Check GMAIL_USER and GMAIL_APP_PASS are correct")
        print("   → Ensure App Password is used (not regular Gmail password)")
        print("   → Run: python test_outlook_delivery.py -v  (for verbose mode)")
        
        return True
    
    except smtplib.SMTPAuthenticationError as e:
        print("\n❌ AUTHENTICATION FAILED")
        print(f"   Error: {e}")
        print("\n   Possible causes:")
        print("   1. Wrong GMAIL_USER or GMAIL_APP_PASS")
        print("   2. Not using App Password (using regular password)")
        print("   3. 2-Step Verification not enabled on Gmail account")
        print("\n   Solution:")
        print("   → Go to: https://myaccount.google.com/apppasswords")
        print("   → Generate new 'App password' for Mail")
        print("   → Use that 16-character password in .env (GMAIL_APP_PASS)")
        return False
    
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP ERROR: {e}")
        return False
    
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n")
    
    if len(sys.argv) < 2:
        print("❌ Missing email address!")
        print("\nUSAGE:")
        print("   python test_outlook_delivery.py your.email@outlook.com")
        print("\nEXAMPLES:")
        print("   python test_outlook_delivery.py user@outlook.com")
        print("   python test_outlook_delivery.py user@gmail.com")
        print("   python test_outlook_delivery.py user@yahoo.com")
        print("\nOPTIONS:")
        print("   -v  :  Verbose mode (show SMTP transaction details)")
        sys.exit(1)
    
    recipient = sys.argv[1]
    
    # Check for verbose flag
    verbose = '-v' in sys.argv
    
    if verbose:
        print("🔍 VERBOSE MODE ENABLED")
        print("Will show full SMTP transaction...\n")
    
    # Validate email format (basic check)
    if '@' not in recipient or '.' not in recipient:
        print(f"❌ Invalid email format: {recipient}")
        sys.exit(1)
    
    # Run test
    success = test_outlook_delivery(recipient)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()