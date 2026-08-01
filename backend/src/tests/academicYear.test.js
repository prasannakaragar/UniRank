/**
 * tests/academicYear.test.js — UniRank
 * Unit tests for academic year calculations, July-rollover rules, Alumni formatting,
 * registration calculation, and stale migration derivation.
 */

import assert from 'assert';
import {
  getCurrentAcademicSession,
  getCurrentYearOfStudy,
  calculateAdmissionYear,
  deriveAdmissionYearForMigration,
} from '../utils/academicYear.js';

function runTests() {
  console.log('🧪 Running Academic Year Unit Tests...\n');

  const testDateAug2026 = new Date('2026-08-01');
  assert.strictEqual(getCurrentAcademicSession(testDateAug2026), 2026);

  // Test 1: New registration in August 2026 as Year 1 -> admissionYear = 2026 -> evaluates to Year 1
  const newRegAdmYear = calculateAdmissionYear(1, testDateAug2026);
  assert.strictEqual(newRegAdmYear, 2026);
  const newStudent = getCurrentYearOfStudy(newRegAdmYear, 4, testDateAug2026);
  assert.strictEqual(newStudent.rawYear, 1);
  assert.strictEqual(newStudent.displayString, 'Year 1');
  console.log('✅ Test 1 Passed: New student registering as Year 1 in Aug 2026 gets admissionYear 2026 (Year 1).');

  // Test 2: Stale record migration: Student stored as Year 1 from June 2025 -> admissionYear 2025 -> evaluates to Year 2 in Aug 2026
  const migratedAdmYear = deriveAdmissionYearForMigration(1, testDateAug2026);
  assert.strictEqual(migratedAdmYear, 2025);
  const bumpedStudent = getCurrentYearOfStudy(migratedAdmYear, 4, testDateAug2026);
  assert.strictEqual(bumpedStudent.rawYear, 2);
  assert.strictEqual(bumpedStudent.displayString, 'Year 2');
  console.log('✅ Test 2 Passed: Stale Year 1 student (admitted June 2025) derives admissionYear 2025 and bumps to Year 2 today.');

  // Test 3: Student past maxYears (Admitted 2021, maxYears = 4 -> displays as Year 4)
  const alumniStudent = getCurrentYearOfStudy(2021, 4, testDateAug2026);
  assert.strictEqual(alumniStudent.isAlumni, true);
  assert.strictEqual(alumniStudent.displayString, 'Year 4');
  console.log('✅ Test 3 Passed: Student past 4 years returns isAlumni: true and "Year 4" display string.');

  // Test 4: July Rollover check (June 2026 vs August 2026 for 2025 admit)
  const testDateJune2026 = new Date('2026-06-15');
  const juneCheck = getCurrentYearOfStudy(2025, 4, testDateJune2026);
  assert.strictEqual(juneCheck.displayString, 'Year 1');

  const augCheck = getCurrentYearOfStudy(2025, 4, testDateAug2026);
  assert.strictEqual(augCheck.displayString, 'Year 2');
  console.log('✅ Test 4 Passed: July rollover rule correctly evaluates 2025 admit as Year 1 in June and Year 2 in August.');

  // Test 5: String-safe parsing
  assert.strictEqual(calculateAdmissionYear('Year 2', testDateAug2026), 2025);
  assert.strictEqual(deriveAdmissionYearForMigration('Year 3', testDateAug2026), 2023);
  console.log('✅ Test 5 Passed: String-safe parsing verified for both registration and migration helpers.');

  console.log('\n🎉 All Academic Year Unit Tests Passed Successfully!\n');
}

runTests();
