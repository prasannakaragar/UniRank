/**
 * config/index.ts
 * Centralised, Zod-validated environment config for the scraper service.
 * All modules import from here — never from process.env directly.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // LLM
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),

  // Auth
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  // Scraper service
  SCRAPER_PORT: z.coerce.number().default(5002),

  // Crawl behaviour
  PER_DOMAIN_DELAY_MS: z.coerce.number().default(2000),
  MAX_CONCURRENCY: z.coerce.number().default(5),
  PAGE_TIMEOUT_MS: z.coerce.number().default(30000),
  CONFIDENCE_THRESHOLD: z.coerce.number().default(0.70),

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_RESET_MINUTES: z.coerce.number().default(10),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  mongoUri: parsed.data.MONGODB_URI,

  gemini: {
    apiKey: parsed.data.GEMINI_API_KEY,
    model: parsed.data.GEMINI_MODEL,
  },

  jwtSecret: parsed.data.JWT_SECRET,
  scraperPort: parsed.data.SCRAPER_PORT,

  crawl: {
    perDomainDelayMs: parsed.data.PER_DOMAIN_DELAY_MS,
    maxConcurrency: parsed.data.MAX_CONCURRENCY,
    pageTimeoutMs: parsed.data.PAGE_TIMEOUT_MS,
    confidenceThreshold: parsed.data.CONFIDENCE_THRESHOLD,
  },

  circuitBreaker: {
    threshold: parsed.data.CIRCUIT_BREAKER_THRESHOLD,
    resetMinutes: parsed.data.CIRCUIT_BREAKER_RESET_MINUTES,
  },

  isDev: parsed.data.NODE_ENV === 'development',
  nodeEnv: parsed.data.NODE_ENV,
} as const;

export type Config = typeof config;
