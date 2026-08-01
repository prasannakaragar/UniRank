/**
 * scripts/setRole.js
 * CLI script to update user role.
 * Usage: node src/scripts/setRole.js <email> <role>
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function setUserRole(email, role) {
  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`Error: User with email '${email}' not found.`);
    await mongoose.disconnect();
    return;
  }

  const allowedRoles = ['student', 'mentor', 'admin', 'reviewer', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    console.error(`Error: Invalid role '${role}'. Allowed roles are: ${allowedRoles.join(', ')}`);
    await mongoose.disconnect();
    return;
  }

  user.role = role;
  await user.save();
  console.log(`Success: ${user.name}'s role has been updated to '${role}'.`);

  await mongoose.disconnect();
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node src/scripts/setRole.js <email> <role>');
  process.exit(1);
}

setUserRole(args[0].trim(), args[1].trim()).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
