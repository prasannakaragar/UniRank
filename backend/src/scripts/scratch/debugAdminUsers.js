/**
 * scripts/scratch/debugAdminUsers.js
 */

import dotenv from 'dotenv';
import connectDB from '../../config/db.js';
import { User, Profile } from '../../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  try {
    console.log('Querying users...');
    const users = await User.find().sort({ created_at: -1 });
    console.log(`Found ${users.length} users.`);

    const userList = [];
    for (const u of users) {
      console.log(`User: ${u.name} (id: ${u._id}), Role: ${u.role}`);
      const profile = await Profile.findOne({ user: u._id });
      console.log(`Profile: ${profile ? 'Found' : 'Not found'}`);
      if (profile) {
        console.log(`Global score: ${profile.global_score}`);
      }
      userList.push({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        branch: u.branch,
        year: u.year,
        college: u.college,
        global_score: profile ? profile.global_score : 0,
      });
    }
    console.log('Successfully processed all users!');
    console.log(`User list size: ${userList.length}`);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
