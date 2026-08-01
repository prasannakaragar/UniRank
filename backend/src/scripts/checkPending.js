/**
 * scripts/checkPending.js
 * Lists all PendingUsers.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { PendingUser } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  console.log(`${'ID'.padEnd(30)} | ${'Name'.padEnd(20)} | ${'Email'.padEnd(30)}`);
  console.log('-'.repeat(85));
  const pending = await PendingUser.find();
  for (const p of pending) {
    console.log(`${p._id.toString().padEnd(30)} | ${p.name.padEnd(20)} | ${p.email.padEnd(30)}`);
  }
  console.log('-'.repeat(85));
  console.log(`Total pending users: ${pending.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
