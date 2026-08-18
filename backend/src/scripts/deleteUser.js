/**
 * scripts/deleteUser.js
 * CLI script to delete a user by email.
 * Usage: node src/scripts/deleteUser.js <email>
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, Profile, PendingUser } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function deleteUser(email) {
  await connectDB();
  const targetEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: targetEmail });
  let deletedAny = false;
  if (user) {
    await User.deleteOne({ _id: user._id });
    await Profile.deleteOne({ user: user._id });
    console.log(`User ${targetEmail} (ID: ${user._id}) deleted successfully from User and Profile.`);
    deletedAny = true;
  }
  const pending = await PendingUser.findOne({ email: targetEmail });
  if (pending) {
    await PendingUser.deleteOne({ _id: pending._id });
    console.log(`Pending user ${targetEmail} (ID: ${pending._id}) deleted successfully from PendingUser.`);
    deletedAny = true;
  }
  if (!deletedAny) {
    console.log(`No user or pending user found with email ${targetEmail}.`);
  }
  await mongoose.disconnect();
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node src/scripts/deleteUser.js <email>');
  process.exit(1);
}
deleteUser(email).catch((err) => {
  console.error('Delete user error:', err);
  process.exit(1);
});
