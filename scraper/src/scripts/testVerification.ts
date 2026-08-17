/**
 * scripts/testVerification.ts
 * Tests strict live internship verification and publish gate logic.
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { InternshipScraped } from '../models/Internship.js';
import { verifyAndPromoteDrafts, recheckPublishedInternships } from '../services/internshipVerifier.js';
import { generateInternshipFingerprint } from '../pipeline/deduplicator.js';

async function test() {
  await mongoose.connect(config.mongoUri);
  console.log('[TEST] Connected to MongoDB');

  const dummyUnivId = new mongoose.Types.ObjectId();

  // Test Case 1: Expired deadline (must stay EXPIRED, never PUBLISHED)
  const expiredFP = generateInternshipFingerprint(dummyUnivId.toString(), 'Dr. Test Past', 'Past Drone Project', 'https://rvce.edu.in');
  await InternshipScraped.updateOne(
    { fingerprint: expiredFP },
    {
      $set: {
        universityId: dummyUnivId,
        universityName: 'RV College of Engineering',
        facultyName: 'Dr. Test Past',
        projectName: 'Past Drone Project',
        projectDetails: 'Expired position details',
        compensation: { status: 'PAID', amount: 15000, currency: 'INR', raw: '₹15,000/month' },
        deadline: '2020-01-01', // Past deadline
        source: { url: 'https://rvce.edu.in', type: 'official', lastVerified: new Date() },
        confidence: 0.9,
        publishStatus: 'DRAFT',
        fingerprint: expiredFP,
      },
    },
    { upsert: true }
  );

  // Run verification
  console.log('[TEST] Running verifyAndPromoteDrafts()...');
  const res = await verifyAndPromoteDrafts();
  console.log('[TEST] Verification Result:', res);

  // Check status of expired test entry
  const checkExpired = await InternshipScraped.findOne({ fingerprint: expiredFP });
  console.log('[TEST] Expired Entry Status:', checkExpired?.publishStatus, '(Expected: EXPIRED)');

  // Clean up test entry
  await InternshipScraped.deleteOne({ fingerprint: expiredFP });
  const db = mongoose.connection.db;
  if (db) await db.collection('internships').deleteOne({ fingerprint: expiredFP });

  console.log('[TEST] Verification test complete!');
  await mongoose.disconnect();
}

test().catch(console.error);
