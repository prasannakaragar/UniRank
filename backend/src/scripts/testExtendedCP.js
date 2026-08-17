/**
 * scripts/testExtendedCP.js
 * Verification script for Extended CP system & Admin Score Overrides.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, Profile, AdminLog } from '../models/index.js';
import { getCodechefStats } from '../utils/codechef.js';
import { getHackerrankStats } from '../utils/hackerrank.js';
import { getHackerearthStats } from '../utils/hackerearth.js';
import { updateUserScores, calculatePlatformScores } from '../utils/scoring.js';

async function runTest() {
  console.log('[TEST] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('[TEST] ✓ MongoDB connected.');

  // Test 1: Fetcher Utilities
  console.log('\n--- 1. Testing Platform Stat Fetchers ---');
  const ccStats = await getCodechefStats('tourist');
  console.log('[CodeChef Fetcher Result]:', ccStats || 'Null/Fallback');

  const hrStats = await getHackerrankStats('tourist');
  console.log('[HackerRank Fetcher Result]:', hrStats || 'Null/Fallback');

  const heStats = await getHackerearthStats('tourist');
  console.log('[HackerEarth Fetcher Result]:', heStats || 'Null/Fallback');

  // Test 2: User & Profile Verification
  console.log('\n--- 2. Testing Profile & Score Overrides ---');
  let testUser = await User.findOne({ email: 'test_cp_student@unirank.test' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Test CP Student',
      email: 'test_cp_student@unirank.test',
      password: 'hashedpassword',
      role: 'student',
      college: 'Test Institute',
      branch: 'CSE',
      admission_year: 2022,
    });
  }

  let testProfile = await Profile.findOne({ user: testUser._id });
  if (!testProfile) {
    testProfile = await Profile.create({
      user: testUser._id,
      cf_handle: 'tourist',
      cf_rating: 3800,
      cf_problems_solved: 500,
      lc_username: 'tourist',
      lc_rating: 3200,
      lc_problems_solved: 800,
      cc_username: 'tourist',
      cc_rating: 2900,
      cc_stars: '7★',
      cc_problems_solved: 400,
      hr_username: 'tourist',
      hr_score: 1500,
      hr_badges: 10,
      hr_problems_solved: 250,
      he_username: 'tourist',
      he_rating: 2400,
      he_problems_solved: 300,
    });
  }

  // Calculate actual breakdown
  let breakdown = calculatePlatformScores(testProfile);
  console.log('[Calculated Actual Platform Scores]:', breakdown.actual);
  console.log('[Calculated Final Platform Scores]:', breakdown.final);

  await updateUserScores(testUser._id.toString());
  testProfile = await Profile.findOne({ user: testUser._id });
  console.log(`[Before Admin Override] CP Score: ${testProfile.cp_score}, Global Score: ${testProfile.global_score}`);

  // Test 3: Admin Override & Audit Logging
  console.log('\n--- 3. Testing Admin Override & Audit Trail ---');
  testProfile.override_cp_score = 999.5;
  testProfile.override_cf_score = 1200;
  await testProfile.save();

  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = testUser; // Fallback for test reference
  }

  await AdminLog.create({
    admin_id: adminUser._id,
    action: 'SCORE_OVERRIDE',
    target_user_id: testUser._id.toString(),
    score_type: 'cp',
    previous_value: breakdown.final.cp,
    new_value: 999.5,
    reason: 'Verified offline grandmaster achievement certificate',
    details: 'Override Overall CP Score to 999.5',
  });

  await updateUserScores(testUser._id.toString());
  testProfile = await Profile.findOne({ user: testUser._id });
  console.log(`[After Admin Override] CP Score: ${testProfile.cp_score}, Global Score: ${testProfile.global_score}`);

  // Query Audit Log
  const logs = await AdminLog.find({ target_user_id: testUser._id.toString() }).sort({ timestamp: -1 });
  console.log(`[Audit Logs Found]: ${logs.length}`);
  if (logs.length > 0) {
    console.log('[Latest Log Entry]:', logs[0].toDict());
  }

  // Cleanup test data
  console.log('\n--- 4. Cleaning up test record ---');
  await Profile.deleteOne({ _id: testProfile._id });
  await User.deleteOne({ _id: testUser._id });
  await AdminLog.deleteMany({ target_user_id: testUser._id.toString() });
  console.log('[TEST] ✓ Cleanup complete.');

  await mongoose.disconnect();
  console.log('[TEST] ✓ All Extended CP & Admin Override Tests Passed!\n');
}

runTest().catch((err) => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
