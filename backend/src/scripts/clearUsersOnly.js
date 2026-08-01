/**
 * scripts/clearUsersOnly.js
 * Deletes all Users, Profiles, and PendingUsers.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, Profile, PendingUser } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  await User.deleteMany();
  await Profile.deleteMany();
  await PendingUser.deleteMany();
  console.log('Successfully deleted all Users, Profiles, and Pending registrations.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
