/**
 * utils/scoring.js
 * Recalculates cached scores for a specific user using the EXACT formula:
 * Leaderboard Points = (Final CF Rating / 2) + (Final LC Rating / 2) + (Final CC Rating / 2) + (Final HR Rating / 3) + (Final HE Rating / 3)
 *
 * Final Rating = Admin Override if available, otherwise Actual Fetched Rating.
 */

import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Announcement from '../models/Announcement.js';
import TeamPost from '../models/TeamPost.js';
import HackathonResult from '../models/HackathonResult.js';

let _cache = null;

export function setCache(cache) {
  _cache = cache;
}

export function calculatePlatformRatings(profile) {
  // Actual fetched contest ratings
  const actualCF = profile.actual_codeforces_rating || profile.cf_rating || 0;
  const actualLC = profile.actual_leetcode_rating || profile.lc_rating || 0;
  const actualCC = profile.actual_codechef_rating || profile.cc_rating || 0;
  const actualHR = profile.actual_hackerrank_rating || profile.hr_rating || profile.hr_score || 0;
  const actualHE = profile.actual_hackerearth_rating || profile.he_rating || 0;

  // Admin overrides if present
  const adminCF = profile.admin_codeforces_rating ?? profile.override_cf_score ?? null;
  const adminLC = profile.admin_leetcode_rating ?? profile.override_lc_score ?? null;
  const adminCC = profile.admin_codechef_rating ?? profile.override_cc_score ?? null;
  const adminHR = profile.admin_hackerrank_rating ?? profile.override_hr_score ?? null;
  const adminHE = profile.admin_hackerearth_rating ?? profile.override_he_score ?? null;

  // Final ratings
  const finalCF = adminCF !== null && adminCF !== undefined ? adminCF : actualCF;
  const finalLC = adminLC !== null && adminLC !== undefined ? adminLC : actualLC;
  const finalCC = adminCC !== null && adminCC !== undefined ? adminCC : actualCC;
  const finalHR = adminHR !== null && adminHR !== undefined ? adminHR : actualHR;
  const finalHE = adminHE !== null && adminHE !== undefined ? adminHE : actualHE;

  // EXACT Leaderboard Points Formula:
  // (CF / 2) + (LC / 2) + (CC / 2) + (HR / 3) + (HE / 3)
  const leaderboardPoints =
    (finalCF / 2.0) +
    (finalLC / 2.0) +
    (finalCC / 2.0) +
    (finalHR / 3.0) +
    (finalHE / 3.0);

  const roundedPoints = Math.round(leaderboardPoints * 100) / 100;

  return {
    actual: {
      cf: actualCF,
      lc: actualLC,
      cc: actualCC,
      hr: actualHR,
      he: actualHE,
    },
    admin: {
      cf: adminCF,
      lc: adminLC,
      cc: adminCC,
      hr: adminHR,
      he: adminHE,
    },
    final: {
      cf: finalCF,
      lc: finalLC,
      cc: finalCC,
      hr: finalHR,
      he: finalHE,
    },
    leaderboard_points: roundedPoints,
  };
}

export async function updateUserScores(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const profile = await Profile.findOne({ user: userId });
  if (!profile) return;

  // 1. Hackathon Score
  const hResults = await HackathonResult.find({ user: userId });
  const hackathonScore = hResults.reduce((sum, r) => sum + (r.points || 0), 0);
  profile.hackathon_score = hackathonScore;

  // 2. Activity Score
  const announcementsCount = await Announcement.countDocuments({ author: userId });
  const teamPostsCount = await TeamPost.countDocuments({ author: userId });
  const activityScore = announcementsCount * 10 + teamPostsCount * 5;
  profile.activity_score = activityScore;

  // 3. Exact Leaderboard Points Calculation
  const ratingsObj = calculatePlatformRatings(profile);

  // Sync actual ratings on profile fields
  profile.actual_codeforces_rating = ratingsObj.actual.cf;
  profile.actual_leetcode_rating = ratingsObj.actual.lc;
  profile.actual_codechef_rating = ratingsObj.actual.cc;
  profile.actual_hackerrank_rating = ratingsObj.actual.hr;
  profile.actual_hackerearth_rating = ratingsObj.actual.he;

  // Sync admin overrides on profile fields
  profile.admin_codeforces_rating = ratingsObj.admin.cf;
  profile.admin_leetcode_rating = ratingsObj.admin.lc;
  profile.admin_codechef_rating = ratingsObj.admin.cc;
  profile.admin_hackerrank_rating = ratingsObj.admin.hr;
  profile.admin_hackerearth_rating = ratingsObj.admin.he;

  // Store Leaderboard Points in cp_score
  profile.cp_score = ratingsObj.leaderboard_points;

  // Global score calculation for overall platform ranking
  const finalGithub = profile.override_github_score ?? (user.github_score || 0);
  const globalScore = profile.cp_score + hackathonScore * 1.5 + activityScore + (finalGithub * 5.0);
  profile.global_score = Math.round(globalScore * 100) / 100;

  await profile.save();

  // Clear leaderboard cache for auto-re-ranking
  try {
    if (_cache) _cache.flushAll();
  } catch {
    // Ignore cache errors
  }
}
