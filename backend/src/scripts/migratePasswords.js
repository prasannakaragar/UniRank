/**
 * scripts/migratePasswords.js
 * Password migration script to convert plain-text passwords to bcrypt hashes.
 * Usage: node src/scripts/migratePasswords.js [--dry-run]
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, PendingUser } from '../models/index.js';
import { isBcryptHash, isWerkzeugHash, hashPassword } from '../utils/password.js';
import mongoose from 'mongoose';

dotenv.config();

async function migrateCollection(modelClass, label, dryRun) {
  const summary = {
    total: 0,
    skipped_bcrypt: 0,
    skipped_werkzeug: 0,
    migrated: 0,
    errors: 0,
    plain_text_found: 0,
  };

  console.log(`\n${'='.repeat(62)}`);
  console.log(`  Migrating collection : ${label}`);
  console.log(`  Dry-run mode         : ${dryRun}`);
  console.log(`${'='.repeat(62)}`);

  const docs = await modelClass.find();
  summary.total = docs.length;
  console.log(`  Found ${summary.total} document(s) to inspect.\n`);

  for (const doc of docs) {
    const email = doc.email || '<unknown>';
    const rawPassword = doc.password;

    if (!rawPassword) {
      console.log(`  [SKIP-EMPTY]       ${email}  — password field is empty`);
      summary.skipped_bcrypt++;
      continue;
    }

    if (isBcryptHash(rawPassword)) {
      console.log(`  [SKIP-BCRYPT]      ${email}  — already a bcrypt hash`);
      summary.skipped_bcrypt++;
      continue;
    }

    if (isWerkzeugHash(rawPassword)) {
      console.log(`  [SKIP-WERKZEUG]    ${email}  — Werkzeug PBKDF2 hash (cannot re-hash without original password)`);
      summary.skipped_werkzeug++;
      continue;
    }

    summary.plain_text_found++;

    try {
      const hashed = hashPassword(rawPassword);
      if (dryRun) {
        console.log(`  [DRY-RUN-MIGRATE]  ${email}  — would hash plain-text password`);
        summary.migrated++;
      } else {
        doc.password = hashed;
        await doc.save();
        console.log(`  [MIGRATED]         ${email}  — plain-text -> bcrypt`);
        summary.migrated++;
      }
    } catch (exc) {
      console.log(`  [ERROR]            ${email}  — hashing failed: ${exc.message}`);
      summary.errors++;
    }
  }

  return summary;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startedAt = new Date();

  console.log('\n' + '#'.repeat(62));
  console.log('  UniRank - Password Migration Script');
  console.log(`  Started at : ${startedAt.toISOString()}`);
  if (dryRun) console.log('  [!] DRY-RUN mode - NO changes will be written to the DB');
  console.log('#'.repeat(62));

  await connectDB();

  const usersSummary = await migrateCollection(User, 'users', dryRun);
  const pendingSummary = await migrateCollection(PendingUser, 'pending_users', dryRun);

  const finishedAt = new Date();
  const elapsed = (finishedAt.getTime() - startedAt.getTime()) / 1000;

  console.log('\n' + '='.repeat(75));
  console.log('  MIGRATION COMPLETE');
  console.log(`  Finished at  : ${finishedAt.toISOString()}`);
  console.log(`  Elapsed      : ${elapsed.toFixed(2)}s`);
  console.log('-'.repeat(75));
  console.log('  Collection       | Total | Skip-bcrypt | Skip-wz | Migrated | Errors');
  console.log('-'.repeat(75));

  const formatRow = (label, s) =>
    `  ${label.padEnd(16)} | ${String(s.total).padStart(5)} | ${String(s.skipped_bcrypt).padStart(9)} | ${String(s.skipped_werkzeug).padStart(8)} | ${String(s.migrated).padStart(8)} | ${String(s.errors).padStart(6)}`;

  console.log(formatRow('users', usersSummary));
  console.log(formatRow('pending_users', pendingSummary));
  console.log('='.repeat(75));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
