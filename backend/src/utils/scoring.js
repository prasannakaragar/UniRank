/**
 * utils/scoring.js
 * Recalculates cached scores for a specific user.
 */

import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Announcement from '../models/Announcement.js';
import TeamPost from '../models/TeamPost.js';
import HackathonResult from '../models/HackathonResult.js';

// Global cache reference — set by app.js after cache is created
let _cache = null;

export function setCache(cache) {
  _cache = cache;
}

export async function updateUserScores(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const profile = await Profile.findOne({ user: userId });
  if (!profile) return;

  // 1. Hackathon Score
  const hResults = await HackathonResult.find({ user: userId });
  const hackathonScore = hResults.reduce((sum, r) => sum + r.points, 0);
  profile.hackathon_score = hackathonScore;

  // 2. Activity Score
  const announcementsCount = await Announcement.countDocuments({ author: userId });
  const teamPostsCount = await TeamPost.countDocuments({ author: userId });
  const activityScore = announcementsCount * 10 + teamPostsCount * 5;
  profile.activity_score = activityScore;

  // 3. Global Score Calculation
  const cpScore = (profile.cf_rating + profile.lc_rating) / 2.0;
  profile.cp_score = Math.round(cpScore * 100) / 100;

  const cpComponent =
    profile.cf_rating / 10.0 +
    profile.cf_problems_solved * 0.1 +
    profile.lc_rating / 10.0 +
    profile.lc_problems_solved * 0.1;

  // GitHub Portfolio Component
  const githubComponent = user.github_score * 5.0;

  const globalScore =
    cpComponent + hackathonScore * 1.5 + activityScore + githubComponent;

  profile.global_score = Math.round(globalScore * 100) / 100;
  await profile.save();

  // Clear leaderboard cache since scores changed
  try {
    if (_cache) _cache.flushAll();
  } catch {
    // Ignore cache errors
  }
}
