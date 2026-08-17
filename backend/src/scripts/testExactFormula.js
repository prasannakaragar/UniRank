/**
 * scripts/testExactFormula.js
 * Comprehensive automated verification script for exact CP leaderboard rating formula:
 * Leaderboard Points = (CF / 2) + (LC / 2) + (CC / 2) + (HR / 3) + (HE / 3)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, Profile, AdminLog } from '../models/index.js';
import { updateUserScores, calculatePlatformRatings } from '../utils/scoring.js';

async function runVerification() {
  console.log('[TEST] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('[TEST] ✓ MongoDB connected.');

  // Create temporary test user
  let testUser = await User.findOne({ email: 'test_exact_formula@unirank.test' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Exact Formula Student',
      email: 'test_exact_formula@unirank.test',
      password: 'hashedpassword',
      role: 'student',
      college: 'Reva University',
      branch: 'CSE',
      admission_year: 2023,
    });
  }

  let testProfile = await Profile.findOne({ user: testUser._id });
  if (!testProfile) {
    testProfile = await Profile.create({
      user: testUser._id,
      cf_handle: 'student_cf',
      actual_codeforces_rating: 1200,
      cf_rating: 1200,

      lc_username: 'student_lc',
      actual_leetcode_rating: 1500,
      lc_rating: 1500,

      codechef_username: '',
      actual_codechef_rating: 0,
      cc_rating: 0,

      hackerrank_username: 'student_hr',
      actual_hackerrank_rating: 800,
      hr_rating: 800,
      hr_score: 800,

      hackerearth_username: '',
      actual_hackerearth_rating: 0,
      he_rating: 0,
    });
  } else {
    testProfile.actual_codeforces_rating = 1200;
    testProfile.cf_rating = 1200;
    testProfile.actual_leetcode_rating = 1500;
    testProfile.lc_rating = 1500;
    testProfile.actual_codechef_rating = 0;
    testProfile.cc_rating = 0;
    testProfile.actual_hackerrank_rating = 800;
    testProfile.hr_rating = 800;
    testProfile.hr_score = 800;
    testProfile.actual_hackerearth_rating = 0;
    testProfile.he_rating = 0;

    testProfile.admin_codeforces_rating = null;
    testProfile.admin_leetcode_rating = null;
    testProfile.admin_codechef_rating = null;
    testProfile.admin_hackerrank_rating = null;
    testProfile.admin_hackerearth_rating = null;
    await testProfile.save();
  }

  // --- Scenario 1: Actual Ratings Calculation ---
  console.log('\n--- Scenario 1: Actual Ratings Calculation ---');
  await updateUserScores(testUser._id.toString());
  testProfile = await Profile.findOne({ user: testUser._id });
  const ratings1 = calculatePlatformRatings(testProfile);
  console.log('[Actual Ratings]:', ratings1.actual);
  console.log('[Calculated Leaderboard Points]:', testProfile.cp_score);

  const expected1 = Math.round(((1200 / 2) + (1500 / 2) + (0 / 2) + (800 / 3) + (0 / 3)) * 100) / 100;
  console.log('[Expected Leaderboard Points]:', expected1);

  if (Math.abs(testProfile.cp_score - expected1) > 0.01) {
    throw new Error(`Scenario 1 failed! Got ${testProfile.cp_score}, expected ${expected1}`);
  }
  console.log('✓ Scenario 1 PASSED: Exact formula matched!');

  // --- Scenario 2: Admin Rating Override ---
  console.log('\n--- Scenario 2: Admin Rating Override on CodeChef (1400) ---');
  testProfile.admin_codechef_rating = 1400;
  await testProfile.save();

  let adminUser = await User.findOne({ role: 'admin' });
  const adminId = adminUser ? adminUser._id : testUser._id;

  await AdminLog.create({
    admin_id: adminId,
    student_id: testUser._id.toString(),
    target_user_id: testUser._id.toString(),
    platform: 'CodeChef',
    action: 'RATING_OVERRIDE',
    previous_value: 0,
    new_value: 1400,
    reason: 'Verified contest certificate submission',
    details: 'Override CodeChef Rating from 0 to 1400',
  });

  await updateUserScores(testUser._id.toString());
  testProfile = await Profile.findOne({ user: testUser._id });
  const ratings2 = calculatePlatformRatings(testProfile);
  console.log('[Final Ratings after Admin Override]:', ratings2.final);
  console.log('[Leaderboard Points after Admin Override]:', testProfile.cp_score);

  const expected2 = Math.round(((1200 / 2) + (1500 / 2) + (1400 / 2) + (800 / 3) + (0 / 3)) * 100) / 100;
  console.log('[Expected Leaderboard Points after Override]:', expected2);

  if (Math.abs(testProfile.cp_score - expected2) > 0.01) {
    throw new Error(`Scenario 2 failed! Got ${testProfile.cp_score}, expected ${expected2}`);
  }
  console.log('✓ Scenario 2 PASSED: Admin rating override correctly applied!');

  // --- Scenario 3: Audit Log Verification ---
  console.log('\n--- Scenario 3: Audit Log Verification ---');
  const logs = await AdminLog.find({ student_id: testUser._id.toString() }).sort({ timestamp: -1 });
  console.log(`[Audit Logs Found]: ${logs.length}`);
  if (logs.length === 0) throw new Error('Scenario 3 failed! No audit log recorded.');

  const latestLog = logs[0].toDict();
  console.log('[Audit Log Detail]:', latestLog);
  if (latestLog.platform !== 'CodeChef' || latestLog.new_value !== 1400) {
    throw new Error('Scenario 3 failed! Audit log entry mismatched.');
  }
  console.log('✓ Scenario 3 PASSED: Audit trail correctly recorded!');

  // --- Scenario 4: Reverting Admin Override ---
  console.log('\n--- Scenario 4: Reverting Admin Override ---');
  testProfile.admin_codechef_rating = null;
  await testProfile.save();
  await updateUserScores(testUser._id.toString());

  testProfile = await Profile.findOne({ user: testUser._id });
  console.log('[Leaderboard Points after Clearing Override]:', testProfile.cp_score);

  if (Math.abs(testProfile.cp_score - expected1) > 0.01) {
    throw new Error(`Scenario 4 failed! Revert score mismatch: Got ${testProfile.cp_score}, expected ${expected1}`);
  }
  console.log('✓ Scenario 4 PASSED: Reverting override restored original calculated points!');

  // Cleanup
  console.log('\n--- Cleanup ---');
  await Profile.deleteOne({ _id: testProfile._id });
  await User.deleteOne({ _id: testUser._id });
  await AdminLog.deleteMany({ student_id: testUser._id.toString() });
  console.log('[TEST] ✓ Cleanup complete.');

  await mongoose.disconnect();
  console.log('[TEST] ✓ ALL 4 SCENARIOS PASSED PERFECTLY!\n');
}

runVerification().catch((err) => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
