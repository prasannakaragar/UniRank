/**
 * db/upsert.js
 *
 * Idempotent MongoDB upsert for scraped college data.
 *
 * Uses domain as the idempotency key (unique field in the colleges collection).
 * Re-running a scrape safely overwrites — never creates duplicates.
 *
 * What gets written:
 *   - scrapedData.[category] ← Zod-validated extraction result
 *   - scrapeMeta             ← full updated metadata block
 *   - last_scraped_at        ← top-level field (legacy, kept for backward compat)
 *   - Existing flat fields (highest_package, etc.) are NOT overwritten here.
 *     The scraper writes structured data; the backend API continues serving flat fields.
 *     A separate "sync" step (Phase 4) will copy structured → flat fields.
 */

import College from './College.model.js';
import ScrapeLog from './ScrapeLog.model.js';
import { computeHash } from '../pipeline/contentHash.js';

/**
 * Upsert scraped data for one college.
 *
 * @param {{
 *   collegeDef: import('../config/colleges.js').College,
 *   categoryResults: Record<string, { data: object, confidenceScore: number, rawResponse: string, validationError: string | null }>,
 *   pageTexts: Record<string, string>,     // raw texts (for content hash)
 *   sourceUrls: Record<string, string>,    // actual fetched URLs per category
 *   jobId: string | null,
 * }} params
 * @returns {Promise<{ college: object, overallConfidence: number, status: string }>}
 */
export async function upsertCollegeData({
  collegeDef,
  categoryResults,
  pageTexts,
  sourceUrls,
  jobId = null,
}) {
  const { domain, name, tier, type: collegeType } = collegeDef;

  // ── Compute content hashes ────────────────────────────────────────────────
  const contentHash = {};
  for (const [cat, text] of Object.entries(pageTexts)) {
    if (text) contentHash[cat] = computeHash(text);
  }

  // ── Compute overall confidence (average of category scores) ───────────────
  const scores = Object.values(categoryResults)
    .map((r) => r.confidenceScore)
    .filter((s) => typeof s === 'number');
  const overallConfidence = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : 0;

  // ── Determine scrape status ───────────────────────────────────────────────
  const hasValidationErrors = Object.values(categoryResults).some((r) => r.validationError);
  let scrapeStatus;
  if (overallConfidence >= 0.70 && !hasValidationErrors) {
    scrapeStatus = 'success';
  } else if (overallConfidence >= 0.40) {
    scrapeStatus = 'needs_review';
  } else {
    scrapeStatus = 'needs_review'; // even low-confidence goes to review, not failed
  }

  // ── Build $set payload ────────────────────────────────────────────────────
  const scrapedDataUpdate = {};
  for (const [cat, result] of Object.entries(categoryResults)) {
    if (result.data && Object.keys(result.data).length > 0) {
      scrapedDataUpdate[`scrapedData.${cat}`] = result.data;
    }
  }

  const updatePayload = {
    $set: {
      tier,
      collegeType,
      last_scraped_at: new Date(),  // keep legacy field updated
      ...scrapedDataUpdate,
      'scrapeMeta.lastScrapedAt': new Date(),
      'scrapeMeta.sourceUrls': sourceUrls,
      'scrapeMeta.contentHash': contentHash,
      'scrapeMeta.confidenceScore': overallConfidence,
      'scrapeMeta.scrapeStatus': scrapeStatus,
      'scrapeMeta.extractionMethod': 'llm',
      'scrapeMeta.failureCount': 0,
      'scrapeMeta.circuitOpen': false,
    },
    // Only set verifiedByAdmin to false on first scrape, don't overwrite existing approvals
    $setOnInsert: {
      name,
      domain,
      'scrapeMeta.verifiedByAdmin': false,
    },
  };

  // ── Upsert ────────────────────────────────────────────────────────────────
  const college = await College.findOneAndUpdate(
    { domain },
    updatePayload,
    { upsert: true, new: true, runValidators: false }
  );

  // ── Log the result ────────────────────────────────────────────────────────
  const logEntries = [];

  logEntries.push({
    collegeId: college._id,
    collegeName: name,
    collegeDomain: domain,
    category: 'system',
    level: scrapeStatus === 'success' ? 'info' : 'warn',
    message: `Scrape complete: status=${scrapeStatus}, confidence=${overallConfidence.toFixed(2)}, categories=${Object.keys(categoryResults).join(',')}`,
    jobId,
    confidenceScore: overallConfidence,
    timestamp: new Date(),
  });

  // Log per-category validation errors
  for (const [cat, result] of Object.entries(categoryResults)) {
    if (result.validationError) {
      logEntries.push({
        collegeId: college._id,
        collegeName: name,
        collegeDomain: domain,
        category: cat,
        level: 'warn',
        message: `Zod validation issue in ${cat}: ${result.validationError}`,
        jobId,
        confidenceScore: result.confidenceScore,
        sourceUrl: sourceUrls[cat],
        timestamp: new Date(),
      });
    }
  }

  await ScrapeLog.insertMany(logEntries);

  return { college, overallConfidence, status: scrapeStatus };
}

/**
 * Record a scrape failure in MongoDB (updates scrapeMeta.failureCount etc.)
 *
 * @param {string} domain
 * @param {Error} err
 * @param {string | null} jobId
 */
export async function recordScrapeFailure(domain, err, jobId = null) {
  try {
    const college = await College.findOneAndUpdate(
      { domain },
      {
        $inc: { 'scrapeMeta.failureCount': 1 },
        $set: {
          'scrapeMeta.scrapeStatus': 'failed',
          'scrapeMeta.lastFailureAt': new Date(),
        },
      },
      { new: true }
    );

    if (college) {
      await ScrapeLog.create({
        collegeId: college._id,
        collegeName: college.name,
        collegeDomain: domain,
        category: 'system',
        level: 'error',
        message: `Scrape failed: ${err.message}`,
        jobId,
        meta: { errorName: err.name, stack: err.stack?.slice(0, 1000) },
        timestamp: new Date(),
      });
    }
  } catch (logErr) {
    console.error('[Upsert] Failed to record scrape failure:', logErr.message);
  }
}
