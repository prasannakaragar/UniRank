/**
 * scripts/phase0Cleanup.js
 *
 * Phase 0 cleanup: drops orphaned collections and truncates fake internship data.
 *
 * Drops:
 *   - crawler_logs (fake daemon logs)
 *   - scrape_logs (old scraper pipeline logs)
 *
 * Truncates:
 *   - internships (all docs are randomly generated fakes)
 *
 * Does NOT touch:
 *   - colleges (existing college docs are valid, scrapedData/scrapeMeta ignored)
 *   - users, profiles, etc. (untouched)
 *
 * Usage: node src/scripts/phase0Cleanup.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unirank';

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  UniRank — Phase 0 Data Cleanup                   ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log();

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('[DB] Connected to MongoDB');

  const db = mongoose.connection.db;

  // ── Drop orphaned collections ─────────────────────────────────────
  const collectionsToDrop = ['crawler_logs', 'scrape_logs'];

  for (const name of collectionsToDrop) {
    try {
      const exists = await db.listCollections({ name }).hasNext();
      if (exists) {
        await db.dropCollection(name);
        console.log(`  ✓ Dropped collection: ${name}`);
      } else {
        console.log(`  ○ Collection ${name} does not exist — skipping`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to drop ${name}: ${err.message}`);
    }
  }

  // ── Truncate fake internship data ────────────────────────────────
  try {
    const internshipsCollection = db.collection('internships');
    const count = await internshipsCollection.countDocuments();
    if (count > 0) {
      await internshipsCollection.deleteMany({});
      console.log(`  ✓ Deleted ${count} fake internship documents from 'internships'`);
    } else {
      console.log(`  ○ 'internships' collection is already empty`);
    }
  } catch (err) {
    console.error(`  ✗ Failed to truncate internships: ${err.message}`);
  }

  console.log();
  console.log('[Done] Phase 0 data cleanup complete.');
  console.log('  - Old scraper collections dropped');
  console.log('  - Fake internship data removed');
  console.log('  - College docs untouched (scrapedData/scrapeMeta left stale)');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
