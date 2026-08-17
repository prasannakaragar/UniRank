/**
 * scripts/checkDb.ts
 * Inspects DB collections after scraping.
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { University } from '../models/University.js';
import { ScrapeJob } from '../models/ScrapeJob.js';
import { SourcePage } from '../models/SourcePage.js';
import { Placement } from '../models/Placement.js';
import { NirfRanking } from '../models/NirfRanking.js';
import { DataReview } from '../models/DataReview.js';

async function check() {
  await mongoose.connect(config.mongoUri);

  const univCount = await University.countDocuments();
  const jobCount = await ScrapeJob.countDocuments();
  const pageCount = await SourcePage.countDocuments();
  const placementCount = await Placement.countDocuments();
  const nirfCount = await NirfRanking.countDocuments();
  const reviewCount = await DataReview.countDocuments();

  console.log('════════════════════════════════════════════════════');
  console.log('  UniRank Database Status');
  console.log('════════════════════════════════════════════════════');
  console.log(`  Universities (seeded) : ${univCount}`);
  console.log(`  Scrape Jobs           : ${jobCount}`);
  console.log(`  Source Pages (cached) : ${pageCount}`);
  console.log(`  Placements            : ${placementCount}`);
  console.log(`  NIRF Rankings         : ${nirfCount}`);
  console.log(`  Pending Reviews       : ${reviewCount}`);
  console.log('════════════════════════════════════════════════════');

  const placements = await Placement.find().populate('universityId', 'name city');
  if (placements.length > 0) {
    console.log('\nExtracted Placement Records:');
    console.log(JSON.stringify(placements, null, 2));
  }

  await mongoose.disconnect();
}

check().catch(console.error);
