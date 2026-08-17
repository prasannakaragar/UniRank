/**
 * extractors/indianNumberParser.ts
 *
 * Deterministic parser for Indian currency/numbering conventions.
 * Handles lakh, crore, LPA, CTC notation before falling back to LLM.
 *
 * Examples:
 *   "₹8.5 LPA"           → { value: 850000, currency: 'INR', unit: 'LPA', raw: '₹8.5 LPA' }
 *   "Rs. 8,50,000"        → { value: 850000, currency: 'INR', unit: null, raw: 'Rs. 8,50,000' }
 *   "8.5 Lakhs per annum" → { value: 850000, currency: 'INR', unit: 'LPA', raw: '8.5 Lakhs per annum' }
 *   "1.2 Cr"              → { value: 12000000, currency: 'INR', unit: null, raw: '1.2 Cr' }
 *   "44 LPA"              → { value: 4400000, currency: 'INR', unit: 'LPA', raw: '44 LPA' }
 *   "₹25,000/month"       → { value: 25000, currency: 'INR', unit: 'monthly', raw: '₹25,000/month' }
 */

export interface ParsedAmount {
  value: number;
  currency: 'INR';
  unit: 'LPA' | 'monthly' | null;
  raw: string;
}

// ── Patterns ──────────────────────────────────────────────────────────────────

// Currency prefix: ₹, Rs, Rs., INR
const CURRENCY_PREFIX = /(?:₹|Rs\.?\s*|INR\s*)/i;

// Number: handles Indian comma format (1,23,456) and western (1,234,567)
const NUMBER = /(\d[\d,]*(?:\.\d+)?)/;

// Unit suffixes
const LAKH_SUFFIX = /\s*(?:lakhs?|lacs?|lkh)/i;
const CRORE_SUFFIX = /\s*(?:crores?|cr)/i;
const LPA_SUFFIX = /\s*(?:LPA|L\.?P\.?A\.?|lakhs?\s*(?:per\s*annum|p\.?a\.?)|lacs?\s*(?:per\s*annum|p\.?a\.?))/i;
const CTC_SUFFIX = /\s*(?:CTC|C\.?T\.?C\.?)/i;
const MONTHLY_SUFFIX = /\s*(?:\/\s*month|per\s*month|p\.?m\.?|\/\s*mo)/i;

/**
 * Parse an Indian currency/number string into a structured amount.
 * Returns null if the string doesn't contain a recognisable pattern.
 */
export function parseIndianAmount(input: string): ParsedAmount | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try LPA pattern first (most common in placement data)
  const lpaResult = tryParseLPA(trimmed);
  if (lpaResult) return lpaResult;

  // Try crore pattern
  const croreResult = tryParseCrore(trimmed);
  if (croreResult) return croreResult;

  // Try lakh pattern (without "per annum")
  const lakhResult = tryParseLakh(trimmed);
  if (lakhResult) return lakhResult;

  // Try monthly pattern
  const monthlyResult = tryParseMonthly(trimmed);
  if (monthlyResult) return monthlyResult;

  // Try plain number with currency prefix (Indian comma format)
  const plainResult = tryParsePlainINR(trimmed);
  if (plainResult) return plainResult;

  return null;
}

/**
 * Extract all Indian amounts found in a text block.
 */
export function extractAllAmounts(text: string): ParsedAmount[] {
  // Find segments that look like they contain amounts
  const patterns = [
    // ₹X.X LPA, Rs X LPA, X LPA
    /(?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:LPA|L\.?P\.?A\.?|lakhs?\s*(?:per\s*annum|p\.?a\.?)|lacs?\s*(?:per\s*annum|p\.?a\.?))/gi,
    // ₹X.X Crore, Rs X Cr
    /(?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr)/gi,
    // ₹X.X Lakh, Rs X Lakh
    /(?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|lkh)/gi,
    // ₹X,XX,XXX or ₹X,XXX,XXX (Indian comma format with currency prefix)
    /(?:₹|Rs\.?\s*|INR\s*)\s*\d{1,2}(?:,\d{2})*(?:,\d{3})/g,
    // ₹XX,XXX/month
    /(?:₹|Rs\.?\s*|INR\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:\/\s*month|per\s*month|p\.?m\.?)/gi,
  ];

  const results: ParsedAmount[] = [];
  const seen = new Set<number>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseIndianAmount(match[0]);
      if (parsed && !seen.has(parsed.value)) {
        results.push(parsed);
        seen.add(parsed.value);
      }
    }
  }

  return results;
}

// ── Internal parsers ──────────────────────────────────────────────────────────

function tryParseLPA(input: string): ParsedAmount | null {
  const pattern = new RegExp(
    `^${CURRENCY_PREFIX.source}?\\s*${NUMBER.source}\\s*${LPA_SUFFIX.source}(?:\\s*${CTC_SUFFIX.source})?`,
    'i'
  );
  const match = input.match(pattern);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num === null) return null;

  return {
    value: Math.round(num * 100000), // Lakhs → absolute INR
    currency: 'INR',
    unit: 'LPA',
    raw: match[0].trim(),
  };
}

function tryParseCrore(input: string): ParsedAmount | null {
  const pattern = new RegExp(
    `^${CURRENCY_PREFIX.source}?\\s*${NUMBER.source}${CRORE_SUFFIX.source}`,
    'i'
  );
  const match = input.match(pattern);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num === null) return null;

  return {
    value: Math.round(num * 10000000), // Crores → absolute INR
    currency: 'INR',
    unit: null,
    raw: match[0].trim(),
  };
}

function tryParseLakh(input: string): ParsedAmount | null {
  const pattern = new RegExp(
    `^${CURRENCY_PREFIX.source}?\\s*${NUMBER.source}${LAKH_SUFFIX.source}`,
    'i'
  );
  const match = input.match(pattern);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num === null) return null;

  return {
    value: Math.round(num * 100000), // Lakhs → absolute INR
    currency: 'INR',
    unit: null,
    raw: match[0].trim(),
  };
}

function tryParseMonthly(input: string): ParsedAmount | null {
  const pattern = new RegExp(
    `^${CURRENCY_PREFIX.source}?\\s*${NUMBER.source}${MONTHLY_SUFFIX.source}`,
    'i'
  );
  const match = input.match(pattern);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num === null) return null;

  return {
    value: Math.round(num),
    currency: 'INR',
    unit: 'monthly',
    raw: match[0].trim(),
  };
}

function tryParsePlainINR(input: string): ParsedAmount | null {
  const pattern = new RegExp(
    `^${CURRENCY_PREFIX.source}\\s*${NUMBER.source}\\s*$`,
    'i'
  );
  const match = input.match(pattern);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num === null) return null;

  return {
    value: Math.round(num),
    currency: 'INR',
    unit: null,
    raw: match[0].trim(),
  };
}

/**
 * Parse a number string with Indian/western commas.
 * "8,50,000" → 850000
 * "1,23,45,678" → 12345678
 * "12.5" → 12.5
 */
function parseNumber(numStr: string): number | null {
  if (!numStr) return null;
  // Remove all commas, then parse
  const cleaned = numStr.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return num;
}
