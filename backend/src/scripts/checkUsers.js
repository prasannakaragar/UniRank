/**
 * scripts/checkUsers.js
 * CLI script to list all users in the database.
 * Usage: node src/scripts/checkUsers.js
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function listUsers() {
  await connectDB();
  const users = await User.find();
  if (!users.length) {
    console.log('\nNo users found in the database.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${'ID'.padEnd(30)} | ${'Name'.padEnd(20)} | ${'Email'.padEnd(30)} | ${'Role'.padEnd(10)}`);
  console.log('-'.repeat(95));
  for (const u of users) {
    console.log(`${u._id.toString().padEnd(30)} | ${u.name.padEnd(20)} | ${u.email.padEnd(30)} | ${u.role.padEnd(10)}`);
  }
  console.log('-'.repeat(95));
  console.log(`Total users: ${users.length}\n`);

  await mongoose.disconnect();
}

listUsers().catch((err) => {
  console.error('List users error:', err);
  process.exit(1);
});
