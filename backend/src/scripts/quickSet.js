/**
 * scripts/quickSet.js
 * Quick script to update a user's role.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  const user = await User.findOne({ email: 'pes1ug25cs393@stu.pes.edu' });
  if (user) {
    user.role = 'student';
    await user.save();
    console.log('Successfully set role to student.');
  } else {
    console.log('User not found.');
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
