/**
 * config/index.js
 * Centralised environment config for the scraper service.
 * All modules import from here — never from process.env directly.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key) {
  const value = process.env[key];
  if (!value) throw new Error(`[config] Missing required env var: ${key}`);
  return value;
}

function optional(key, defaultValue) {
  return process.env[key] ?? defaultValue;
}

export const config = {
  // ── Database ──────────────────────────────────────────────────────────────
  mongoUri: required('MONGODB_URI'),

  // ── Redis ─────────────────────────────────────────────────────────────────
  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    password: optional('REDIS_PASSWORD', undefined),
  },

  // ── LLM ──────────────────────────────────────────────────────────────────
  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: optional('GEMINI_MODEL', 'gemini-flash-lite-latest'),

  // ── Auth ─────────────────────────────────────────────────────────────────
  jwtSecret: required('JWT_SECRET'),

  // ── Admin dashboard ───────────────────────────────────────────────────────
  adminPort: parseInt(optional('ADMIN_PORT', '5001'), 10),

  // ── Scraper behaviour ─────────────────────────────────────────────────────
  perDomainMinIntervalMs: parseInt(optional('PER_DOMAIN_MIN_INTERVAL_MS', '2000'), 10),
  circuitBreakerThreshold: parseInt(optional('CIRCUIT_BREAKER_THRESHOLD', '5'), 10),
  circuitBreakerResetMinutes: parseInt(optional('CIRCUIT_BREAKER_RESET_MINUTES', '10'), 10),
  crawlerConcurrency: parseInt(optional('CRAWLER_CONCURRENCY', '3'), 10),
  pageTimeoutMs: parseInt(optional('PAGE_TIMEOUT_MS', '30000'), 10),
  confidenceThreshold: parseFloat(optional('CONFIDENCE_THRESHOLD', '0.70')),

  // ── Snapshot storage ──────────────────────────────────────────────────────
  // Phase 1: local filesystem. Phase 2: swap implementation in snapshotStore.js
  snapshotDir: path.resolve(
    __dirname,
    '../../',
    optional('SNAPSHOT_DIR', './data/snapshots')
  ),

  // ── Environment ───────────────────────────────────────────────────────────
  isDev: optional('NODE_ENV', 'development') === 'development',
};
