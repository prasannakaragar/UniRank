/**
 * validators/schemas.ts
 *
 * Zod schemas for all data types crossing boundaries.
 * Used for validating extracted data before MongoDB insertion.
 */

import { z } from 'zod';

// ── Source tracking ───────────────────────────────────────────────────────────

export const SourceSchema = z.object({
  url: z.string().url(),
  type: z.enum(['official', 'official_pdf', 'official_report', 'third_party']),
  lastVerified: z.coerce.date(),
});

export const SourcedValueSchema = z.object({
  value: z.number().nonnegative().nullable(),
  currency: z.string().default('INR'),
  status: z.enum(['DISCLOSED', 'NOT_DISCLOSED']),
  raw: z.string().nullable().optional(),
  source: SourceSchema,
  confidence: z.number().min(0).max(1),
  extractionMethod: z.enum(['rules', 'llm']),
});

// ── Placement extraction result ───────────────────────────────────────────────

export const PlacementExtractionSchema = z.object({
  year: z.string().nullable().optional(),
  highestPackage: SourcedValueSchema.nullable().optional(),
  averagePackage: SourcedValueSchema.nullable().optional(),
  medianPackage: SourcedValueSchema.nullable().optional(),
  placementRatePct: z.number().min(0).max(100).nullable().optional(),
  totalOffers: z.number().int().nonnegative().nullable().optional(),
  totalEligibleStudents: z.number().int().nonnegative().nullable().optional(),
  recruiters: z.array(z.string()).default([]),
  topRecruiters: z.array(z.string()).default([]),
  companiesCount: z.number().int().nonnegative().nullable().optional(),
  placementReportUrl: z.string().nullable().optional(),
});

// ── NIRF extraction result ────────────────────────────────────────────────────

export const NirfExtractionSchema = z.object({
  rank: z.number().int().positive(),
  category: z.string(),
  year: z.number().int().min(2000).max(2030),
  score: z.number().nullable().optional(),
  source: SourceSchema,
});

// ── Basic info extraction result ──────────────────────────────────────────────

export const BasicInfoExtractionSchema = z.object({
  name: z.string().nullable().optional(),
  established: z.number().int().min(1800).max(2030).nullable().optional(),
  accreditation: z.array(z.string()).default([]),
  nirfRank: z.number().int().positive().nullable().optional(),
  about: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
});

// ── LLM extraction response ──────────────────────────────────────────────────

export const LLMPlacementResponseSchema = z.object({
  batch_year: z.string().nullable().optional(),
  highest_package_lpa: z.number().nonnegative().nullable().optional(),
  highest_package_raw: z.string().nullable().optional(),
  average_package_lpa: z.number().nonnegative().nullable().optional(),
  average_package_raw: z.string().nullable().optional(),
  median_package_lpa: z.number().nonnegative().nullable().optional(),
  placement_rate_pct: z.number().min(0).max(100).nullable().optional(),
  total_offers: z.number().int().nonnegative().nullable().optional(),
  total_eligible: z.number().int().nonnegative().nullable().optional(),
  recruiters: z.array(z.string()).default([]),
  top_recruiters: z.array(z.string()).default([]),
  companies_count: z.number().int().nonnegative().nullable().optional(),
  placement_report_url: z.string().nullable().optional(),
  _confidence: z.number().min(0).max(1).optional(),
});

export type LLMPlacementResponse = z.infer<typeof LLMPlacementResponseSchema>;
export type PlacementExtraction = z.infer<typeof PlacementExtractionSchema>;
export type NirfExtraction = z.infer<typeof NirfExtractionSchema>;
export type BasicInfoExtraction = z.infer<typeof BasicInfoExtractionSchema>;
