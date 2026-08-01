/**
 * utils/academicYear.js — UniRank
 * Core academic year calculation engine using July-rollover rule.
 * Eliminates static year tracking and automatically progresses students each academic session.
 */

/**
 * Returns the current academic session year.
 * Rule: If current month >= 7 (July, 1-indexed), use current calendar year.
 * Else use previous calendar year.
 */
export function getCurrentAcademicSession(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed: Jan=1, Jul=7
  return month >= 7 ? year : year - 1;
}

/**
 * Calculates current year of study based on admissionYear.
 * Capped at maxYears (default 4): 5th year and beyond display as Year 4.
 * @param {number} admissionYear - Year student was admitted.
 * @param {number} maxYears - Program duration in years (default 4).
 * @param {Date} date - Optional reference date.
 * @returns {object} { yearOfStudy, rawYear, isAlumni, displayString }
 */
export function getCurrentYearOfStudy(admissionYear, maxYears = 4, date = new Date()) {
  if (!admissionYear || isNaN(admissionYear)) {
    return { yearOfStudy: 1, rawYear: 1, isAlumni: false, displayString: 'Year 1' };
  }

  const currentSession = getCurrentAcademicSession(date);
  const rawYear = currentSession - admissionYear + 1;
  const isAlumni = rawYear > maxYears;

  // Cap at maxYears (4th year only, no 5th year)
  const cappedYear = Math.min(Math.max(1, rawYear), maxYears);

  return {
    yearOfStudy: cappedYear,
    rawYear,
    isAlumni,
    displayString: `Year ${cappedYear}`,
  };
}

/**
 * Calculates admissionYear for a new registration in the CURRENT session.
 * Formula: admissionYear = currentAcademicSession - selectedYear + 1
 */
export function calculateAdmissionYear(selectedYearOfStudy, date = new Date()) {
  const session = getCurrentAcademicSession(date);
  let numericYear = 1;
  if (typeof selectedYearOfStudy === 'number') {
    numericYear = selectedYearOfStudy;
  } else if (selectedYearOfStudy) {
    const extracted = parseInt(selectedYearOfStudy.toString().replace(/\D/g, ''), 10);
    if (!isNaN(extracted) && extracted > 0) numericYear = extracted;
  }
  return session - numericYear + 1;
}

/**
 * Derives admissionYear for migrating STALE static year records from the PREVIOUS cycle.
 * Formula: admissionYear = currentAcademicSession - storedStaticYear
 */
export function deriveAdmissionYearForMigration(storedStaticYear, date = new Date()) {
  const session = getCurrentAcademicSession(date);
  let numericYear = 1;
  if (typeof storedStaticYear === 'number') {
    numericYear = storedStaticYear;
  } else if (storedStaticYear) {
    const extracted = parseInt(storedStaticYear.toString().replace(/\D/g, ''), 10);
    if (!isNaN(extracted) && extracted > 0) numericYear = extracted;
  }
  return session - numericYear;
}
