/**
 * scripts/migrateAcademicYear.js — UniRank
 * Idempotent, safe migration script to backfill admissionYear on existing user records
 * and transition from static year to dynamic July-rollover academic year tracking.
 *
 * Special feature: Automatically extracts exact admission year from university email roll patterns
 * (e.g. pavanr24@iiserb.ac.in -> 2024, 1ms23is060@msrit.edu -> 2023, ugcet25... -> 2025, 22at1a... -> 2022).
 *
 * Usage:
 *   node src/scripts/migrateAcademicYear.js --dry-run   (Prints before/after table without writing DB)
 *   node src/scripts/migrateAcademicYear.js --commit    (Writes admission_year to all user records)
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User } from '../models/index.js';
import {
  getCurrentAcademicSession,
  getCurrentYearOfStudy,
  deriveAdmissionYearForMigration,
} from '../utils/academicYear.js';
import mongoose from 'mongoose';

dotenv.config();

// Explicit manual overrides for specific users if needed
const MANUAL_ADMISSION_OVERRIDES = {
  'pavanr24@iiserb.ac.in': 2024,
  'prajwalnk996325@kgpian.iitkgp.ac.in': 2025,
};

function extractAdmissionYearFromEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (MANUAL_ADMISSION_OVERRIDES[cleanEmail]) {
    return MANUAL_ADMISSION_OVERRIDES[cleanEmail];
  }

  // Regex patterns for Indian university email roll numbers:
  // pavanr24 -> 2024
  // 1ms23is060 -> 2023
  // ugcet2502059 -> 2025
  // pes1ug25cs393 -> 2025
  // 25ug1bycs0501 -> 2025
  // 22at1a3187 -> 2022
  // vishalsubhash.cs25 -> 2025
  const patterns = [
    /(?:ugcet|pgcet|cs|am|is|ee|ec|me|cv|at1a|ug|bycs)([0-2][0-9])/i, // e.g. ugcet25, cs25, 2300, 22at1a
    /^([0-2][0-9])[a-z]/i,                                           // e.g. 22at1a, 25ug1
    /1ms([0-2][0-9])/i,                                              // e.g. 1ms23
    /pes[0-9]ug([0-2][0-9])/i,                                       // e.g. pes1ug25
    /r([0-2][0-9])@/i,                                               // e.g. pavanr24@
  ];

  for (const pat of patterns) {
    const match = cleanEmail.match(pat);
    if (match && match[1]) {
      const yy = parseInt(match[1], 10);
      if (yy >= 15 && yy <= 30) {
        return 2000 + yy;
      }
    }
  }

  return null;
}

async function runMigration() {
  await connectDB();

  const args = process.argv.slice(2);
  const isCommit = args.includes('--commit');
  const isDryRun = args.includes('--dry-run') || !isCommit;

  const currentSession = getCurrentAcademicSession();
  console.log(`\n==================================================`);
  console.log(`  UniRank Academic Year Migration Engine`);
  console.log(`  Current Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`  Current Academic Session: ${currentSession}`);
  console.log(`  Mode: ${isDryRun ? '🔍 DRY-RUN (No DB modifications)' : '🚀 COMMIT (Writing to DB)'}`);
  console.log(`==================================================\n`);

  const users = await User.find().sort({ created_at: 1 });
  console.log(`Total user records found: ${users.length}\n`);

  const report = [];

  for (const user of users) {
    let admissionYear = user.admission_year;

    if (!admissionYear) {
      // 1. Try extracting exact admission year from email roll pattern
      const emailYear = extractAdmissionYearFromEmail(user.email);
      if (emailYear) {
        admissionYear = emailYear;
      } else {
        // 2. Fallback to stale static year derivation
        const storedYear = user.year || 1;
        admissionYear = deriveAdmissionYearForMigration(storedYear);
      }
    }

    const newYearInfo = getCurrentYearOfStudy(admissionYear);

    report.push({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      old_static_year: user.year != null ? `Year ${user.year}` : 'N/A',
      admission_year: admissionYear,
      new_computed_year: newYearInfo.displayString,
      status: newYearInfo.isAlumni ? '🎓 Alumni' : '📚 Active Student',
    });

    if (!isDryRun) {
      await User.updateOne({ _id: user._id }, { $set: { admission_year: admissionYear } });
    }
  }

  // Print formatted table
  console.table(
    report.map((r) => ({
      Name: r.name,
      Email: r.email,
      'Old Static Year': r.old_static_year,
      'Derived Admission Year': r.admission_year,
      'New Computed Year': r.new_computed_year,
      Status: r.status,
    }))
  );

  console.log(`\n==================================================`);
  if (isDryRun) {
    console.log(`  🔍 DRY-RUN COMPLETE.`);
    console.log(`  0 records modified in MongoDB.`);
    console.log(`  Run with --commit to execute database writes.`);
  } else {
    console.log(`  🚀 COMMIT COMPLETE.`);
    console.log(`  Successfully updated ${users.length} user records with admission_year.`);
  }
  console.log(`==================================================\n`);

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
