/**
 * scripts/countUsersDetailed.js
 * Counts total Users and PendingUsers.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, PendingUser } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  const userCount = await User.countDocuments();
  const pendingCount = await PendingUser.countDocuments();
  console.log(`Total Users: ${userCount}`);
  console.log(`Total Pending Users: ${pendingCount}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
