/**
 * schemas/placements.schema.js
 *
 * Zod schema for placement data extracted from college websites.
 *
 * Design notes:
 * - Every field is .optional() or .nullable() — college sites are wildly
 *   inconsistent. Strict required fields would fail on ~60% of sites.
 * - Package values are stored as numbers (LPA) alongside the raw string so
 *   we can sort/compare without re-parsing later.
 * - The schema is what gets sent to the LLM as a JSON Shape instruction, so
 *   field names and descriptions must be self-documenting.
 */

import { z } from 'zod';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const PackageSchema = z.object({
  /** Package value in Lakhs Per Annum (LPA). Null if not available. */
  valueLPA: z.number().nonnegative().nullable().optional(),
  /** Original string from the page, e.g. "44 LPA" or "₹44,00,000" */
  raw: z.string().nullable().optional(),
}).nullable().optional();

const BranchStatsSchema = z.object({
  branch: z.string(),
  /** e.g. "Computer Science and Engineering" */
  averagePackageLPA: z.number().nonnegative().nullable().optional(),
  placementRatePct: z.number().min(0).max(100).nullable().optional(),
  totalOffers: z.number().int().nonnegative().nullable().optional(),
});

const InternshipStatsSchema = z.object({
  /** Average monthly stipend in INR */
  avgMonthlyStipendINR: z.number().nonnegative().nullable().optional(),
  /** e.g. "₹50,000/month" */
  avgMonthlyStipendRaw: z.string().nullable().optional(),
  topCompanies: z.array(z.string()).default([]),
  /** % of eligible students who got internships */
  internshipRatePct: z.number().min(0).max(100).nullable().optional(),
  totalInterns: z.number().int().nonnegative().nullable().optional(),
}).nullable().optional();

// ── Main schema ───────────────────────────────────────────────────────────────

export const PlacementsSchema = z.object({
  /** Academic year this data refers to, e.g. "2023-24" */
  batchYear: z.string().nullable().optional(),

  highestPackage: PackageSchema,
  averagePackage: PackageSchema,
  medianPackage: PackageSchema,

  /** Overall placement percentage (0–100) */
  placementRatePct: z.number().min(0).max(100).nullable().optional(),

  /** Total job offers received */
  totalOffers: z.number().int().nonnegative().nullable().optional(),

  /** Total eligible students in the batch */
  totalEligibleStudents: z.number().int().nonnegative().nullable().optional(),

  /** All unique recruiters mentioned (company names) */
  recruiters: z.array(z.string()).default([]),

  /**
   * Top/marquee recruiters highlighted by the college.
   * Subset of recruiters[].
   */
  topRecruiters: z.array(z.string()).default([]),

  /** Number of unique companies that recruited */
  companiesCount: z.number().int().nonnegative().nullable().optional(),

  /** Direct URL to placement report PDF if one exists */
  placementReportUrl: z.string().nullable().optional(),

  internshipStats: InternshipStatsSchema,

  /** Per-branch breakdown if available */
  branchWise: z.array(BranchStatsSchema).default([]),

  /**
   * International offers count or percentage.
   * e.g. 12 students got offers from foreign companies.
   */
  internationalOffers: z.number().int().nonnegative().nullable().optional(),

  /**
   * LLM notes: caveats, data quality observations, or why certain
   * fields could not be extracted.
   */
  extractionNotes: z.string().nullable().optional(),
});

export const PlacementsSchemaDescription = `
Extract placement/career statistics from Indian engineering college websites.
Return a JSON object matching this TypeScript type:
{
  batchYear?: string | null,           // e.g. "2023-24"
  highestPackage?: { valueLPA?: number | null, raw?: string | null } | null,
  averagePackage?: { valueLPA?: number | null, raw?: string | null } | null,
  medianPackage?: { valueLPA?: number | null, raw?: string | null } | null,
  placementRatePct?: number | null,    // 0-100, e.g. 95.3
  totalOffers?: number | null,
  totalEligibleStudents?: number | null,
  recruiters: string[],                // all company names mentioned
  topRecruiters: string[],             // marquee/highlighted companies
  companiesCount?: number | null,
  placementReportUrl?: string | null,  // URL to PDF if found
  internshipStats?: {
    avgMonthlyStipendINR?: number | null,
    avgMonthlyStipendRaw?: string | null,
    topCompanies: string[],
    internshipRatePct?: number | null,
    totalInterns?: number | null,
  } | null,
  branchWise: Array<{ branch: string, averagePackageLPA?: number | null, placementRatePct?: number | null, totalOffers?: number | null }>,
  internationalOffers?: number | null,
  extractionNotes?: string | null,     // note any missing data or caveats
}

Rules:
- Convert all package values to LPA (Lakhs Per Annum). If given in CTC, assume CTC = LPA.
- Return null for any field you cannot find; never guess or hallucinate numbers.
- Include ALL company names you find in recruiters[].
- Keep extractionNotes brief (1-2 sentences max).
`.trim();
