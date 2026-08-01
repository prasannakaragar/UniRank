/**
 * scripts/deleteUser.js
 * CLI script to delete a user by email.
 * Usage: node src/scripts/deleteUser.js <email>
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, Profile } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function deleteUser(email) {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    await User.deleteOne({ _id: user._id });
    await Profile.deleteOne({ user: user._id });
    console.log(`User ${email} deleted successfully.`);
  } else {
    console.log(`User ${email} not found.`);
  }
  await mongoose.disconnect();
}

const email = process.argv[2] || 'ugcet2502154@reva.edu.in';
deleteUser(email.trim()).catch((err) => {
  console.error('Delete user error:', err);
  process.exit(1);
});
