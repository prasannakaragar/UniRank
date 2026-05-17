"""
utils/email_utils.py (ULTRA-OPTIMIZED FOR OUTLOOK INBOX)
OTP generation and email delivery via Gmail SMTP.
Specifically optimized to avoid Junk/Spam folder in Outlook.
"""
import os
import random
import string
import smtplib
import requests
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import socket


def generate_otp(length=6):
    """Generates a random 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(recipient_email, otp):
    """
    Sends OTP to user's email.
    Supports Resend HTTP API, SendGrid HTTP API, and falls back to Gmail SMTP.
    HTTP APIs are required for Render Free tier as SMTP ports (25, 465, 587) are blocked.
    """
    # Define text and HTML contents
    text_content = f"""Your verification code is: {otp}

This code will expire in 5 minutes.

Do not share this code with anyone.

If you did not request this code, you can safely ignore this message."""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <div style="background-color: #ffffff; max-width: 400px; margin: 20px auto; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #333; line-height: 1.6;">
            Your verification code is:
        </p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #000; letter-spacing: 2px; font-family: monospace;">
                {otp}
            </p>
        </div>
        
        <p style="margin: 15px 0; font-size: 13px; color: #666; line-height: 1.6;">
            <strong>Code expires in:</strong> 5 minutes
        </p>
        
        <p style="margin: 15px 0; font-size: 13px; color: #666; line-height: 1.6;">
            <strong>Security note:</strong> Never share this code with anyone.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        
        <p style="margin: 0; font-size: 12px; color: #999;">
            If you didn't request this code, you can safely ignore this message.<br>
            This is an automated message — please do not reply.
        </p>
    </div>
</body>
</html>"""

    # --- METHOD 1: Resend HTTP API (Highly Recommended for Render Free Tier) ---
    resend_api_key = os.getenv("RESEND_API_KEY")
    if resend_api_key:
        print("[EMAIL] Found RESEND_API_KEY. Attempting Resend HTTP delivery...")
        resend_sender = os.getenv("RESEND_SENDER", "onboarding@resend.dev")
        try:
            r = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"UniRank <{resend_sender}>",
                    "to": recipient_email,
                    "subject": "Your verification code",
                    "html": html_content,
                    "text": text_content
                },
                timeout=10
            )
            if r.status_code in [200, 201, 202]:
                print(f"[EMAIL] ✅ Email sent via Resend to {recipient_email}")
                return True
            else:
                print(f"[EMAIL] ❌ Resend API returned error {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[EMAIL] ❌ Resend API exception: {e}")

    # --- METHOD 2: SendGrid HTTP API (Alternative for Render Free Tier) ---
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    if sendgrid_api_key:
        print("[EMAIL] Found SENDGRID_API_KEY. Attempting SendGrid HTTP delivery...")
        sendgrid_sender = os.getenv("SENDGRID_SENDER", "noreply@unirank.net")
        try:
            r = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [
                        {
                            "to": [{"email": recipient_email}],
                            "subject": "Your verification code"
                        }
                    ],
                    "from": {"email": sendgrid_sender, "name": "UniRank"},
                    "content": [
                        {"type": "text/plain", "value": text_content},
                        {"type": "text/html", "value": html_content}
                    ]
                },
                timeout=10
            )
            if r.status_code in [200, 201, 202]:
                print(f"[EMAIL] ✅ Email sent via SendGrid to {recipient_email}")
                return True
            else:
                print(f"[EMAIL] ❌ SendGrid API returned error {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[EMAIL] ❌ SendGrid API exception: {e}")

    # --- METHOD 3: Fallback to Gmail SMTP (Default local development) ---
    print("[EMAIL] Attempting Gmail SMTP delivery...")
    smtp_server   = "smtp.gmail.com"
    smtp_port     = 587

    smtp_login    = os.getenv("GMAIL_USER")
    smtp_password = os.getenv("GMAIL_APP_PASS")
    sender_email  = smtp_login

    if not all([smtp_login, smtp_password]):
        print("[SMTP] Configuration missing (GMAIL_USER or GMAIL_APP_PASS not set). Skipping email send.")
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False

    # Build email with alternative parts (text and HTML)
    msg = MIMEMultipart('alternative')
    
    # ✅ CRITICAL HEADERS FOR OUTLOOK INBOX
    msg['From']    = sender_email
    msg['To']      = recipient_email
    msg['Subject'] = "Your verification code"
    
    # Essential headers
    msg['Date']    = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')
    msg['Message-ID'] = f"<{datetime.utcnow().timestamp()}@{socket.getfqdn()}>"
    
    # ✅ OUTLOOK-SPECIFIC HEADERS
    msg['X-MSMail-Priority'] = "Normal"
    msg['Importance'] = "normal"
    msg['X-Mailer'] = "UniRank/1.0"
    msg['X-Priority'] = "3"
    
    # Security & Routing
    msg['Return-Path'] = sender_email
    msg['Reply-To'] = sender_email
    msg['MIME-Version'] = "1.0"
    msg['Content-Language'] = "en-US"
    
    # ✅ TRANSACTIONAL EMAIL SIGNAL
    msg['List-Unsubscribe'] = "<mailto:noreply@unirank.local?subject=unsubscribe>"
    msg['List-Unsubscribe-Post'] = "List-Unsubscribe=One-Click"
    
    # Authentication & Identity
    try:
        msg['X-Originating-IP'] = f"[{socket.gethostbyname(socket.gethostname())}]"
    except:
        pass

    # Attach plain text FIRST, HTML second
    msg.attach(MIMEText(text_content, 'plain'))
    msg.attach(MIMEText(html_content, 'html'))

    try:
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_login, smtp_password)
            server.send_message(msg)

        print(f"[SMTP] ✅ Email sent to {recipient_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"[SMTP] ❌ Authentication failed: {e}")
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False

    except smtplib.SMTPException as e:
        print(f"[SMTP] ❌ SMTP error: {e}")
        print(f"[SMTP] Note: If you are running on Render's Free tier, Render blocks outbound SMTP traffic on ports 25, 465, and 587. Please upgrade to a paid tier or use an HTTP-based email API like Resend by setting the 'RESEND_API_KEY' environment variable.")
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False

    except Exception as e:
        print(f"[SMTP] ❌ Error: {e}")
        print(f"[SMTP] Note: If you are running on Render's Free tier, Render blocks outbound SMTP traffic on ports 25, 465, and 587. Please upgrade to a paid tier or use an HTTP-based email API like Resend by setting the 'RESEND_API_KEY' environment variable.")
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False