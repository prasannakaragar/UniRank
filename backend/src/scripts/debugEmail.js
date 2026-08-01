/**
 * scripts/debugEmail.js
 * Test production OTP delivery to a specified recipient email.
 * Usage: node src/scripts/debugEmail.js <recipient_email>
 */

import dotenv from 'dotenv';
import { sendOtpEmail } from '../utils/email.js';

dotenv.config();

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.log('Usage: node src/scripts/debugEmail.js <recipient_email>');
    process.exit(1);
  }

  console.log('--- Brevo API Diagnostic ---');
  console.log(`Testing production OTP delivery to: ${recipient}`);
  console.log(`Using Sender: ${process.env.BREVO_SENDER || 'learnitfast6@gmail.com'}`);
  console.log(`API Key present: ${process.env.BREVO_API_KEY ? 'YES' : 'NO'}`);
  console.log('-----------------------------');

  const success = await sendOtpEmail(recipient, '123456');

  if (success) {
    console.log('SUCCESS: The email was sent successfully via Brevo API!');
  } else {
    console.log('FAILED: Check your .env credentials and BREVO_API_KEY.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
