/**
 * extractors/ruleBasedExtractor.ts
 *
 * Deterministic extraction using Cheerio selectors and regex patterns.
 * Preferred over LLM — only falls back to LLM when this fails.
 */

import * as cheerio from 'cheerio';
import { parseIndianAmount, extractAllAmounts, type ParsedAmount } from './indianNumberParser.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RULE-EXTRACTOR');

export interface RuleBasedPlacementResult {
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
}

/**
 * Try to extract placement data using rule-based methods (regex + Cheerio).
 * Returns null if no meaningful data could be extracted.
 */
export function extractPlacementRuleBased(html: string, baseUrl: string): RuleBasedPlacementResult | null {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();

  const bodyText = $('body').text();
  const normalizedText = bodyText.replace(/\s+/g, ' ').trim();

  // Check if this page has any placement-related content at all
  if (!/placement|package|salary|ctc|recruit|placed/i.test(normalizedText)) {
    return null;
  }

  let highestPkg: ParsedAmount | null = null;
  let averagePkg: ParsedAmount | null = null;
  let medianPkg: ParsedAmount | null = null;
  let placementRate: number | null = null;
  let totalOffers: number | null = null;
  let totalEligible: number | null = null;
  let year: string | null = null;
  let companiesCount: number | null = null;
  let placementReportUrl: string | null = null;
  const recruiters: string[] = [];

  // ── Extract year ──────────────────────────────────────────────────────────
  const yearMatch = normalizedText.match(/(?:20\d{2}\s*[-–]\s*\d{2,4}|batch\s*(?:of\s*)?20\d{2}|(?:placement|academic)\s*year\s*[:=]?\s*20\d{2})/i);
  if (yearMatch) {
    year = yearMatch[0].replace(/.*?(\d{4})\s*[-–]\s*(\d{2,4}).*/, '$1-$2');
    if (year === yearMatch[0]) {
      const singleYear = yearMatch[0].match(/20\d{2}/);
      year = singleYear ? singleYear[0] : null;
    }
  }

  // ── Extract packages from context ─────────────────────────────────────────
  // Look for "highest package" followed by a number
  const highestMatch = normalizedText.match(/(?:highest|maximum|top|best)\s*(?:package|ctc|salary|offer)\s*[:\-–=]?\s*((?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:LPA|Lakhs?\s*(?:per\s*annum)?|Cr|Crore|Lacs?))/i);
  if (highestMatch) {
    highestPkg = parseIndianAmount(highestMatch[1]);
  }

  // Look for "average package" followed by a number
  const avgMatch = normalizedText.match(/(?:average|mean|avg)\s*(?:package|ctc|salary|offer)\s*[:\-–=]?\s*((?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:LPA|Lakhs?\s*(?:per\s*annum)?|Cr|Crore|Lacs?))/i);
  if (avgMatch) {
    averagePkg = parseIndianAmount(avgMatch[1]);
  }

  // Look for "median package"
  const medianMatch = normalizedText.match(/(?:median)\s*(?:package|ctc|salary|offer)\s*[:\-–=]?\s*((?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:LPA|Lakhs?\s*(?:per\s*annum)?|Cr|Crore|Lacs?))/i);
  if (medianMatch) {
    medianPkg = parseIndianAmount(medianMatch[1]);
  }

  // ── Extract from tables ───────────────────────────────────────────────────
  // Many Indian college sites put placement stats in tables
  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    rows.each((_, row) => {
      const cells = $(row).find('td, th');
      if (cells.length < 2) return;

      const label = $(cells[0]).text().replace(/\s+/g, ' ').trim().toLowerCase();
      const value = $(cells[1]).text().replace(/\s+/g, ' ').trim();

      if (/(?:highest|maximum|top)\s*(?:package|ctc|salary)/i.test(label) && !highestPkg) {
        highestPkg = parseIndianAmount(value);
      }
      if (/(?:average|mean|avg)\s*(?:package|ctc|salary)/i.test(label) && !averagePkg) {
        averagePkg = parseIndianAmount(value);
      }
      if (/(?:median)\s*(?:package|ctc|salary)/i.test(label) && !medianPkg) {
        medianPkg = parseIndianAmount(value);
      }
      if (/placement\s*(?:rate|percentage|%)/i.test(label) && placementRate === null) {
        const pctMatch = value.match(/(\d+(?:\.\d+)?)\s*%?/);
        if (pctMatch) {
          const pct = parseFloat(pctMatch[1]);
          if (pct >= 0 && pct <= 100) placementRate = pct;
        }
      }
      if (/total\s*(?:offers|placements)/i.test(label) && totalOffers === null) {
        const num = parseInt(value.replace(/,/g, ''), 10);
        if (!isNaN(num) && num > 0) totalOffers = num;
      }
      if (/(?:companies|recruiters)\s*(?:visited|participated)/i.test(label) && companiesCount === null) {
        const num = parseInt(value.replace(/,/g, ''), 10);
        if (!isNaN(num) && num > 0) companiesCount = num;
      }
    });
  });

  // ── Placement rate from text ──────────────────────────────────────────────
  if (placementRate === null) {
    const rateMatch = normalizedText.match(/placement\s*(?:rate|percentage)\s*[:\-–=]?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (rateMatch) {
      const pct = parseFloat(rateMatch[1]);
      if (pct >= 0 && pct <= 100) placementRate = pct;
    }
  }

  // ── Recruiter names ───────────────────────────────────────────────────────
  // Look for common recruiter lists
  const recruiterSection = normalizedText.match(/(?:top|major|key|prominent)\s*recruiters?\s*[:\-–=]?\s*([^.]{10,500})/i);
  if (recruiterSection) {
    const names = recruiterSection[1]
      .split(/[,;|•·]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50 && !/^\d+$/.test(s));
    recruiters.push(...names.slice(0, 30));
  }

  // ── PDF link ──────────────────────────────────────────────────────────────
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    if (/\.pdf$/i.test(href) && /placement|report/i.test(text)) {
      try {
        placementReportUrl = new URL(href, baseUrl).href;
      } catch {
        // Invalid URL
      }
    }
  });

  // ── Check if we found anything meaningful ─────────────────────────────────
  const hasData = highestPkg || averagePkg || medianPkg || placementRate !== null || totalOffers !== null;
  if (!hasData) return null;

  // ── Compute rule-based confidence ─────────────────────────────────────────
  let confidence = 0.7; // Base confidence for rule-based extraction
  if (highestPkg && averagePkg) confidence += 0.1;
  if (placementRate !== null) confidence += 0.05;
  if (recruiters.length > 3) confidence += 0.05;
  if (year) confidence += 0.05;
  confidence = Math.min(1.0, confidence);

  return {
    year,
    highestPackageRaw: highestPkg?.raw ?? null,
    highestPackageValue: highestPkg?.value ?? null,
    averagePackageRaw: averagePkg?.raw ?? null,
    averagePackageValue: averagePkg?.value ?? null,
    medianPackageRaw: medianPkg?.raw ?? null,
    medianPackageValue: medianPkg?.value ?? null,
    placementRatePct: placementRate,
    totalOffers,
    totalEligible,
    recruiters,
    companiesCount,
    placementReportUrl,
    confidence,
  };
}

/**
 * Extract NIRF ranking data using rule-based methods.
 */
export function extractNirfRuleBased(html: string): Array<{ rank: number; category: string; year: number; score: number | null }> {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  const results: Array<{ rank: number; category: string; year: number; score: number | null }> = [];

  // Pattern: "NIRF Ranking 2024: 45" or "NIRF Rank: 45 (Engineering)" etc.
  const nirfPatterns = [
    /nirf\s*(?:ranking|rank)\s*(?:20(\d{2}))\s*[:\-–=]?\s*(\d+)\s*(?:\(([^)]+)\))?/gi,
    /nirf\s*(?:ranking|rank)\s*[:\-–=]?\s*(\d+)\s*(?:\(([^)]+)\))?\s*(?:20(\d{2}))?/gi,
    /ranked?\s*(\d+)\s*(?:in|by)\s*nirf\s*(?:20(\d{2}))?\s*(?:\(([^)]+)\))?/gi,
  ];

  for (const pattern of nirfPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(bodyText)) !== null) {
      const fullMatch = match[0];
      // Try to extract rank, year, category from the match
      const rankMatch = fullMatch.match(/\b(\d{1,3})\b/);
      const yearMatch = fullMatch.match(/20(\d{2})/);
      const categoryMatch = fullMatch.match(/\(([^)]+)\)/);

      if (rankMatch) {
        const rank = parseInt(rankMatch[1], 10);
        const year = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear();
        const category = categoryMatch ? categoryMatch[1].trim() : 'Engineering';

        if (rank > 0 && rank < 500) {
          // Check for duplicates
          const exists = results.some(r => r.rank === rank && r.year === year && r.category === category);
          if (!exists) {
            results.push({ rank, category, year, score: null });
          }
        }
      }
    }
  }

  // Also check tables for NIRF data
  $('table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (!/nirf|rank/i.test(tableText)) return;

    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td, th');
      if (cells.length < 2) return;

      const texts = cells.map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      const rowText = texts.join(' ');

      const rankInRow = rowText.match(/\b(\d{1,3})\b/);
      const yearInRow = rowText.match(/20(\d{2})/);

      if (rankInRow && yearInRow) {
        const rank = parseInt(rankInRow[1], 10);
        const year = 2000 + parseInt(yearInRow[1], 10);
        if (rank > 0 && rank < 500) {
          const exists = results.some(r => r.rank === rank && r.year === year);
          if (!exists) {
            results.push({ rank, category: 'Engineering', year, score: null });
          }
        }
      }
    });
  });

  return results;
}
