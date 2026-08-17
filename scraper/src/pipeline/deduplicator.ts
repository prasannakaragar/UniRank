/**
 * pipeline/deduplicator.ts
 *
 * Generates a stable SHA-256 fingerprint for internship records to deduplicate
 * occurrences across faculty profile pages, department sites, announcements, etc. (§9)
 */

import { createHash } from 'crypto';

export function generateInternshipFingerprint(
  universityId: string,
  facultyName: string,
  projectName: string,
  sourceUrl: string,
): string {
  let sourceDomain = '';
  try {
    sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    sourceDomain = sourceUrl;
  }

  const raw = [
    universityId.trim(),
    facultyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    projectName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    sourceDomain.toLowerCase(),
  ].join('|');

  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
