/**
 * scripts/seedKarnataka.ts
 *
 * Populates the MongoDB 'universities' collection with the Karnataka
 * engineering colleges seed list.
 *
 * Sets:
 *  - scrapingAllowed = true for verified websites (gated pilot)
 *  - scrapeStatus = 'pending'
 *  - tier.label = 'UNIRANK_DERIVED'
 *
 * Usage:
 *   npx tsx src/scripts/seedKarnataka.ts
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { KARNATAKA_ENGINEERING_COLLEGES, getSeedStats } from '../config/seed/karnataka-engineering.js';
import { University } from '../models/University.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('SEED');

async function seed() {
  log.info('Connecting to MongoDB...');
  await mongoose.connect(config.mongoUri);

  const stats = getSeedStats();
  log.info(`Seed Stats: ${stats.total} total colleges (${stats.verified} verified URLs, ${stats.unverified} unverified)`);

  let added = 0;
  let updated = 0;

  for (const item of KARNATAKA_ENGINEERING_COLLEGES) {
    const existing = await University.findOne({ name: item.name, city: item.city });

    if (existing) {
      existing.officialWebsite = item.officialWebsite;
      existing.websiteVerified = item.websiteVerified;
      existing.institutionType = item.institutionType;
      existing.affiliatedTo = item.affiliatedTo;
      existing.scrapingAllowed = item.websiteVerified; // Allow scraping if official website is verified
      await existing.save();
      updated++;
    } else {
      await University.create({
        name: item.name,
        officialWebsite: item.officialWebsite,
        websiteVerified: item.websiteVerified,
        city: item.city,
        state: 'Karnataka',
        country: 'India',
        institutionType: item.institutionType,
        affiliatedTo: item.affiliatedTo,
        scrapingAllowed: item.websiteVerified,
        scrapeStatus: 'pending',
      });
      added++;
    }
  }

  log.success(`Seeding complete: ${added} added, ${updated} updated.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  log.error(`Seeding failed: ${err.message}`);
  process.exit(1);
});
