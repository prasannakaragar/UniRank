/**
 * utils/email.js
 * OTP generation and email delivery via Brevo (Sendinblue) HTTP API.
 */

import axios from 'axios';
import crypto from 'crypto';

/**
 * Generate a random numeric OTP.
 */
export function generateOtp(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

/**
 * Hash an OTP using SHA-256 (for storage — short-lived, so SHA-256 is fine).
 */
export function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify an OTP against its SHA-256 hash (constant-time).
 */
export function verifyOtp(otp, hash) {
  const computed = hashOtp(otp);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

/**
 * Send an OTP email via the Brevo HTTP API.
 * Returns true on success, false on failure.
 */
export async function sendOtpEmail(email, otp) {
  const textContent =
    `Your verification code is: ${otp}\n\n` +
    `This code will expire in 5 minutes.\n\n` +
    `Do not share this code with anyone.\n\n` +
    `If you did not request this code, you can safely ignore this message.`;

  const htmlContent = `<!DOCTYPE html>
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
                ${otp}
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
</html>`;

  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER || 'learnitfast6@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'UniRank';

  // Local dev fallback
  if (!brevoApiKey) {
    console.log('[EMAIL WARNING] BREVO_API_KEY is not set in environment variables.');
    console.log(`[LOCAL DEV FALLBACK] OTP for ${email}: ${otp}`);
    return true;
  }

  try {
    console.log(`[EMAIL] Sending OTP email to ${email} via Brevo API...`);
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: 'Your verification code',
        htmlContent,
        textContent,
      },
      {
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );

    if ([200, 201, 202].includes(response.status)) {
      const messageId = response.data?.messageId || 'unknown';
      console.log(`[EMAIL SUCCESS] OTP sent to ${email} (messageId: ${messageId})`);
      return true;
    } else {
      console.log(`[EMAIL ERROR] Brevo API returned ${response.status}: ${JSON.stringify(response.data)}`);
      console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
      return false;
    }
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.log('[EMAIL ERROR] Brevo API request timed out after 10 seconds.');
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('[EMAIL ERROR] Could not connect to Brevo API. Check your network.');
    } else {
      console.log(`[EMAIL EXCEPTION] An error occurred while sending email: ${err.message}`);
    }
    console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
    return false;
  }
}
