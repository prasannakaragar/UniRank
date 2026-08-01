/**
 * scripts/fixMissingColleges.js
 * Scans all users in the DB, extracts their email domain, and auto-creates a College entry if one doesn't exist yet.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, College } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function main() {
  await connectDB();
  const users = await User.find();
  console.log(`Total users found: ${users.length}\n`);

  const added = [];
  const skipped = [];

  for (const u of users) {
    const domain = u.email.split('@').pop().toLowerCase();
    let college = await College.findOne({ domain });

    if (college) {
      if (u.college !== college.name) {
        const old = u.college;
        u.college = college.name;
        await u.save();
        console.log(`  [FIXED]  ${u.email}  →  '${old}' corrected to '${college.name}'`);
      } else {
        skipped.push(`${u.email} (${college.name})`);
      }
    } else {
      const collegeName = domain.split('.')[0].toUpperCase();
      college = await College.create({ name: collegeName, domain });
      u.college = collegeName;
      await u.save();
      added.push(`${collegeName} (${domain})`);
      console.log(`  [ADDED]  New college: ${collegeName} (${domain})  ← from ${u.email}`);
    }
  }

  console.log('\n✅ Done.');
  console.log(`   New colleges created : ${added.length}`);
  console.log(`   Users already mapped : ${skipped.length}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
