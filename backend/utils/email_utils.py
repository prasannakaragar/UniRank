"""
utils/email_utils.py
OTP generation and email delivery via Brevo (Sendinblue) HTTP API.
HTTP APIs are required for Render Free tier as SMTP ports are blocked.
"""
import os
import random
import string
import requests


def generate_otp(length=6):
    """Generates a random 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(email, otp):
    """
    Sends OTP to the user's email using the Brevo (Sendinblue) HTTP API.
    Required for Render as outbound SMTP ports (25, 465, 587) are blocked.

    Environment variables:
        BREVO_API_KEY   - Your Brevo API key (required)
        BREVO_SENDER    - Verified sender email (default: learnitfast6@gmail.com)
        BREVO_SENDER_NAME - Display name for sender (default: UniRank)
    """
    # 1. Plain text content for fallback email clients
    text_content = (
        f"Your verification code is: {otp}\n\n"
        f"This code will expire in 5 minutes.\n\n"
        f"Do not share this code with anyone.\n\n"
        f"If you did not request this code, you can safely ignore this message."
    )

    # 2. Premium HTML content with clear typography and styled box
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
            This is an automated message - please do not reply.
        </p>
    </div>
</body>
</html>"""

    # 3. Read configuration from environment variables
    brevo_api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("BREVO_SENDER", "learnitfast6@gmail.com")
    sender_name = os.getenv("BREVO_SENDER_NAME", "UniRank")

    # --- Local Dev Fallback (No API Key set) ---
    if not brevo_api_key:
        print("[EMAIL WARNING] BREVO_API_KEY is not set in environment variables.")
        print(f"[LOCAL DEV FALLBACK] OTP for {email}: {otp}")
        # Return True in local development so the signup/verify flow can be tested
        return True

    # 4. Attempt to send via Brevo HTTP API
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": brevo_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "sender": {
                "name": sender_name,
                "email": sender_email,
            },
            "to": [
                {"email": email}
            ],
            "subject": "Your verification code",
            "htmlContent": html_content,
            "textContent": text_content,
        }

        print(f"[EMAIL] Sending OTP email to {email} via Brevo API...")
        response = requests.post(url, headers=headers, json=payload, timeout=10)

        if response.status_code in [200, 201, 202]:
            response_data = response.json()
            message_id = response_data.get("messageId", "unknown")
            print(f"[EMAIL SUCCESS] OTP sent to {email} (messageId: {message_id})")
            return True
        else:
            print(f"[EMAIL ERROR] Brevo API returned {response.status_code}: {response.text}")
            print(f"[FALLBACK] OTP for {email}: {otp}")
            return False

    except requests.exceptions.Timeout:
        print(f"[EMAIL ERROR] Brevo API request timed out after 10 seconds.")
        print(f"[FALLBACK] OTP for {email}: {otp}")
        return False

    except requests.exceptions.ConnectionError:
        print(f"[EMAIL ERROR] Could not connect to Brevo API. Check your network.")
        print(f"[FALLBACK] OTP for {email}: {otp}")
        return False

    except Exception as e:
        print(f"[EMAIL EXCEPTION] An error occurred while sending email: {e}")
        print(f"[FALLBACK] OTP for {email}: {otp}")
        return False