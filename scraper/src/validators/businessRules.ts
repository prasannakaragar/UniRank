/**
 * validators/businessRules.ts
 *
 * Business rule validation for extracted data.
 * Catches impossible values that schema validation alone can't detect.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate placement data against business rules.
 */
export function validatePlacementData(data: {
  highestPackage?: number | null;
  averagePackage?: number | null;
  medianPackage?: number | null;
  placementRatePct?: number | null;
  totalOffers?: number | null;
  totalEligibleStudents?: number | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Average should never exceed highest
  if (
    data.highestPackage != null &&
    data.averagePackage != null &&
    data.averagePackage > data.highestPackage
  ) {
    errors.push(`Average package (${data.averagePackage}) exceeds highest (${data.highestPackage})`);
  }

  // Median should not exceed highest
  if (
    data.highestPackage != null &&
    data.medianPackage != null &&
    data.medianPackage > data.highestPackage
  ) {
    errors.push(`Median package (${data.medianPackage}) exceeds highest (${data.highestPackage})`);
  }

  // Suspiciously high packages (>200 LPA for Indian colleges)
  if (data.highestPackage != null && data.highestPackage > 20000000) {
    warnings.push(`Highest package (₹${data.highestPackage}) is unusually high — verify source`);
  }

  // Negative values should never exist
  if (data.highestPackage != null && data.highestPackage < 0) {
    errors.push(`Negative highest package: ${data.highestPackage}`);
  }
  if (data.averagePackage != null && data.averagePackage < 0) {
    errors.push(`Negative average package: ${data.averagePackage}`);
  }

  // Total offers shouldn't exceed eligible students
  if (
    data.totalOffers != null &&
    data.totalEligibleStudents != null &&
    data.totalOffers > data.totalEligibleStudents * 3 // Allow for multiple offers per student
  ) {
    warnings.push(`Total offers (${data.totalOffers}) seems too high relative to eligible students (${data.totalEligibleStudents})`);
  }

  // Placement rate sanity
  if (data.placementRatePct != null && data.placementRatePct > 100) {
    errors.push(`Placement rate ${data.placementRatePct}% exceeds 100%`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate NIRF ranking data.
 */
export function validateNirfData(data: {
  rank?: number | null;
  year?: number | null;
  score?: number | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.rank != null && data.rank < 1) {
    errors.push(`Invalid NIRF rank: ${data.rank}`);
  }

  if (data.year != null && (data.year < 2016 || data.year > new Date().getFullYear() + 1)) {
    warnings.push(`NIRF year ${data.year} seems out of range (NIRF started in 2016)`);
  }

  if (data.score != null && (data.score < 0 || data.score > 100)) {
    errors.push(`NIRF score ${data.score} out of valid range 0-100`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
