/**
 * scripts/runOnce.js
 *
 * CLI tool to run the scraper pipeline for a single college end-to-end.
 * No BullMQ, no Redis required — useful for testing and debugging.
 *
 * Usage:
 *   node src/scripts/runOnce.js --college "IIT Bombay" --categories placements,admissions
 *   node src/scripts/runOnce.js --college "VIT Vellore" --categories placements --verbose
 *   node src/scripts/runOnce.js --college "REVA University" --categories basicInfo
 *
 * Options:
 *   --college <name>          College name (partial match, case-insensitive)
 *   --domain <domain>         Exact domain (alternative to --college)
 *   --categories <list>       Comma-separated: placements,admissions,basicInfo,academics
 *                             Defaults to: placements,admissions
 *   --verbose                 Print detailed per-step output
 *   --dry-run                 Crawl and extract but do NOT write to MongoDB
 */

import { connectDB, disconnectDB } from '../db/connection.js';
import { runScrapeJob } from '../pipeline/scrapeJob.js';
import { closeBrowser } from '../crawler/playwrightCrawler.js';
import { findCollegeByName, getCollegeByDomain, COLLEGES } from '../config/colleges.js';
import { CATEGORIES } from '../schemas/index.js';

// ── Arg parsing ───────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    college: null,
    domain: null,
    categories: ['placements', 'admissions'],
    verbose: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--college':
        opts.college = args[++i];
        break;
      case '--domain':
        opts.domain = args[++i];
        break;
      case '--categories':
        opts.categories = args[++i]
          .split(',')
          .map((c) => c.trim())
          .filter((c) => CATEGORIES.includes(c));
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
    }
  }

  return opts;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  // ── Find the college ──────────────────────────────────────────────────────
  let collegeDef = null;

  if (opts.domain) {
    collegeDef = getCollegeByDomain(opts.domain);
    if (!collegeDef) {
      console.error(`❌ No college found for domain: ${opts.domain}`);
      console.log('Available domains:', COLLEGES.map((c) => c.domain).join(', '));
      process.exit(1);
    }
  } else if (opts.college) {
    collegeDef = findCollegeByName(opts.college);
    if (!collegeDef) {
      console.error(`❌ No college found matching: "${opts.college}"`);
      console.log('Available colleges:', COLLEGES.map((c) => c.name).join(', '));
      process.exit(1);
    }
  } else {
    console.error('❌ Provide --college <name> or --domain <domain>');
    console.log('\nUsage:');
    console.log('  node src/scripts/runOnce.js --college "IIT Bombay" --categories placements,admissions');
    process.exit(1);
  }

  if (opts.categories.length === 0) {
    console.error('❌ No valid categories specified. Valid: ' + CATEGORIES.join(', '));
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  UniRank Scraper — runOnce.js`);
  console.log(`║  College   : ${collegeDef.name}`);
  console.log(`║  Domain    : ${collegeDef.domain}`);
  console.log(`║  Tier      : ${collegeDef.tier} (${collegeDef.type})`);
  console.log(`║  Categories: ${opts.categories.join(', ')}`);
  console.log(`║  Dry run   : ${opts.dryRun}`);
  console.log('╚════════════════════════════════════════════════════╝\n');

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  if (!opts.dryRun) {
    try {
      await connectDB();
    } catch (err) {
      console.error('❌ MongoDB connection failed:', err.message);
      console.error('   Make sure MONGODB_URI is set in your .env file');
      process.exit(1);
    }
  } else {
    console.log('⚠  Dry-run mode: MongoDB upsert will be skipped\n');
  }

  // ── Run the pipeline ──────────────────────────────────────────────────────
  let result;
  try {
    if (opts.dryRun) {
      // In dry-run mode, only run crawl + extraction, skip upsert
      const { fetchPage } = await import('../crawler/playwrightCrawler.js');
      const { extractCategory } = await import('../extractor/llmExtractor.js');
      const { CATEGORY_REGISTRY } = await import('../schemas/index.js');

      for (const cat of opts.categories) {
        const targetUrl = collegeDef.urls[cat] ?? collegeDef.urls.home;
        console.log(`\n[dry-run] Fetching: ${targetUrl}`);
        const { text, finalUrl } = await fetchPage(targetUrl);
        console.log(`[dry-run] Got ${text.length} chars from ${finalUrl}`);

        console.log(`[dry-run] Extracting category: ${cat}...`);
        const exResult = await extractCategory(text, cat, collegeDef);
        console.log(`[dry-run] Confidence: ${exResult.confidenceScore.toFixed(2)}`);
        console.log('[dry-run] Extracted data:\n', JSON.stringify(exResult.data, null, 2));
        if (exResult.validationError) {
          console.warn('[dry-run] Validation error:', exResult.validationError);
        }
      }

      result = { success: true, status: 'dry-run-complete', overallConfidence: -1 };
    } else {
      result = await runScrapeJob({
        collegeDef,
        categories: opts.categories,
        verbose: opts.verbose,
        jobId: null,
      });
    }
  } catch (err) {
    console.error('\n❌ Scrape pipeline threw an unhandled error:');
    console.error('  ', err.message);
    if (opts.verbose) console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
    if (!opts.dryRun) await disconnectDB();
  }

  if (result) {
    console.log('\n─────────────────── Result ───────────────────────────');
    console.log(`  Status         : ${result.status}`);
    if (result.overallConfidence >= 0) {
      console.log(`  Confidence     : ${result.overallConfidence.toFixed(2)}`);
    }
    if (result.categoriesExtracted?.length > 0) {
      console.log(`  Extracted      : ${result.categoriesExtracted.join(', ')}`);
    }
    if (result.categoriesSkipped?.length > 0) {
      console.log(`  Skipped (unchanged) : ${result.categoriesSkipped.join(', ')}`);
    }
    if (result.errors?.length > 0) {
      console.log(`  Errors         : ${result.errors.join('; ')}`);
    }

    if (result.college) {
      console.log(`  MongoDB doc    : ${result.college._id}`);
      console.log(`  scrapeMeta     : ${JSON.stringify(result.college.scrapeMeta, null, 2)}`);
    }
    console.log('──────────────────────────────────────────────────────\n');

    // Exit code 1 if needs_review so CI can flag it
    if (result.status === 'failed') process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
