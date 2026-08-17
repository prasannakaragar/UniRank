/**
 * pipeline/contentHash.ts
 *
 * SHA-256 based content change detection.
 * Normalizes content before hashing so insignificant whitespace changes don't trigger re-extraction.
 */

import { createHash } from 'crypto';

/**
 * Compute SHA-256 of normalized content.
 */
export function computeHash(content: string): string {
  const normalized = normalizeForHash(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Compute a URL hash for content-addressable lookup.
 */
export function computeUrlHash(url: string): string {
  return createHash('sha256').update(url.toLowerCase().trim(), 'utf8').digest('hex');
}

/**
 * Returns true if the content has NOT changed since last scrape.
 */
export function isContentUnchanged(freshContent: string, storedHash: string | null): boolean {
  if (!storedHash) return false; // No previous hash → always extract
  return computeHash(freshContent) === storedHash;
}

/**
 * Normalize content for hashing:
 * - Collapse all whitespace to single spaces
 * - Lowercase
 * - Strip HTML comments
 * - Trim
 * This ensures that mere formatting changes don't invalidate the cache.
 */
function normalizeForHash(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')  // Strip HTML comments
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .toLowerCase()
    .trim();
}
