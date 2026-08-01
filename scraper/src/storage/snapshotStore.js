/**
 * storage/snapshotStore.js
 *
 * Abstraction layer for raw snapshot storage.
 *
 * Phase 1: local filesystem under SNAPSHOT_DIR (scraper/data/snapshots/).
 * Phase 2: swap saveSnapshot / loadSnapshot implementations for an S3/R2 client.
 *          No calling code changes needed — the interface is stable.
 *
 * Interface:
 *   saveSnapshot(collegeId, category, content, extension?) → { path, sizeBytes }
 *   loadSnapshot(collegeId, category, extension?)          → string | null
 *   snapshotExists(collegeId, category, extension?)        → boolean
 *   deleteSnapshot(collegeId, category, extension?)        → void
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

// Ensure the snapshot directory exists at startup
fs.mkdirSync(config.snapshotDir, { recursive: true });

/**
 * Builds the filesystem path for a snapshot file.
 * @param {string} collegeId  - MongoDB ObjectId string or domain slug
 * @param {string} category   - e.g. 'placements', 'admissions'
 * @param {string} extension  - file extension without leading dot, default 'txt'
 */
function snapshotPath(collegeId, category, extension = 'txt') {
  // Sanitise collegeId so it's safe as a directory name
  const safeId = String(collegeId).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const dir = path.join(config.snapshotDir, safeId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${category}.${extension}`);
}

/**
 * Save a raw snapshot to storage.
 *
 * @param {string} collegeId
 * @param {string} category
 * @param {string|Buffer} content - raw HTML text or PDF buffer
 * @param {string} [extension='txt']
 * @returns {{ filePath: string, sizeBytes: number }}
 */
export function saveSnapshot(collegeId, category, content, extension = 'txt') {
  const filePath = snapshotPath(collegeId, category, extension);
  const data = typeof content === 'string' ? content : content;
  fs.writeFileSync(filePath, data);
  const sizeBytes = fs.statSync(filePath).size;
  return { filePath, sizeBytes };
}

/**
 * Load a previously-saved snapshot from storage.
 *
 * @param {string} collegeId
 * @param {string} category
 * @param {string} [extension='txt']
 * @returns {string | null} - file contents or null if not found
 */
export function loadSnapshot(collegeId, category, extension = 'txt') {
  const filePath = snapshotPath(collegeId, category, extension);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Check if a snapshot exists without reading its contents.
 */
export function snapshotExists(collegeId, category, extension = 'txt') {
  return fs.existsSync(snapshotPath(collegeId, category, extension));
}

/**
 * Delete a snapshot (e.g. after a failed scrape that produced garbage).
 */
export function deleteSnapshot(collegeId, category, extension = 'txt') {
  const filePath = snapshotPath(collegeId, category, extension);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * List all snapshots for a given college.
 * Returns an array of { category, extension, filePath, sizeBytes, modifiedAt }
 */
export function listSnapshots(collegeId) {
  const safeId = String(collegeId).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const dir = path.join(config.snapshotDir, safeId);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).map((filename) => {
    const [category, extension] = filename.split('.');
    const filePath = path.join(dir, filename);
    const stat = fs.statSync(filePath);
    return {
      category,
      extension,
      filePath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime,
    };
  });
}
