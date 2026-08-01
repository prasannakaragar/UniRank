/**
 * schemas/basicInfo.schema.js
 *
 * Zod schema for basic college identity / accreditation data.
 */

import { z } from 'zod';

export const BasicInfoSchema = z.object({
  /** Official full name, e.g. "Indian Institute of Technology Bombay" */
  officialName: z.string().nullable().optional(),

  /** Common short name, e.g. "IIT Bombay" */
  shortName: z.string().nullable().optional(),

  /** URL to the college logo image */
  logoUrl: z.string().nullable().optional(),

  /** URL to a cover/banner image */
  coverImageUrl: z.string().nullable().optional(),

  /** Year the institution was established, e.g. 1958 */
  establishedYear: z.number().int().min(1800).max(2030).nullable().optional(),

  /**
   * Ownership type.
   * "central" = centrally funded (IIT, NIT, IIIT, IISER)
   * "state"   = state government university
   * "deemed"  = deemed-to-be university
   * "private" = private college (not deemed)
   * "autonomous" = autonomous college affiliated to a university
   */
  ownership: z.enum(['central', 'state', 'deemed', 'private', 'autonomous']).nullable().optional(),

  /** University type as per UGC classification */
  universityType: z.string().nullable().optional(),

  // ── Accreditation ─────────────────────────────────────────────────────────
  naacGrade: z.enum(['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C', 'D']).nullable().optional(),
  naacScore: z.number().min(0).max(4).nullable().optional(),
  nbaAccredited: z.boolean().nullable().optional(),
  /** Which programmes are NBA accredited */
  nbaPrograms: z.array(z.string()).default([]),
  nirfRanking: z.number().int().positive().nullable().optional(),
  nirfRankingYear: z.number().int().nullable().optional(),
  /** Other rankings, e.g. { "QS Asia": 200, "Times Higher Ed": 350 } */
  otherRankings: z.record(z.string(), z.number()).nullable().optional(),

  // ── Contact ──────────────────────────────────────────────────────────────
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pinCode: z.string().regex(/^\d{6}$/).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  officialEmail: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  admissionsContactEmail: z.string().email().nullable().optional(),

  extractionNotes: z.string().nullable().optional(),
});

export const BasicInfoSchemaDescription = `
Extract basic identity and accreditation information from an Indian engineering college website.
Return a JSON object matching this structure:
{
  officialName?: string | null,
  shortName?: string | null,
  logoUrl?: string | null,
  coverImageUrl?: string | null,
  establishedYear?: number | null,
  ownership?: "central"|"state"|"deemed"|"private"|"autonomous" | null,
  universityType?: string | null,
  naacGrade?: "A++"|"A+"|"A"|"B++"|"B+"|"B"|"C"|"D" | null,
  naacScore?: number | null,        // 0-4 scale
  nbaAccredited?: boolean | null,
  nbaPrograms: string[],
  nirfRanking?: number | null,
  nirfRankingYear?: number | null,
  otherRankings?: { [rankingName: string]: number } | null,
  address?: string | null,
  city?: string | null,
  state?: string | null,
  pinCode?: string | null,          // 6-digit string
  latitude?: number | null,
  longitude?: number | null,
  officialEmail?: string | null,
  phone?: string | null,
  admissionsContactEmail?: string | null,
  extractionNotes?: string | null,
}
Rules: Return null for missing fields. Never hallucinate rankings or scores.
`.trim();
