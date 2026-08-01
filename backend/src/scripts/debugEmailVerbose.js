/**
 * scripts/debugEmailVerbose.js
 * Brevo email API diagnostic.
 */

import dotenv from 'dotenv';
import { sendOtpEmail } from '../utils/email.js';

dotenv.config();

async function main() {
  console.log('--- Brevo Email API Diagnostic ---');
  console.log(`API Key present: ${process.env.BREVO_API_KEY ? 'YES' : 'NO'}`);
  console.log(`Sender: ${process.env.BREVO_SENDER || 'learnitfast6@gmail.com'}`);
  console.log('---------------------------------');

  const testEmail = process.argv[2] || 'test@example.com';
  const success = await sendOtpEmail(testEmail, '123456');
  console.log(`Result: ${success ? 'SUCCESS' : 'FAILED'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
