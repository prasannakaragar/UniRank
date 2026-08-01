/**
 * schemas/admissions.schema.js
 *
 * Zod schema for admissions data extracted from college websites.
 *
 * Design notes:
 * - Fee structures vary enormously: some colleges list per-semester, some
 *   per-year, some total. We store the raw string alongside parsed number.
 * - Entrance exams are stored as plain strings (not an enum) because new
 *   state-level exams appear regularly.
 * - Seat matrix is a key-value map (category → seats) since each state has
 *   its own reservation categories.
 */

import { z } from 'zod';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const ProgramSchema = z.object({
  /** e.g. "B.Tech", "M.Tech", "MBA", "MCA", "Ph.D" */
  name: z.string(),
  /** e.g. "Computer Science and Engineering" */
  specialization: z.string().nullable().optional(),
  /** Total sanctioned seats */
  totalSeats: z.number().int().nonnegative().nullable().optional(),
  /** Duration string, e.g. "4 years" */
  duration: z.string().nullable().optional(),
  /** Eligibility criteria as a plain string */
  eligibility: z.string().nullable().optional(),
});

const FeeStructureSchema = z.object({
  /** Annual fee in INR for General category */
  generalAnnualINR: z.number().nonnegative().nullable().optional(),
  /** Annual fee in INR for OBC-NCL */
  obcAnnualINR: z.number().nonnegative().nullable().optional(),
  /** Annual fee in INR for SC/ST */
  scStAnnualINR: z.number().nonnegative().nullable().optional(),
  /** Total fee for full programme duration in INR */
  totalProgrammeINR: z.number().nonnegative().nullable().optional(),
  /** Hostel fee per year in INR */
  hostelAnnualINR: z.number().nonnegative().nullable().optional(),
  /**
   * Original string from page, e.g. "₹2,12,000/semester (General)"
   * Store this because the parsed number might be wrong.
   */
  raw: z.string().nullable().optional(),
}).nullable().optional();

const ScholarshipSchema = z.object({
  name: z.string(),
  /** Annual value in INR */
  amountINR: z.number().nonnegative().nullable().optional(),
  eligibility: z.string().nullable().optional(),
});

// ── Main schema ───────────────────────────────────────────────────────────────

export const AdmissionsSchema = z.object({
  /** All programmes offered: B.Tech, M.Tech, MBA etc. */
  programs: z.array(ProgramSchema).default([]),

  /**
   * Entrance exams accepted for admission.
   * e.g. ["JEE Advanced", "JEE Main", "GATE", "KCET", "TANCET"]
   */
  entranceExams: z.array(z.string()).default([]),

  /** Fee structure for B.Tech (most important for UniRank users) */
  btechFees: FeeStructureSchema,

  /** Fee structure for M.Tech if available */
  mtechFees: FeeStructureSchema,

  /** Available scholarships */
  scholarships: z.array(ScholarshipSchema).default([]),

  /**
   * Seat matrix as a flat key-value map.
   * Keys are category names (Open, OBC-NCL, SC, ST, EWS, etc.)
   * Values are seat counts.
   * e.g. { "Open": 120, "OBC-NCL": 64, "SC": 36, "ST": 18 }
   */
  seatMatrix: z.record(z.string(), z.number().int().nonnegative()).nullable().optional(),

  /**
   * Application/admission deadline.
   * Store as a string — could be "July 2024", "15-Jul-2024", or "TBA".
   */
  applicationDeadline: z.string().nullable().optional(),

  /** High-level description of the admission process */
  admissionProcess: z.string().nullable().optional(),

  /** Documents required for admission */
  requiredDocuments: z.array(z.string()).default([]),

  /** Description of counselling (JoSAA, CSAB, state counselling, etc.) */
  counsellingProcess: z.string().nullable().optional(),

  /** Does the college have a management quota? */
  managementQuota: z.boolean().nullable().optional(),

  /** Does the college have an NRI quota? */
  nriQuota: z.boolean().nullable().optional(),

  /**
   * URL of the official admission portal or brochure PDF
   */
  admissionPortalUrl: z.string().nullable().optional(),

  /**
   * LLM notes: caveats, data quality observations, or why certain
   * fields could not be extracted.
   */
  extractionNotes: z.string().nullable().optional(),
});

export const AdmissionsSchemaDescription = `
Extract admissions / application information from an Indian engineering college website.
Return a JSON object matching this TypeScript type:
{
  programs: Array<{
    name: string,                       // e.g. "B.Tech", "M.Tech", "MBA"
    specialization?: string | null,     // e.g. "Computer Science and Engineering"
    totalSeats?: number | null,
    duration?: string | null,           // e.g. "4 years"
    eligibility?: string | null,
  }>,
  entranceExams: string[],              // e.g. ["JEE Advanced", "GATE", "KCET"]
  btechFees?: {
    generalAnnualINR?: number | null,   // annual fee INR, General category
    obcAnnualINR?: number | null,
    scStAnnualINR?: number | null,
    totalProgrammeINR?: number | null,
    hostelAnnualINR?: number | null,
    raw?: string | null,                // original fee string from page
  } | null,
  mtechFees?: { generalAnnualINR?: number | null, raw?: string | null } | null,
  scholarships: Array<{ name: string, amountINR?: number | null, eligibility?: string | null }>,
  seatMatrix?: { [category: string]: number } | null,  // e.g. {"Open":120,"OBC-NCL":64}
  applicationDeadline?: string | null,
  admissionProcess?: string | null,
  requiredDocuments: string[],
  counsellingProcess?: string | null,
  managementQuota?: boolean | null,
  nriQuota?: boolean | null,
  admissionPortalUrl?: string | null,
  extractionNotes?: string | null,
}

Rules:
- Fees should be annual (per year) in INR. If given per semester, multiply by 2.
- Return null for any field you cannot find; never guess or hallucinate numbers.
- List every programme you find, including PG programmes.
- For seatMatrix use standard category abbreviations: Open, OBC-NCL, SC, ST, EWS, PwD.
- Keep extractionNotes brief (1-2 sentences max).
`.trim();
