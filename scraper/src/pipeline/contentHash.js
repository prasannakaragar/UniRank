/**
 * pipeline/contentHash.js
 *
 * sha256-based content change detection.
 * Stores a hash of the raw page text per category.
 * If the hash matches what's in MongoDB, we skip re-extraction (saves LLM cost).
 */

import { createHash } from 'crypto';

/**
 * Compute sha256 of a string, returning a hex digest.
 * @param {string} content
 * @returns {string}
 */
export function computeHash(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Returns true if the content has NOT changed since last scrape.
 *
 * @param {string} freshContent - raw text from the page just fetched
 * @param {string | null | undefined} storedHash - hash from college.scrapeMeta.contentHash[category]
 * @returns {boolean}
 */
export function isUnchanged(freshContent, storedHash) {
  if (!storedHash) return false; // no previous hash → always extract
  return computeHash(freshContent) === storedHash;
}
