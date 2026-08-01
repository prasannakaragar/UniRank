/**
 * scripts/scratch/checkDbState.js
 */

import dotenv from 'dotenv';
import connectDB from '../../config/db.js';
import { User, PendingUser, Profile } from '../../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  console.log(`User count: ${await User.countDocuments()}`);
  console.log(`PendingUser count: ${await PendingUser.countDocuments()}`);
  console.log(`Profile count: ${await Profile.countDocuments()}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map((c) => c.name));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
