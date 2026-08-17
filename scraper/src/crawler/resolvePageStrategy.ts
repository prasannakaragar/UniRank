/**
 * crawler/resolvePageStrategy.ts
 *
 * Decides whether a URL can be handled with Cheerio (HTTP-only)
 * or requires Playwright (JS-rendered).
 *
 * Decision flow:
 * 1. HTTP GET the URL (with TLS fallback & custom headers)
 * 2. Load into Cheerio, probe for target content
 * 3. If content found → 'cheerio'
 * 4. If body is too thin (<200 chars stripped) or network fetch fails → 'playwright'
 *
 * Never defaults to Playwright.
 */

import * as cheerio from 'cheerio';
import https from 'https';
import axios from 'axios';
import { config } from '../config/index.js';

export type PageStrategy = 'cheerio' | 'playwright';

export interface StrategyResult {
  strategy: PageStrategy;
  html: string;
  statusCode: number;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
}

export const SCRAPER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 UniRankBot/2.0';

// HttpsAgent allowing legacy/self-signed certs commonly found on Indian college servers
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Probes relevant to college pages (placements, NIRF, basic info)
 */
const CONTENT_PROBES = [
  /(?:highest|maximum)\s*(?:package|salary|ctc)/i,
  /(?:average|mean)\s*(?:package|salary|ctc)/i,
  /placement\s*(?:rate|percentage|statistics|record|data)/i,
  /(?:placed|recruited)\s*(?:students?|candidates?)/i,
  /(?:campus|off.?campus)\s*(?:placement|recruitment|drive)/i,
  /(?:top|major)\s*recruiters?/i,
  /nirf\s*rank/i,
  /national\s*institutional\s*ranking/i,
  /(?:established|founded)\s*(?:in)?\s*\d{4}/i,
  /(?:naac|nba|aicte)\s*(?:accreditation|approved|grade)/i,
  /(?:department|faculty|programme|course|admission)/i,
];

/**
 * Resolve whether a URL should be fetched with Cheerio (static) or Playwright (JS-rendered).
 */
export async function resolvePageStrategy(url: string): Promise<StrategyResult> {
  try {
    const response = await axios.get(url, {
      timeout: config.crawl.pageTimeoutMs,
      headers: {
        'User-Agent': SCRAPER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      httpsAgent,
      maxRedirects: 5,
      validateStatus: () => true, // Accept all HTTP status codes without throwing
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data || '');
    const statusCode = response.status;
    const etag = (response.headers['etag'] as string) || null;
    const lastModified = (response.headers['last-modified'] as string) || null;
    const finalUrl = response.request?.res?.responseUrl || url;

    if (statusCode >= 400 || !html) {
      return { strategy: 'playwright', html, statusCode, etag, lastModified, finalUrl };
    }

    // Load into Cheerio and check if meaningful content is present
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    if (bodyText.length < 200) {
      return { strategy: 'playwright', html, statusCode, etag, lastModified, finalUrl };
    }

    const hasContent = CONTENT_PROBES.some(probe => probe.test(bodyText));
    const hasStructure = $('table, p, ul, ol, dl, article').length > 3;

    if (hasContent || hasStructure) {
      return { strategy: 'cheerio', html, statusCode, etag, lastModified, finalUrl };
    }

    return { strategy: 'playwright', html, statusCode, etag, lastModified, finalUrl };
  } catch (err) {
    // If HTTP GET throws (DNS failure, network timeout), escalate to Playwright probe
    return {
      strategy: 'playwright',
      html: '',
      statusCode: 0,
      etag: null,
      lastModified: null,
      finalUrl: url,
    };
  }
}

/**
 * Fetch a page using Playwright (JS-rendered).
 * Only called when resolvePageStrategy returns 'playwright'.
 */
export async function fetchWithPlaywright(url: string): Promise<{ html: string; finalUrl: string }> {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--ignore-certificate-errors'],
  });

  try {
    const context = await browser.newContext({
      userAgent: SCRAPER_UA,
      locale: 'en-US',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Block unnecessary media assets to save bandwidth
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,mp3,woff,woff2,ttf,eot}', (route) =>
      route.abort()
    );

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: config.crawl.pageTimeoutMs,
    });

    const finalUrl = page.url();
    const html = await page.content();

    await context.close();
    return { html, finalUrl };
  } finally {
    await browser.close();
  }
}
