/**
 * schemas/index.js
 *
 * Combines all category schemas into:
 *   1. CollegeDataSchema — the full structured payload that goes into MongoDB
 *   2. ScrapeMeta — the metadata block that tracks scrape health
 *   3. Category → schema + description mapping (used by llmExtractor.js)
 */

import { z } from 'zod';
import { PlacementsSchema, PlacementsSchemaDescription } from './placements.schema.js';
import { AdmissionsSchema, AdmissionsSchemaDescription } from './admissions.schema.js';
import { BasicInfoSchema, BasicInfoSchemaDescription } from './basicInfo.schema.js';
import { AcademicsSchema, AcademicsSchemaDescription } from './academics.schema.js';

// ── ScrapeMeta schema (mirrors the MongoDB sub-document) ──────────────────────

export const ScrapeMetaSchema = z.object({
  lastScrapedAt: z.date().nullable().optional(),
  sourceUrls: z.object({
    home: z.string().nullable().optional(),
    placements: z.string().nullable().optional(),
    admissions: z.string().nullable().optional(),
    basicInfo: z.string().nullable().optional(),
    academics: z.string().nullable().optional(),
  }).default({}),
  contentHash: z.object({
    placements: z.string().nullable().optional(),
    admissions: z.string().nullable().optional(),
    basicInfo: z.string().nullable().optional(),
    academics: z.string().nullable().optional(),
  }).default({}),
  /** 0–1 confidence from the LLM (or derived from % of required fields filled) */
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  /** Whether a human admin has reviewed and approved this record */
  verifiedByAdmin: z.boolean().default(false),
  /** 'success' | 'failed' | 'needs_review' | 'stale' | 'pending' */
  scrapeStatus: z.enum(['success', 'failed', 'needs_review', 'stale', 'pending']).default('pending'),
  /** Which extraction method was used: rule-based selectors or LLM */
  extractionMethod: z.enum(['rules', 'llm']).nullable().optional(),
  /** Count of consecutive failures (for circuit breaker) */
  failureCount: z.number().int().nonnegative().default(0),
  /** Whether the circuit is currently open for this domain */
  circuitOpen: z.boolean().default(false),
  lastFailureAt: z.date().nullable().optional(),
  /** Optional admin note after review */
  reviewNotes: z.string().nullable().optional(),
});

// ── Full college data envelope ────────────────────────────────────────────────

export const CollegeDataSchema = z.object({
  placements: PlacementsSchema.nullable().optional(),
  admissions: AdmissionsSchema.nullable().optional(),
  basicInfo: BasicInfoSchema.nullable().optional(),
  academics: AcademicsSchema.nullable().optional(),
});

// ── Category registry ─────────────────────────────────────────────────────────
/**
 * Maps each scrapeable category to its Zod schema and LLM prompt description.
 * llmExtractor.js iterates this map when extracting per-category.
 */
export const CATEGORY_REGISTRY = {
  placements: {
    schema: PlacementsSchema,
    description: PlacementsSchemaDescription,
    label: 'Placements & Career Statistics',
  },
  admissions: {
    schema: AdmissionsSchema,
    description: AdmissionsSchemaDescription,
    label: 'Admissions & Fees',
  },
  basicInfo: {
    schema: BasicInfoSchema,
    description: BasicInfoSchemaDescription,
    label: 'Basic Info & Accreditation',
  },
  academics: {
    schema: AcademicsSchema,
    description: AcademicsSchemaDescription,
    label: 'Academics & Faculty',
  },
};

/** Valid category keys */
export const CATEGORIES = /** @type {const} */ (Object.keys(CATEGORY_REGISTRY));

export {
  PlacementsSchema,
  AdmissionsSchema,
  BasicInfoSchema,
  AcademicsSchema,
  PlacementsSchemaDescription,
  AdmissionsSchemaDescription,
  BasicInfoSchemaDescription,
  AcademicsSchemaDescription,
};
