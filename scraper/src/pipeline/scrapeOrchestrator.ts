/**
 * pipeline/scrapeOrchestrator.ts
 *
 * Full pipeline for one university:
 *   URL Discovery → Relevance Scoring
 *   → resolvePageStrategy → Cheerio | Playwright
 *   → contentHash check (skip if unchanged)
 *   → Rule-based extraction → LLM fallback
 *   → Validation (Zod + business rules)
 *   → Confidence scoring
 *   → MongoDB upsert
 *   → ScrapeJob tracking
 */

import mongoose from 'mongoose';
import { resolvePageStrategy, fetchWithPlaywright } from '../crawler/resolvePageStrategy.js';
import { extractLinks, htmlToCleanText, extractRelevantSections } from '../utils/htmlCleaner.js';
import { rankUrls, scoreUrl } from '../discovery/relevanceScorer.js';
import { extractPlacementRuleBased, extractNirfRuleBased } from '../extractors/ruleBasedExtractor.js';
import { extractPlacementWithLLM } from '../extractors/llmExtractor.js';
import { extractInternshipsFromPage } from '../extractors/internshipExtractor.js';
import { verifyAndPromoteDrafts } from '../services/internshipVerifier.js';
import { generateInternshipFingerprint } from './deduplicator.js';
import { computeHash, computeUrlHash, isContentUnchanged } from './contentHash.js';
import { validatePlacementData, validateNirfData } from '../validators/businessRules.js';
import { computeConfidence, shouldRequireReview } from '../validators/confidenceScorer.js';
import { University, type IUniversity } from '../models/University.js';
import { Placement } from '../models/Placement.js';
import { NirfRanking } from '../models/NirfRanking.js';
import { InternshipScraped } from '../models/Internship.js';
import { ScrapeJob, type IScrapeJob } from '../models/ScrapeJob.js';
import { SourcePage } from '../models/SourcePage.js';
import { DataReview } from '../models/DataReview.js';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ORCHESTRATOR');

export interface ScrapeResult {
  universityId: string;
  universityName: string;
  status: 'success' | 'partial' | 'failed' | 'blocked' | 'skipped';
  pagesDiscovered: number;
  pagesScraped: number;
  pagesFailed: number;
  dataExtracted: number;
  reviewRequired: number;
  errors: string[];
  duration: number;
}

/**
 * Run the complete scrape pipeline for a single university.
 */
export async function scrapeUniversity(university: IUniversity, triggeredBy: 'schedule' | 'manual' | 'bulk' = 'manual'): Promise<ScrapeResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let pagesDiscovered = 0;
  let pagesScraped = 0;
  let pagesFailed = 0;
  let dataExtracted = 0;
  let reviewRequired = 0;

  log.info(`Starting scrape for: ${university.name}`);

  // ── Gate check ──────────────────────────────────────────────────────────
  if (!university.scrapingAllowed) {
    log.warn(`Scraping not allowed for ${university.name} (scrapingAllowed=false)`);
    await University.updateOne({ _id: university._id }, { scrapeStatus: 'blocked' });
    return {
      universityId: university._id.toString(),
      universityName: university.name,
      status: 'blocked',
      pagesDiscovered: 0, pagesScraped: 0, pagesFailed: 0,
      dataExtracted: 0, reviewRequired: 0,
      errors: ['Scraping not allowed — scrapingAllowed is false'],
      duration: Date.now() - startTime,
    };
  }

  if (!university.officialWebsite) {
    log.warn(`No website for ${university.name} — skipping`);
    return {
      universityId: university._id.toString(),
      universityName: university.name,
      status: 'skipped',
      pagesDiscovered: 0, pagesScraped: 0, pagesFailed: 0,
      dataExtracted: 0, reviewRequired: 0,
      errors: ['No official website configured'],
      duration: Date.now() - startTime,
    };
  }

  // ── Create ScrapeJob ────────────────────────────────────────────────────
  const job = await ScrapeJob.create({
    universityId: university._id,
    status: 'running',
    startedAt: new Date(),
    triggeredBy,
  });

  await University.updateOne({ _id: university._id }, { scrapeStatus: 'running' });

  try {
    // ── Phase 1: Discover URLs ──────────────────────────────────────────
    const baseUrl = university.officialWebsite!;
    log.info(`Fetching homepage: ${baseUrl}`);

    const homepageResult = await resolvePageStrategy(baseUrl);

    if (homepageResult.statusCode >= 400) {
      throw new Error(`Homepage returned HTTP ${homepageResult.statusCode}`);
    }

    let html = homepageResult.html;
    if (homepageResult.strategy === 'playwright') {
      log.info('Homepage requires Playwright — fetching rendered version');
      const pwResult = await fetchWithPlaywright(baseUrl);
      html = pwResult.html;
    }

    // Extract same-domain links
    const discoveredUrls = extractLinks(html, baseUrl);
    const scoredUrls = rankUrls(discoveredUrls);
    pagesDiscovered = scoredUrls.length;

    log.info(`Discovered ${pagesDiscovered} relevant URLs (${scoredUrls.filter(u => u.priority === 'high').length} high priority)`);

    // ── Phase 2: Process homepage ───────────────────────────────────────
    await processPage(university, baseUrl, html, homepageResult, job);
    pagesScraped++;

    // ── Phase 3: Process high-priority pages ────────────────────────────
    const highPriorityUrls = scoredUrls.filter(u => u.priority === 'high').slice(0, 10);

    for (const scored of highPriorityUrls) {
      try {
        log.info(`Processing: ${scored.url} (${scored.category})`);
        const pageResult = await resolvePageStrategy(scored.url);

        if (pageResult.statusCode >= 400) {
          log.warn(`HTTP ${pageResult.statusCode} for ${scored.url}`);
          pagesFailed++;
          errors.push(`HTTP ${pageResult.statusCode}: ${scored.url}`);
          continue;
        }

        let pageHtml = pageResult.html;
        if (pageResult.strategy === 'playwright') {
          log.info(`  → Playwright needed for ${scored.url}`);
          const pwResult = await fetchWithPlaywright(scored.url);
          pageHtml = pwResult.html;
        }

        const extracted = await processPage(university, scored.url, pageHtml, pageResult, job);
        pagesScraped++;
        if (extracted) dataExtracted++;

        // Rate limiting: respect per-domain delay
        await sleep(config.crawl.perDomainDelayMs);
      } catch (err) {
        pagesFailed++;
        const msg = `Failed to process ${scored.url}: ${(err as Error).message}`;
        log.error(msg);
        errors.push(msg);
      }
    }

    // ── Phase 4: Process medium-priority pages ──────────────────────────
    const mediumPriorityUrls = scoredUrls.filter(u => u.priority === 'medium').slice(0, 5);

    for (const scored of mediumPriorityUrls) {
      try {
        const pageResult = await resolvePageStrategy(scored.url);
        if (pageResult.statusCode >= 400) {
          pagesFailed++;
          continue;
        }

        let pageHtml = pageResult.html;
        if (pageResult.strategy === 'playwright') {
          const pwResult = await fetchWithPlaywright(scored.url);
          pageHtml = pwResult.html;
        }

        await processPage(university, scored.url, pageHtml, pageResult, job);
        pagesScraped++;

        await sleep(config.crawl.perDomainDelayMs);
      } catch (err) {
        pagesFailed++;
        errors.push(`${scored.url}: ${(err as Error).message}`);
      }
    }

    // ── Phase 5: Run Verification Pipeline for Extracted Internships ────
    try {
      const vResult = await verifyAndPromoteDrafts();
      if (vResult.promoted > 0) {
        log.info(`Verification promoted ${vResult.promoted} internships to PUBLISHED status`);
      }
    } catch (vErr) {
      log.warn(`Verification pipeline warning: ${(vErr as Error).message}`);
    }

    // ── Finalize ────────────────────────────────────────────────────────
    const status = pagesFailed === 0 ? 'success' : (dataExtracted > 0 ? 'partial' : 'failed');

    await ScrapeJob.updateOne(
      { _id: job._id },
      {
        status,
        completedAt: new Date(),
        pagesDiscovered,
        pagesScraped,
        pagesFailed,
        dataExtracted,
        reviewRequired,
        jobErrors: errors,
      }
    );

    await University.updateOne(
      { _id: university._id },
      {
        scrapeStatus: status,
        lastChecked: new Date(),
        nextScheduledScrape: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }
    );

    log.success(`Completed ${university.name}: ${status} (${pagesScraped} pages, ${dataExtracted} data points)`);

    return {
      universityId: university._id.toString(),
      universityName: university.name,
      status,
      pagesDiscovered,
      pagesScraped,
      pagesFailed,
      dataExtracted,
      reviewRequired,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const msg = (err as Error).message;
    log.error(`Fatal error scraping ${university.name}: ${msg}`);

    await ScrapeJob.updateOne(
      { _id: job._id },
      {
        status: 'failed',
        completedAt: new Date(),
        pagesDiscovered,
        pagesScraped,
        pagesFailed,
        dataExtracted,
        jobErrors: [...errors, msg],
      }
    );

    await University.updateOne({ _id: university._id }, { scrapeStatus: 'failed' });

    return {
      universityId: university._id.toString(),
      universityName: university.name,
      status: 'failed',
      pagesDiscovered, pagesScraped, pagesFailed,
      dataExtracted, reviewRequired,
      errors: [...errors, msg],
      duration: Date.now() - startTime,
    };
  }
}

// ── Internal: process a single page ─────────────────────────────────────────

async function processPage(
  university: IUniversity,
  url: string,
  html: string,
  strategyResult: { strategy: string; etag: string | null; lastModified: string | null; statusCode: number },
  job: IScrapeJob,
): Promise<boolean> {
  const urlHash = computeUrlHash(url);
  const contentHash = computeHash(html);

  // ── Content-hash check ──────────────────────────────────────────────
  const existingPage = await SourcePage.findOne({ urlHash }).sort({ fetchedAt: -1 });
  if (existingPage && existingPage.contentHash === contentHash) {
    log.info(`  Content unchanged for ${url} — skipping extraction`);
    // Update lastChecked but skip extraction
    return false;
  }

  // ── Save source page record ─────────────────────────────────────────
  const sourcePage = await SourcePage.create({
    universityId: university._id,
    url,
    urlHash,
    contentHash,
    fetchedAt: new Date(),
    method: strategyResult.strategy as 'cheerio' | 'playwright',
    httpStatus: strategyResult.statusCode,
    etag: strategyResult.etag,
    lastModified: strategyResult.lastModified,
    pageCategory: scoreUrl(url).category,
  });

  // ── Extract placement data ──────────────────────────────────────────
  let extracted = false;

  // Try rule-based first
  const ruleResult = extractPlacementRuleBased(html, url);

  if (ruleResult) {
    log.info(`  Rule-based extraction found placement data (confidence: ${ruleResult.confidence.toFixed(2)})`);

    const validation = validatePlacementData({
      highestPackage: ruleResult.highestPackageValue,
      averagePackage: ruleResult.averagePackageValue,
      medianPackage: ruleResult.medianPackageValue,
      placementRatePct: ruleResult.placementRatePct,
      totalOffers: ruleResult.totalOffers,
      totalEligibleStudents: ruleResult.totalEligible,
    });

    if (validation.valid) {
      await savePlacementData(university, ruleResult, url, 'rules', sourcePage._id, ruleResult.confidence);
      extracted = true;
    } else {
      log.warn(`  Business rule validation failed: ${validation.errors.join(', ')}`);
      for (const warning of validation.warnings) {
        log.warn(`  Warning: ${warning}`);
      }
    }
  }

  // If rule-based didn't find placement data, try LLM
  if (!extracted) {
    const cleanText = htmlToCleanText(html, 3000);
    if (/placement|package|salary|ctc|recruit/i.test(cleanText)) {
      log.info(`  Rule-based found no data — trying LLM extraction`);

      const llmResult = await extractPlacementWithLLM(
        cleanText,
        university.name,
        contentHash,
        config.gemini.apiKey,
        config.gemini.model,
      );

      if (llmResult && (llmResult.highest_package_lpa || llmResult.average_package_lpa || llmResult.placement_rate_pct)) {
        log.info(`  LLM extraction found placement data`);

        const ruleFormat = {
          year: llmResult.batch_year ?? null,
          highestPackageRaw: llmResult.highest_package_raw ?? null,
          highestPackageValue: llmResult.highest_package_lpa ? llmResult.highest_package_lpa * 100000 : null,
          averagePackageRaw: llmResult.average_package_raw ?? null,
          averagePackageValue: llmResult.average_package_lpa ? llmResult.average_package_lpa * 100000 : null,
          medianPackageRaw: null,
          medianPackageValue: llmResult.median_package_lpa ? llmResult.median_package_lpa * 100000 : null,
          placementRatePct: llmResult.placement_rate_pct ?? null,
          totalOffers: llmResult.total_offers ?? null,
          totalEligible: llmResult.total_eligible ?? null,
          recruiters: llmResult.recruiters ?? [],
          companiesCount: llmResult.companies_count ?? null,
          placementReportUrl: llmResult.placement_report_url ?? null,
          confidence: llmResult._confidence ?? 0.5,
        };

        const validation = validatePlacementData({
          highestPackage: ruleFormat.highestPackageValue,
          averagePackage: ruleFormat.averagePackageValue,
          placementRatePct: ruleFormat.placementRatePct,
          totalOffers: ruleFormat.totalOffers,
        });

        if (validation.valid) {
          await savePlacementData(university, ruleFormat, url, 'llm', sourcePage._id, ruleFormat.confidence);
          extracted = true;
        }
      }
    }
  }

  // ── Extract NIRF data ───────────────────────────────────────────────
  const nirfResults = extractNirfRuleBased(html);
  for (const nirf of nirfResults) {
    const nirfValidation = validateNirfData(nirf);
    if (nirfValidation.valid) {
      try {
        await NirfRanking.updateOne(
          { universityId: university._id, category: nirf.category, year: nirf.year },
          {
            $setOnInsert: {
              universityId: university._id,
              rank: nirf.rank,
              category: nirf.category,
              year: nirf.year,
              score: nirf.score,
              source: {
                url,
                type: 'official' as const,
                lastVerified: new Date(),
              },
            },
          },
          { upsert: true }
        );
        extracted = true;
        log.info(`  NIRF: rank ${nirf.rank} (${nirf.category}, ${nirf.year})`);
      } catch (err) {
        // Duplicate key is fine — we use $setOnInsert to never overwrite
        if ((err as any).code !== 11000) throw err;
      }
    }
  }

  // ── Extract Internship Opportunities (§5) ─────────────────────────
  const internships = extractInternshipsFromPage(html, url);
  for (const intern of internships) {
    const fingerprint = generateInternshipFingerprint(
      university._id.toString(),
      intern.facultyName,
      intern.projectName,
      url
    );

    try {
      await InternshipScraped.updateOne(
        { fingerprint },
        {
          $setOnInsert: {
            universityId: university._id,
            universityName: university.name,
            facultyName: intern.facultyName,
            facultyProfileUrl: intern.facultyProfileUrl,
            department: intern.department,
            projectName: intern.projectName,
            projectDetails: intern.projectDetails,
            compensation: {
              status: intern.compensationStatus,
              amount: intern.compensationAmount,
              currency: 'INR',
              raw: intern.compensationRaw,
            },
            duration: intern.duration,
            eligibility: intern.eligibility,
            applicationUrl: intern.applicationUrl,
            professorEmail: intern.professorEmail,
            deadline: intern.deadline,
            source: {
              url,
              type: 'official' as const,
              lastVerified: new Date(),
            },
            confidence: intern.confidence,
            fingerprint,
          },
        },
        { upsert: true }
      );
      extracted = true;
      log.info(`  Internship Position Found: "${intern.projectName}" under ${intern.facultyName} (${intern.compensationStatus})`);
    } catch (err) {
      if ((err as any).code !== 11000) throw err;
    }
  }

  // Update source page with extracted data IDs
  if (extracted) {
    await SourcePage.updateOne(
      { _id: sourcePage._id },
      { $set: { extractedDataIds: [sourcePage._id] } }
    );
  }

  return extracted;
}

// ── Internal: save placement data ───────────────────────────────────────────

async function savePlacementData(
  university: IUniversity,
  data: {
    year: string | null;
    highestPackageRaw: string | null;
    highestPackageValue: number | null;
    averagePackageRaw: string | null;
    averagePackageValue: number | null;
    medianPackageRaw: string | null;
    medianPackageValue: number | null;
    placementRatePct: number | null;
    totalOffers: number | null;
    totalEligible: number | null;
    recruiters: string[];
    companiesCount: number | null;
    placementReportUrl: string | null;
    confidence: number;
  },
  sourceUrl: string,
  method: 'rules' | 'llm',
  sourcePageId: mongoose.Types.ObjectId,
  confidence: number,
) {
  const year = data.year || `${new Date().getFullYear()}`;
  const now = new Date();

  const makeSourcedValue = (value: number | null, raw: string | null) => {
    if (value === null && raw === null) return null;
    return {
      value,
      currency: 'INR',
      status: value !== null ? ('DISCLOSED' as const) : ('NOT_DISCLOSED' as const),
      raw,
      source: {
        url: sourceUrl,
        type: 'official' as const,
        lastVerified: now,
      },
      confidence: computeConfidence({
        sourceType: 'official',
        extractionMethod: method,
        structuredData: method === 'rules',
        fromPdf: false,
        dataAgeDays: 0,
        llmConfidence: method === 'llm' ? confidence : undefined,
      }),
      extractionMethod: method,
    };
  };

  const needsReview = shouldRequireReview(confidence, config.crawl.confidenceThreshold);

  try {
    await Placement.updateOne(
      { universityId: university._id, year },
      {
        $set: {
          highestPackage: makeSourcedValue(data.highestPackageValue, data.highestPackageRaw),
          averagePackage: makeSourcedValue(data.averagePackageValue, data.averagePackageRaw),
          medianPackage: makeSourcedValue(data.medianPackageValue, data.medianPackageRaw),
          placementRatePct: data.placementRatePct,
          totalOffers: data.totalOffers,
          totalEligibleStudents: data.totalEligible,
          recruiters: data.recruiters,
          companiesCount: data.companiesCount,
          placementReportUrl: data.placementReportUrl,
          overallConfidence: confidence,
          extractionMethod: method,
          sourceUrl,
        },
        $setOnInsert: {
          universityId: university._id,
          year,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    log.error(`Failed to save placement data: ${(err as Error).message}`);
  }

  // Create review entry if confidence is low
  if (needsReview) {
    await DataReview.create({
      universityId: university._id,
      dataType: 'placement',
      fieldName: null,
      extractedValue: data,
      confidence,
      sourceUrl,
      status: 'pending',
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
