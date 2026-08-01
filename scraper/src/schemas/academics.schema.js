/**
 * schemas/academics.schema.js
 *
 * Zod schema for academic programs, departments, and faculty data.
 */

import { z } from 'zod';

const DepartmentSchema = z.object({
  name: z.string(),
  /** e.g. "B.Tech", "M.Tech", "Ph.D" */
  programs: z.array(z.string()).default([]),
  /** Number of faculty members in the department */
  facultyCount: z.number().int().nonnegative().nullable().optional(),
  /** URL to department page */
  departmentUrl: z.string().nullable().optional(),
});

const FacultySchema = z.object({
  name: z.string(),
  designation: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  specialization: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

export const AcademicsSchema = z.object({
  /** All departments / schools */
  departments: z.array(DepartmentSchema).default([]),

  /**
   * All B.Tech specializations offered.
   * e.g. ["CSE", "ECE", "Mechanical", "Civil", "Chemical"]
   */
  btechBranches: z.array(z.string()).default([]),

  /** All PG programmes (M.Tech, MBA, MCA, etc.) */
  pgPrograms: z.array(z.string()).default([]),

  /** Does the college offer Ph.D programmes? */
  phdOffered: z.boolean().nullable().optional(),

  /** URL to academic calendar PDF or page */
  academicCalendarUrl: z.string().nullable().optional(),

  /** URLs to curriculum / syllabus documents */
  curriculumUrls: z.array(z.string()).default([]),

  /** Total sanctioned faculty positions */
  totalFacultyCount: z.number().int().nonnegative().nullable().optional(),

  /** Fraction of faculty with Ph.D, e.g. 0.85 for 85% */
  phdFacultyFraction: z.number().min(0).max(1).nullable().optional(),

  /**
   * Sample of notable faculty (max 10 — don't try to scrape the full list
   * in Phase 1; a faculty directory can be thousands of rows).
   */
  notableFaculty: z.array(FacultySchema).max(10).default([]),

  /** Total student enrollment */
  totalStudentCount: z.number().int().nonnegative().nullable().optional(),

  extractionNotes: z.string().nullable().optional(),
});

export const AcademicsSchemaDescription = `
Extract academic program and faculty information from an Indian engineering college website.
Return a JSON object:
{
  departments: Array<{ name: string, programs: string[], facultyCount?: number | null, departmentUrl?: string | null }>,
  btechBranches: string[],          // e.g. ["CSE","ECE","Mechanical","Civil"]
  pgPrograms: string[],             // e.g. ["M.Tech CSE","MBA","MCA"]
  phdOffered?: boolean | null,
  academicCalendarUrl?: string | null,
  curriculumUrls: string[],
  totalFacultyCount?: number | null,
  phdFacultyFraction?: number | null,  // 0-1, e.g. 0.85
  notableFaculty: Array<{ name: string, designation?: string, department?: string, specialization?: string, email?: string | null }>,
  totalStudentCount?: number | null,
  extractionNotes?: string | null,
}
Rules: Return null for missing fields. Include at most 10 faculty entries. Don't hallucinate.
`.trim();
