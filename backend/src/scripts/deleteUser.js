/**
 * scripts/deleteUser.js
 * CLI script to delete a user by email and cleanly purge related records.
 * Usage: node src/scripts/deleteUser.js <email> [--with-domain]
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import {
  User,
  Profile,
  PendingUser,
  College,
  CollegeIndex,
  Message,
  Conversation,
  BlockRecord,
  Notification,
  Issue,
  TeamPost,
  HackathonResult,
  HackathonSubmission,
  ProjectReview,
} from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function deleteUser(email, deleteDomain = false) {
  await connectDB();
  const targetEmail = email.toLowerCase().trim();
  const domain = targetEmail.split('@').pop().toLowerCase();

  const user = await User.findOne({ email: targetEmail });
  let deletedAny = false;

  if (user) {
    const userId = user._id;

    await Profile.deleteMany({ user: userId });
    await Message.deleteMany({ sender: userId });
    await Conversation.deleteMany({ participants: userId });
    await BlockRecord.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] });
    await Notification.deleteMany({ user: userId });
    await Issue.deleteMany({ user: userId });
    await TeamPost.deleteMany({ user: userId });
    await HackathonResult.deleteMany({ user: userId });
    await HackathonSubmission.deleteMany({ user: userId });
    await ProjectReview.deleteMany({ $or: [{ reviewer: userId }, { user: userId }] });

    await User.deleteOne({ _id: userId });
    console.log(`User ${targetEmail} (ID: ${userId}) and all related records deleted successfully.`);
    deletedAny = true;
  }

  const pendingRes = await PendingUser.deleteMany({ email: targetEmail });
  if (pendingRes.deletedCount > 0) {
    console.log(`Deleted ${pendingRes.deletedCount} pending registration(s) for ${targetEmail}.`);
    deletedAny = true;
  }

  if (deleteDomain && domain) {
    const colRes = await College.deleteMany({ domain });
    const colIdxRes = await CollegeIndex.deleteMany({ domain });
    console.log(`Deleted ${colRes.deletedCount} college record(s) and ${colIdxRes.deletedCount} collegeIndex record(s) for domain '${domain}'.`);
    deletedAny = true;
  }

  if (!deletedAny) {
    console.log(`No user, pending user, or domain records found for ${targetEmail}.`);
  }

  await mongoose.disconnect();
}

const email = process.argv[2];
const deleteDomain = process.argv.includes('--with-domain');

if (!email) {
  console.error('Usage: node src/scripts/deleteUser.js <email> [--with-domain]');
  process.exit(1);
}

deleteUser(email, deleteDomain).catch((err) => {
  console.error('Delete user error:', err);
  process.exit(1);
});
