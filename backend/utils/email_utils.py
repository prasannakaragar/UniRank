"""
utils/email_utils.py (ULTRA-OPTIMIZED FOR OUTLOOK INBOX)
OTP generation and email delivery via Gmail SMTP.
Specifically optimized to avoid Junk/Spam folder in Outlook.
"""
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import socket


def generate_otp(length=6):
    """Generates a random 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(recipient_email, otp):
    """
    Sends OTP to user's email using Gmail SMTP.
    OPTIMIZED FOR OUTLOOK INBOX DELIVERY (not Junk).

    Required env vars:
        GMAIL_USER      – Your Gmail address
        GMAIL_APP_PASS  – Your Gmail App Password
    """
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
    
    # ✅ OUTLOOK-SPECIFIC HEADERS (These are KEY to avoiding Junk!)
    msg['X-MSMail-Priority'] = "Normal"  # Tell Outlook this is normal priority
    msg['Importance'] = "normal"          # Standard importance header
    msg['X-Mailer'] = "UniRank/1.0"       # Identify sender
    msg['X-Priority'] = "3"               # Normal priority (1=high, 3=normal, 5=low)
    
    # Security & Routing
    msg['Return-Path'] = sender_email
    msg['Reply-To'] = sender_email
    msg['MIME-Version'] = "1.0"
    msg['Content-Language'] = "en-US"
    
    # ✅ TRANSACTIONAL EMAIL SIGNAL (tells Outlook this is transactional, not marketing)
    msg['List-Unsubscribe'] = "<mailto:noreply@unirank.local?subject=unsubscribe>"
    msg['List-Unsubscribe-Post'] = "List-Unsubscribe=One-Click"
    
    # Authentication & Identity
    try:
        msg['X-Originating-IP'] = f"[{socket.gethostbyname(socket.gethostname())}]"
    except:
        pass

    # ===== PLAIN TEXT VERSION (CRITICAL!) =====
    # Outlook prioritizes plain text over HTML for spam checking
    # Keep it simple, clear, and spam-free
    text_content = f"""Your verification code is: {otp}

This code will expire in 5 minutes.

Do not share this code with anyone.

If you did not request this code, you can safely ignore this message."""
    
    # ===== HTML VERSION (OPTIMIZED FOR OUTLOOK) =====
    # Simple, clean design that passes Outlook filters
    # No marketing language, no suspicious links, minimal styling
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
    
    # ✅ IMPORTANT: Attach plain text FIRST, HTML second
    # This helps Outlook prioritize text for spam checking
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
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False

    except Exception as e:
        print(f"[SMTP] ❌ Error: {e}")
        print(f"[DEV FALLBACK] OTP for {recipient_email}: {otp}")
        return False