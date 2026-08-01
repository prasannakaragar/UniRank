/**
 * scripts/deleteGmailUsers.js
 * Finds and deletes all user accounts, profiles, and pending registrations
 * with @gmail.com email addresses from MongoDB.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, Profile, PendingUser } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function deleteGmailUsers() {
  await connectDB();

  const gmailRegex = /@gmail\.com$/i;

  const usersToDelete = await User.find({ email: gmailRegex });
  console.log(`Found ${usersToDelete.length} user(s) with @gmail.com:`);

  for (const u of usersToDelete) {
    console.log(` - ${u.name} (${u.email}) [ID: ${u._id}]`);
    await Profile.deleteOne({ user: u._id });
    await User.deleteOne({ _id: u._id });
  }

  const pendingToDelete = await PendingUser.find({ email: gmailRegex });
  console.log(`Found ${pendingToDelete.length} pending user(s) with @gmail.com:`);

  for (const p of pendingToDelete) {
    console.log(` - ${p.name} (${p.email}) [ID: ${p._id}]`);
    await PendingUser.deleteOne({ _id: p._id });
  }

  console.log('\nSuccessfully deleted all @gmail.com accounts and associated profiles.');
  await mongoose.disconnect();
}

deleteGmailUsers().catch((err) => {
  console.error('Error deleting @gmail.com users:', err);
  process.exit(1);
});
