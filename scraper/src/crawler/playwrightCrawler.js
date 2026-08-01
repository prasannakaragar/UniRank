/**
 * crawler/playwrightCrawler.js
 *
 * Playwright-based page fetcher with:
 *   - robots.txt respect + Crawl-delay enforcement
 *   - Per-domain rate limiting (min interval between requests)
 *   - Per-request timeout
 *   - Circuit breaker integration
 *   - Returns { text, html, url, finalUrl, contentType }
 *
 * Uses a single shared browser instance (launched lazily).
 * Page-level concurrency is controlled by the BullMQ worker concurrency setting.
 */

import { chromium } from 'playwright';
import robotsParser from 'robots-parser';
import { config } from '../config/index.js';
import { checkCircuit, recordSuccess, recordFailure } from './circuitBreaker.js';

// ── Browser singleton ─────────────────────────────────────────────────────────
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('[Crawler] Chromium browser launched');
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[Crawler] Chromium browser closed');
  }
}

// ── Per-domain rate limiter (last request timestamp) ─────────────────────────
const lastRequestAt = new Map(); // domain → timestamp (ms)

async function respectRateLimit(domain) {
  const last = lastRequestAt.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  const minInterval = config.perDomainMinIntervalMs;
  if (elapsed < minInterval) {
    const delay = minInterval - elapsed;
    await sleep(delay);
  }
  lastRequestAt.set(domain, Date.now());
}

// ── robots.txt cache ──────────────────────────────────────────────────────────
const robotsCache = new Map(); // domain → { robots, crawlDelay, fetchedAt }
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getRobots(domain) {
  const cached = robotsCache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) {
    return cached;
  }

  const robotsUrl = `https://${domain}/robots.txt`;
  let robotsTxt = '';
  try {
    const res = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': SCRAPER_UA },
    });
    if (res.ok) robotsTxt = await res.text();
  } catch {
    // robots.txt not found or timeout — treat as no restrictions
  }

  const robots = robotsParser(robotsUrl, robotsTxt);
  // Extract Crawl-delay for our user agent (default 0)
  const crawlDelay = (robots.getCrawlDelay(SCRAPER_UA) ?? 0) * 1000;

  const entry = { robots, crawlDelay, fetchedAt: Date.now() };
  robotsCache.set(domain, entry);
  return entry;
}

// ── User-agent string ─────────────────────────────────────────────────────────
const SCRAPER_UA =
  'UniRankBot/1.0 (+https://unirank.in/bot; college-data-indexer; respectful-crawler)';

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Strips scripts, styles, nav, footer, and excess whitespace from HTML
 * to produce clean readable text for LLM consumption.
 *
 * @param {string} html
 * @returns {string} cleaned plain text (≈ 8000–15000 chars for a typical page)
 */
export function htmlToCleanText(html) {
  // Remove script, style, noscript, svg, iframe blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // Replace block-level tags with newlines
  text = text
    .replace(/<\/?(br|p|div|section|article|header|footer|nav|main|h[1-6]|li|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ') // strip remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Truncate to ~15,000 chars to stay within LLM context limits
  if (text.length > 15000) {
    text = text.slice(0, 15000) + '\n\n[... content truncated for LLM context limit ...]';
  }

  return text;
}

// ── Main fetch function ───────────────────────────────────────────────────────

/**
 * Fetches a URL using Playwright (JS-rendered) and returns cleaned content.
 *
 * @param {string} url - The URL to fetch
 * @param {{ waitUntil?: string, timeout?: number }} [options]
 * @returns {Promise<{
 *   html: string,
 *   text: string,
 *   url: string,
 *   finalUrl: string,
 *   contentType: string,
 *   fetchedAt: Date,
 * }>}
 */
export async function fetchPage(url, options = {}) {
  const domain = extractDomain(url);
  const timeout = options.timeout ?? config.pageTimeoutMs;

  // ── Circuit breaker check ────────────────────────────────────────────────
  checkCircuit(domain); // throws CircuitOpenError if open

  // ── robots.txt check ─────────────────────────────────────────────────────
  const { robots, crawlDelay } = await getRobots(domain);
  // isAllowed returns true/false/undefined. undefined means no explicit rule → treat as allowed.
  // Also check against Googlebot as fallback (some sites only specify rules for major bots).
  const allowed = robots.isAllowed(url, SCRAPER_UA);
  const allowedGooglebot = robots.isAllowed(url, 'Googlebot');
  if (allowed === false && allowedGooglebot === false) {
    throw new RobotsDisallowedError(url, domain);
  }


  // ── Rate limiting ────────────────────────────────────────────────────────
  await respectRateLimit(domain);
  if (crawlDelay > 0) {
    await sleep(Math.max(crawlDelay, config.perDomainMinIntervalMs));
  }

  // ── Playwright page fetch ─────────────────────────────────────────────────
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: SCRAPER_UA,
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const page = await context.newPage();

  // Block heavy assets to speed up fetches (images, fonts, media)
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,mp3,woff,woff2,ttf,eot}', (route) =>
    route.abort()
  );

  try {
    await page.goto(url, {
      waitUntil: options.waitUntil ?? 'networkidle',
      timeout,
    });

    const finalUrl = page.url();
    const html = await page.content();
    const text = htmlToCleanText(html);
    const contentType = 'text/html'; // Playwright always returns rendered HTML

    recordSuccess(domain);

    return {
      html,
      text,
      url,
      finalUrl,
      contentType,
      fetchedAt: new Date(),
    };
  } catch (err) {
    const { circuitOpened } = recordFailure(domain);
    if (circuitOpened) {
      console.error(`[Crawler] Circuit opened for ${domain} after repeated failures`);
    }
    throw new CrawlerError(url, domain, err.message);
  } finally {
    await context.close();
  }
}

/**
 * Lightweight fetch for known-static URLs (no JS rendering needed).
 * Falls back to fetchPage if response looks JS-rendered (empty body).
 *
 * @param {string} url
 * @returns {Promise<{ html: string, text: string, url: string, finalUrl: string }>}
 */
export async function fetchPageStatic(url) {
  const domain = extractDomain(url);
  checkCircuit(domain);

  const { robots } = await getRobots(domain);
  if (!robots.isAllowed(url, SCRAPER_UA)) {
    throw new RobotsDisallowedError(url, domain);
  }

  await respectRateLimit(domain);

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(config.pageTimeoutMs),
      headers: {
        'User-Agent': SCRAPER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();

    // If the body looks like a blank SPA shell, fall back to Playwright
    const bodyContent = html.replace(/<[^>]+>/g, '').trim();
    if (bodyContent.length < 200) {
      console.log(`[Crawler] Static fetch returned near-empty body for ${url}, falling back to Playwright`);
      recordSuccess(domain);
      return fetchPage(url);
    }

    const text = htmlToCleanText(html);
    recordSuccess(domain);
    return { html, text, url, finalUrl: res.url ?? url, contentType: 'text/html', fetchedAt: new Date() };
  } catch (err) {
    const { circuitOpened } = recordFailure(domain);
    if (circuitOpened) {
      console.error(`[Crawler] Circuit opened for ${domain}`);
    }
    throw new CrawlerError(url, domain, err.message);
  }
}

// ── Error types ───────────────────────────────────────────────────────────────

export class CrawlerError extends Error {
  constructor(url, domain, cause) {
    super(`Crawler failed for ${url}: ${cause}`);
    this.name = 'CrawlerError';
    this.url = url;
    this.domain = domain;
    this.cause = cause;
  }
}

export class RobotsDisallowedError extends Error {
  constructor(url, domain) {
    super(`robots.txt disallows scraping ${url}`);
    this.name = 'RobotsDisallowedError';
    this.url = url;
    this.domain = domain;
  }
}
