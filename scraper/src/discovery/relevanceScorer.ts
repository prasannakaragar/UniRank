/**
 * discovery/relevanceScorer.ts
 *
 * Scores URLs by keyword relevance to prioritize what gets crawled.
 * High-priority placement/NIRF pages crawled first; low-priority pages last.
 */

export type UrlPriority = 'high' | 'medium' | 'low' | 'skip';

interface ScoredUrl {
  url: string;
  priority: UrlPriority;
  score: number;
  category: string;
}

// ── Keyword → priority mapping ────────────────────────────────────────────────

const HIGH_PRIORITY_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /placement[s-]?(?:report|cell|statistics|data|record)?/i, category: 'placement' },
  { pattern: /\btpo\b/i, category: 'placement' },
  { pattern: /training[- ]?and[- ]?placement/i, category: 'placement' },
  { pattern: /career[- ]?(?:services?|cell|development)/i, category: 'placement' },
  { pattern: /campus[- ]?recruit/i, category: 'placement' },
  { pattern: /nirf/i, category: 'nirf' },
  { pattern: /ranking[s]?/i, category: 'nirf' },
  // Internship & Faculty / Staff Profile keywords (§4)
  { pattern: /internship[s]?/i, category: 'internship' },
  { pattern: /summer[- ]?internship/i, category: 'internship' },
  { pattern: /research[- ]?(?:projects?|opportunities|positions?|cell)?/i, category: 'internship' },
  { pattern: /faculty/i, category: 'faculty' },
  { pattern: /staff[- ]?(?:profile[s]?|directory)?/i, category: 'faculty' },
  { pattern: /professors?/i, category: 'faculty' },
  { pattern: /opportunit(?:y|ies)/i, category: 'internship' },
];

const MEDIUM_PRIORITY_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /admission[s]?/i, category: 'admission' },
  { pattern: /programme?[s]?/i, category: 'academics' },
  { pattern: /course[s]?/i, category: 'academics' },
  { pattern: /department[s]?/i, category: 'academics' },
  { pattern: /academi[cs]/i, category: 'academics' },
  { pattern: /accreditation/i, category: 'accreditation' },
  { pattern: /\bnaac\b/i, category: 'accreditation' },
  { pattern: /\bnba\b/i, category: 'accreditation' },
];

const LOW_PRIORITY_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /about[- ]?us/i, category: 'about' },
  { pattern: /contact/i, category: 'contact' },
  { pattern: /gallery/i, category: 'gallery' },
  { pattern: /events?/i, category: 'events' },
  { pattern: /news/i, category: 'news' },
];

const SKIP_KEYWORDS = [
  /login/i,
  /register/i,
  /signup/i,
  /cart/i,
  /payment/i,
  /\.pdf$/i, // PDFs handled separately in the PDF pipeline
  /\.doc[x]?$/i,
  /\.xls[x]?$/i,
  /mailto:/i,
  /tel:/i,
  /javascript:/i,
  /#$/,
];

/**
 * Score a URL for crawl priority.
 */
export function scoreUrl(url: string): ScoredUrl {
  const urlLower = url.toLowerCase();

  // Skip obvious non-content URLs
  for (const skip of SKIP_KEYWORDS) {
    if (skip.test(urlLower)) {
      return { url, priority: 'skip', score: 0, category: 'skip' };
    }
  }

  // Check high priority
  for (const { pattern, category } of HIGH_PRIORITY_KEYWORDS) {
    if (pattern.test(urlLower)) {
      return { url, priority: 'high', score: 100, category };
    }
  }

  // Check medium priority
  for (const { pattern, category } of MEDIUM_PRIORITY_KEYWORDS) {
    if (pattern.test(urlLower)) {
      return { url, priority: 'medium', score: 50, category };
    }
  }

  // Check low priority
  for (const { pattern, category } of LOW_PRIORITY_KEYWORDS) {
    if (pattern.test(urlLower)) {
      return { url, priority: 'low', score: 20, category };
    }
  }

  // Default: low priority, generic category
  return { url, priority: 'low', score: 10, category: 'other' };
}

/**
 * Score and sort a list of URLs by relevance.
 * Filters out 'skip' URLs.
 */
export function rankUrls(urls: string[]): ScoredUrl[] {
  return urls
    .map(scoreUrl)
    .filter(s => s.priority !== 'skip')
    .sort((a, b) => b.score - a.score);
}

/**
 * Check if a URL is a PDF link (handled separately).
 */
export function isPdfUrl(url: string): boolean {
  return /\.pdf$/i.test(url) || /\/pdf\//i.test(url);
}
