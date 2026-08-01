/**
 * scripts/scratch/testApiCall.js
 */

import dotenv from 'dotenv';
import connectDB from '../../config/db.js';
import { User } from '../../models/index.js';
import { createAccessToken } from '../../middleware/auth.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  try {
    console.log('Fetching Prasanna Karagar user...');
    const u = await User.findOne({ email: 'ugcet2502059@reva.edu.in' });
    if (!u) {
      console.log('Prasanna Karagar not found in DB!');
      await mongoose.disconnect();
      return;
    }

    console.log(`User role: ${u.role}`);
    const token = createAccessToken(u._id.toString());
    console.log(`Generated JWT Token: ${token.substring(0, 20)}...`);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
