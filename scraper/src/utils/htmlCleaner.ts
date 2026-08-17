/**
 * utils/htmlCleaner.ts
 *
 * Strips scripts, styles, nav, footer, and excess whitespace from HTML
 * to produce clean readable text for extraction.
 */

import * as cheerio from 'cheerio';

/**
 * Clean HTML into readable text suitable for extraction.
 * Removes noise elements and normalizes whitespace.
 *
 * @param html - Raw HTML string
 * @param maxLength - Maximum text length (default 15000 for LLM context)
 */
export function htmlToCleanText(html: string, maxLength = 15000): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('script, style, noscript, svg, iframe, nav, footer, header, [role="navigation"], [role="banner"]').remove();

  // Get text from body
  let text = $('body').text();

  // Normalize whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Truncate if needed
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n\n[... content truncated ...]';
  }

  return text;
}

/**
 * Extract all internal links from an HTML page.
 * Returns absolute URLs only, filtered to same-domain.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: Set<string> = new Set();
  let baseDomain: string;

  try {
    baseDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {
    return [];
  }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const absolute = new URL(href, baseUrl).href;
      const linkDomain = new URL(absolute).hostname.replace(/^www\./, '');

      // Only same-domain links
      if (linkDomain === baseDomain || linkDomain.endsWith('.' + baseDomain)) {
        // Strip fragments
        const cleaned = absolute.split('#')[0];
        if (cleaned) links.add(cleaned);
      }
    } catch {
      // Invalid URL — skip
    }
  });

  return Array.from(links);
}

/**
 * Extract text from specific selectors relevant to placement data.
 * Returns extracted snippets keyed by what they contain.
 */
export function extractRelevantSections(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const sections = new Map<string, string>();

  // Look for tables (often contain placement statistics)
  $('table').each((i, table) => {
    const tableText = $(table).text().replace(/\s+/g, ' ').trim();
    if (tableText.length > 20) {
      sections.set(`table_${i}`, tableText);
    }
  });

  // Look for sections with placement-related headings
  const placementHeadings = /placement|package|salary|ctc|recruit|nirf|rank/i;
  $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
    const headingText = $(heading).text().trim();
    if (placementHeadings.test(headingText)) {
      // Get the heading and its following siblings until the next heading
      let sectionText = headingText + '\n';
      let next = $(heading).next();
      let count = 0;
      while (next.length > 0 && !next.is('h1, h2, h3, h4, h5, h6') && count < 20) {
        sectionText += next.text().replace(/\s+/g, ' ').trim() + '\n';
        next = next.next();
        count++;
      }
      sections.set(`section_${headingText.slice(0, 50)}`, sectionText.trim());
    }
  });

  return sections;
}
