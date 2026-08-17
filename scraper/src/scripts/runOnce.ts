/**
 * scripts/runOnce.ts
 *
 * CLI tool to run the scraper pipeline end-to-end for a single university.
 * Useful for debugging and testing single institutions.
 *
 * Usage:
 *   npx tsx src/scripts/runOnce.ts --university "RV College of Engineering"
 *   npx tsx src/scripts/runOnce.ts --all
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { University } from '../models/University.js';
import { scrapeUniversity } from '../pipeline/scrapeOrchestrator.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RUN-ONCE');

async function main() {
  const args = process.argv.slice(2);
  let univName: string | null = null;
  let runAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--university' || args[i] === '-u') {
      univName = args[++i];
    } else if (args[i] === '--all') {
      runAll = true;
    }
  }

  if (!univName && !runAll) {
    console.log('Usage:');
    console.log('  npx tsx src/scripts/runOnce.ts --university "RV College of Engineering"');
    console.log('  npx tsx src/scripts/runOnce.ts --all');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  log.info('Connected to MongoDB');

  if (runAll) {
    const universities = await University.find({ scrapingAllowed: true });
    log.info(`Found ${universities.length} universities marked for scraping`);

    for (const univ of universities) {
      log.info(`\n========================================`);
      log.info(`Starting batch run for: ${univ.name}`);
      log.info(`========================================`);
      const res = await scrapeUniversity(univ, 'manual');
      log.info(`Result: ${res.status} (${res.dataExtracted} data points, ${res.errors.length} errors)`);
    }
  } else if (univName) {
    const univ = await University.findOne({
      name: new RegExp(univName, 'i'),
    });

    if (!univ) {
      log.error(`University not found matching "${univName}"`);
      process.exit(1);
    }

    log.info(`Found university: ${univ.name} (${univ.officialWebsite || 'No website'})`);
    
    // Ensure scrapingAllowed is temporarily enabled if testing a single univ
    if (!univ.scrapingAllowed && univ.officialWebsite) {
      log.info(`Enabling scrapingAllowed temporarily for test run...`);
      univ.scrapingAllowed = true;
    }

    const res = await scrapeUniversity(univ, 'manual');
    console.log('\nFinal Scrape Result:', JSON.stringify(res, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  log.error(`Run failed: ${err.message}`);
  process.exit(1);
});
