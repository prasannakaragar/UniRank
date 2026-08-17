/**
 * utils/hackerrank.js
 * Wrapper to fetch user statistics from HackerRank using public REST endpoints.
 */

import axios from 'axios';

const HACKERRANK_BASE = 'https://www.hackerrank.com/rest/hackers';

export async function getHackerrankStats(username) {
  if (!username || typeof username !== 'string') return null;
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  try {
    const profileResp = await axios.get(`${HACKERRANK_BASE}/${encodeURIComponent(cleanUsername)}/profile`, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (profileResp.status !== 200 || !profileResp.data?.model) {
      return null;
    }

    const model = profileResp.data.model;

    // Fetch badges
    let badgesCount = 0;
    let totalScore = 0;
    let problemsSolved = 0;

    try {
      const badgesResp = await axios.get(`${HACKERRANK_BASE}/${encodeURIComponent(cleanUsername)}/badges`, {
        timeout: 8000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      if (badgesResp.status === 200 && Array.isArray(badgesResp.data?.models)) {
        const badges = badgesResp.data.models;
        badgesCount = badges.length;
        for (const badge of badges) {
          totalScore += parseInt(badge.hacker_score || 0, 10);
          problemsSolved += parseInt(badge.solved || 0, 10);
        }
      }
    } catch {
      // Badges endpoint optional
    }

    return {
      hr_badges: badgesCount,
      hr_score: totalScore || parseInt(model.score || 0, 10),
      hr_problems_solved: problemsSolved || parseInt(model.solved_challenges || 0, 10),
    };
  } catch (err) {
    console.log(`[HACKERRANK] Error fetching stats for ${cleanUsername}: ${err.message}`);
    return null;
  }
}

export async function syncHackerrankStats(username) {
  const stats = await getHackerrankStats(username);
  return stats || {};
}
