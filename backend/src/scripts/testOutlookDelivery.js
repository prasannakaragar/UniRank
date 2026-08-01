/**
 * scripts/testOutlookDelivery.js
 * Test OTP email delivery using Brevo API or fallback.
 * Usage: node src/scripts/testOutlookDelivery.js <email>
 */

import dotenv from 'dotenv';
import { sendOtpEmail } from '../utils/email.js';

dotenv.config();

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.log('Usage: node src/scripts/testOutlookDelivery.js <email>');
    process.exit(1);
  }

  console.log('==================================================');
  console.log('📧 OUTLOOK / EMAIL DELIVERY TEST');
  console.log('==================================================');
  console.log(`Testing delivery to: ${recipient}`);

  const otp = '123456';
  const success = await sendOtpEmail(recipient, otp);

  if (success) {
    console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
  } else {
    console.log('\n❌ EMAIL DELIVERY FAILED');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
