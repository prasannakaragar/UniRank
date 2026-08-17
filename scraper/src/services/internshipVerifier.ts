/**
 * services/internshipVerifier.ts
 *
 * Dedicated Verification Service for Strict Live Internships.
 *
 * Hard Rules (Requirements 2, 3, 4):
 * 1. All extracted internships start as DRAFT.
 * 2. Only this service promotes DRAFT → PUBLISHED after:
 *    - Re-fetching the official source URL (HTTP 200)
 *    - Confirming the project title / listing text is still present on the page
 *    - Confirming deadline has NOT passed
 *    - Confirming confidence >= 0.70 (or approved by admin)
 * 3. Re-check loop (periodic):
 *    - Re-visits published source pages
 *    - If missing or errored → moves to DELISTED and removes from backend
 *    - If deadline passed → moves to EXPIRED and removes from backend
 *    - Updates lastVerifiedLive timestamp
 */

import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import axios from 'axios';
import https from 'https';
import { InternshipScraped, type IInternshipScraped } from '../models/Internship.js';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('VERIFIER');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Verify all DRAFT internships and promote eligible ones to PUBLISHED.
 */
export async function verifyAndPromoteDrafts(): Promise<{ promoted: number; expired: number; delisted: number }> {
  log.info('Running verification pipeline for DRAFT internships...');

  const drafts = await InternshipScraped.find({ publishStatus: 'DRAFT' });
  let promoted = 0;
  let expired = 0;
  let delisted = 0;

  for (const draft of drafts) {
    const result = await checkInternshipLiveStatus(draft);

    if (result.status === 'PUBLISHED') {
      draft.publishStatus = 'PUBLISHED';
      draft.lastVerifiedLive = new Date();
      draft.delistedReason = null;
      await draft.save();

      // Sync to backend 'internships' collection
      await syncToBackendInternships(draft);
      promoted++;
      log.success(`Promoted to PUBLISHED: "${draft.projectName}" at ${draft.universityName} (Verified live on ${draft.lastVerifiedLive.toISOString().split('T')[0]})`);
    } else if (result.status === 'EXPIRED') {
      draft.publishStatus = 'EXPIRED';
      draft.delistedReason = result.reason;
      await draft.save();
      await removeFromBackendInternships(draft.fingerprint);
      expired++;
      log.warn(`Marked EXPIRED: "${draft.projectName}" (${result.reason})`);
    } else if (result.status === 'DELISTED') {
      draft.publishStatus = 'DELISTED';
      draft.delistedReason = result.reason;
      await draft.save();
      await removeFromBackendInternships(draft.fingerprint);
      delisted++;
      log.warn(`Marked DELISTED: "${draft.projectName}" (${result.reason})`);
    }
  }

  log.info(`Verification finished: ${promoted} promoted, ${expired} expired, ${delisted} delisted.`);
  return { promoted, expired, delisted };
}

/**
 * Periodically re-verify all currently PUBLISHED internships.
 * Delists or expires any listing that is no longer live on its source page.
 */
export async function recheckPublishedInternships(): Promise<{ verified: number; delisted: number; expired: number }> {
  log.info('Re-checking all PUBLISHED internships for live status...');

  const published = await InternshipScraped.find({ publishStatus: 'PUBLISHED' });
  let verified = 0;
  let delisted = 0;
  let expired = 0;

  for (const item of published) {
    const result = await checkInternshipLiveStatus(item);

    if (result.status === 'PUBLISHED') {
      item.lastVerifiedLive = new Date();
      await item.save();
      await syncToBackendInternships(item);
      verified++;
    } else if (result.status === 'EXPIRED') {
      item.publishStatus = 'EXPIRED';
      item.delistedReason = result.reason;
      await item.save();
      await removeFromBackendInternships(item.fingerprint);
      expired++;
      log.warn(`DELISTING (Expired): "${item.projectName}" (${result.reason})`);
    } else {
      item.publishStatus = 'DELISTED';
      item.delistedReason = result.reason;
      await item.save();
      await removeFromBackendInternships(item.fingerprint);
      delisted++;
      log.warn(`DELISTING (Source missing/unreachable): "${item.projectName}" (${result.reason})`);
    }
  }

  log.info(`Re-check complete: ${verified} re-verified live, ${expired} expired, ${delisted} delisted.`);
  return { verified, delisted, expired };
}

/**
 * Helper: Perform strict live checks on a single internship document.
 */
async function checkInternshipLiveStatus(intern: IInternshipScraped): Promise<{ status: 'PUBLISHED' | 'EXPIRED' | 'DELISTED' | 'DRAFT'; reason?: string }> {
  const now = new Date();

  // 1. Deadline check
  if (intern.deadline) {
    const parsedDate = new Date(intern.deadline);
    if (!isNaN(parsedDate.getTime()) && parsedDate < now) {
      return { status: 'EXPIRED', reason: `Deadline passed (${intern.deadline})` };
    }
  }

  // 2. Confidence check
  if (intern.confidence < config.crawl.confidenceThreshold) {
    return { status: 'DRAFT', reason: `Low confidence score (${intern.confidence}) — needs admin review` };
  }

  // 3. Source URL live reachability check
  if (!intern.source?.url) {
    return { status: 'DELISTED', reason: 'Missing source URL' };
  }

  try {
    const response = await axios.get(intern.source.url, {
      timeout: config.crawl.pageTimeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UniRankLiveVerifier/2.0',
      },
      httpsAgent,
      validateStatus: () => true,
    });

    if (response.status >= 400 || !response.data) {
      return { status: 'DELISTED', reason: `Source URL returned HTTP ${response.status}` };
    }

    const html = typeof response.data === 'string' ? response.data : String(response.data);
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').toLowerCase();

    // 4. Verify listing text still exists on the page
    const keywords = intern.projectName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    let matchCount = 0;
    for (const kw of keywords) {
      if (bodyText.includes(kw)) matchCount++;
    }

    const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 1;
    if (matchRatio < 0.3) {
      return { status: 'DELISTED', reason: 'Listing text no longer present on source page' };
    }

    return { status: 'PUBLISHED' };
  } catch (err) {
    return { status: 'DELISTED', reason: `Network error reaching source URL: ${(err as Error).message}` };
  }
}

/**
 * Helper: Sync a PUBLISHED internship to the backend 'internships' collection.
 */
async function syncToBackendInternships(item: IInternshipScraped) {
  const db = mongoose.connection.db;
  if (!db) return;

  const doc = {
    project_title: item.projectName,
    professor_name: item.facultyName,
    professor_image: '',
    college_name: item.universityName,
    college_domain: item.facultyProfileUrl ? new URL(item.facultyProfileUrl).hostname.replace(/^www\./, '') : 'unirank.in',
    duration: item.duration || '3 Months',
    mode: 'on-site',
    stipend: item.compensation.raw || (item.compensation.status === 'PAID' ? 'Stipend Provided' : item.compensation.status),
    stipend_amount: item.compensation.amount || 0,
    description: item.projectDetails,
    skills_required: ['Research', 'Analysis'],
    deadline: item.deadline || 'Not Disclosed',
    application_process: item.applicationUrl ? `Apply online at ${item.applicationUrl}` : (item.professorEmail ? `Email ${item.professorEmail}` : 'Refer to source URL'),
    professor_email: item.professorEmail || '',
    opportunity_score: Math.round(item.confidence * 100),
    publishStatus: 'PUBLISHED',
    lastVerifiedLive: item.lastVerifiedLive || new Date(),
    sourceUrl: item.source.url,
    fingerprint: item.fingerprint,
    created_at: item.createdAt,
  };

  await db.collection('internships').updateOne(
    { fingerprint: item.fingerprint },
    { $set: doc },
    { upsert: true }
  );
}

/**
 * Helper: Remove an unverified/delisted/expired internship from backend 'internships' collection.
 */
async function removeFromBackendInternships(fingerprint: string) {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection('internships').deleteOne({ fingerprint });
}
