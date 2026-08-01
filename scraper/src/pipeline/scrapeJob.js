/**
 * pipeline/scrapeJob.js
 *
 * Core pipeline orchestrator — runs for one college, one or more categories.
 *
 * Flow:
 *   1. Fetch pages for each requested category URL
 *   2. Check content hash → skip LLM extraction if unchanged (cost saving)
 *   3. Save raw HTML snapshots to storage
 *   4. LLM extraction per category
 *   5. Zod validation (inside llmExtractor)
 *   6. MongoDB upsert with scrapeMeta block
 *
 * Returns a structured result object (used by runOnce.js and BullMQ worker).
 */

import { fetchPage } from '../crawler/playwrightCrawler.js';
import { extractCategories } from '../extractor/llmExtractor.js';
import { saveSnapshot } from '../storage/snapshotStore.js';
import { isUnchanged } from './contentHash.js';
import { upsertCollegeData, recordScrapeFailure } from '../db/upsert.js';
import College from '../db/College.model.js';
import { CATEGORIES } from '../schemas/index.js';

/**
 * Run the full scrape pipeline for one college.
 *
 * @param {{
 *   collegeDef: import('../config/colleges.js').College,
 *   categories?: string[],  // subset of CATEGORIES; defaults to all 4
 *   jobId?: string | null,
 *   verbose?: boolean,
 * }} params
 *
 * @returns {Promise<{
 *   success: boolean,
 *   college: object | null,
 *   overallConfidence: number,
 *   status: string,
 *   categoriesSkipped: string[],   // skipped (content unchanged)
 *   categoriesExtracted: string[], // actually sent to LLM
 *   errors: string[],
 * }>}
 */
export async function runScrapeJob({
  collegeDef,
  categories = [...CATEGORIES],
  jobId = null,
  verbose = false,
}) {
  const { name, domain, urls } = collegeDef;
  const log = (msg) => console.log(`[Pipeline:${domain}] ${msg}`);
  const warn = (msg) => console.warn(`[Pipeline:${domain}] ⚠ ${msg}`);

  const categoriesSkipped = [];
  const categoriesExtracted = [];
  const errors = [];

  // ── Load existing content hashes from MongoDB ────────────────────────────
  let existingHashes = {};
  try {
    const existing = await College.findOne({ domain }, { 'scrapeMeta.contentHash': 1 });
    existingHashes = existing?.scrapeMeta?.contentHash ?? {};
  } catch (err) {
    warn(`Could not load existing hashes: ${err.message}`);
  }

  // ── Fetch pages per category ─────────────────────────────────────────────
  const pageTexts = {};
  const sourceUrls = {};

  for (const cat of categories) {
    const targetUrl = urls[cat] ?? urls.home;
    if (!targetUrl) {
      warn(`No URL configured for category ${cat} — skipping`);
      errors.push(`No URL for category: ${cat}`);
      continue;
    }

    log(`Fetching ${cat} page: ${targetUrl}`);
    try {
      const { text, finalUrl } = await fetchPage(targetUrl);
      pageTexts[cat] = text;
      sourceUrls[cat] = finalUrl;
      sourceUrls.home = urls.home ?? finalUrl;

      if (verbose) log(`  Fetched ${text.length} chars from ${finalUrl}`);
    } catch (err) {
      warn(`Fetch failed for ${cat} (${targetUrl}): ${err.message}`);
      errors.push(`${cat}: ${err.message}`);
      // Continue with other categories — partial extraction is better than none
    }
  }

  if (Object.keys(pageTexts).length === 0) {
    warn('No pages fetched successfully — recording failure');
    await recordScrapeFailure(domain, new Error('All category pages failed to fetch'), jobId);
    return {
      success: false,
      college: null,
      overallConfidence: 0,
      status: 'failed',
      categoriesSkipped: [],
      categoriesExtracted: [],
      errors,
    };
  }

  // ── Save raw snapshots ────────────────────────────────────────────────────
  for (const [cat, text] of Object.entries(pageTexts)) {
    try {
      const snap = saveSnapshot(domain, cat, text);
      if (verbose) log(`  Snapshot saved: ${snap.filePath} (${snap.sizeBytes} bytes)`);
    } catch (err) {
      warn(`Snapshot save failed for ${cat}: ${err.message}`);
    }
  }

  // ── Content-hash change detection ─────────────────────────────────────────
  const categoriesToExtract = [];
  for (const cat of Object.keys(pageTexts)) {
    if (isUnchanged(pageTexts[cat], existingHashes[cat])) {
      log(`  ↩ ${cat}: content unchanged since last scrape — skipping LLM extraction`);
      categoriesSkipped.push(cat);
    } else {
      categoriesToExtract.push(cat);
    }
  }

  // ── LLM extraction ────────────────────────────────────────────────────────
  let categoryResults = {};

  if (categoriesToExtract.length > 0) {
    log(`Extracting ${categoriesToExtract.join(', ')} via Gemini...`);
    categoryResults = await extractCategories(
      pageTexts,
      categoriesToExtract,
      { name, domain }
    );
    categoriesExtracted.push(...categoriesToExtract);

    if (verbose) {
      for (const [cat, result] of Object.entries(categoryResults)) {
        log(`  ${cat}: confidence=${result.confidenceScore.toFixed(2)}${result.validationError ? `, validation_error=${result.validationError.slice(0, 80)}` : ''}`);
      }
    }
  } else {
    log('All categories unchanged — no LLM extraction needed');
  }

  // ── MongoDB upsert ────────────────────────────────────────────────────────
  if (Object.keys(categoryResults).length === 0 && categoriesSkipped.length > 0) {
    // Everything was skipped — update lastScrapedAt but don't re-extract
    log('Updating lastScrapedAt (content unchanged)');
    await College.findOneAndUpdate(
      { domain },
      { $set: { 'scrapeMeta.lastScrapedAt': new Date(), last_scraped_at: new Date() } }
    );
    return {
      success: true,
      college: null,
      overallConfidence: -1, // sentinel: "no extraction, all cached"
      status: 'stale',
      categoriesSkipped,
      categoriesExtracted: [],
      errors,
    };
  }

  const { college, overallConfidence, status } = await upsertCollegeData({
    collegeDef,
    categoryResults,
    pageTexts,
    sourceUrls,
    jobId,
  });

  log(`✅ Done: status=${status}, confidence=${overallConfidence.toFixed(2)}`);

  return {
    success: true,
    college,
    overallConfidence,
    status,
    categoriesSkipped,
    categoriesExtracted,
    errors,
  };
}
