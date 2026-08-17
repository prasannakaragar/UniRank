/**
 * utils/hackerrank.js
 * Wrapper to fetch user statistics from HackerRank using public REST API and HTML fallback parser.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const HACKERRANK_BASE = 'https://www.hackerrank.com/rest/hackers';
const HACKERRANK_PROFILE_URL = 'https://www.hackerrank.com/profile';

export async function getHackerrankStats(username) {
  if (!username || typeof username !== 'string') return null;
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) return null;

  // Try REST API endpoint first
  try {
    const profileResp = await axios.get(`${HACKERRANK_BASE}/${encodeURIComponent(cleanUsername)}/profile`, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (profileResp.status === 200 && profileResp.data?.model) {
      const model = profileResp.data.model;
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
    }
  } catch {
    // Fallback to HTML page scrape
  }

  // HTML page scrape fallback
  try {
    const resp = await axios.get(`${HACKERRANK_PROFILE_URL}/${encodeURIComponent(cleanUsername)}`, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (resp.status !== 200) return null;

    const $ = cheerio.load(resp.data);
    let badgesCount = 0;
    let totalScore = 0;
    let problemsSolved = 0;

    // Parse embedded JSON data inside script tags
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';
      if (scriptText.includes('badges') || scriptText.includes('scores')) {
        const match = scriptText.match(/(%7B%22contestHistory%22.*)/);
        if (match) {
          try {
            const raw = match[1].split('&quot;')[0].split('"')[0].split(';')[0];
            const decoded = JSON.parse(decodeURIComponent(raw));
            if (Array.isArray(decoded.badges)) {
              badgesCount = decoded.badges.length;
              for (const b of decoded.badges) {
                totalScore += parseInt(b.hacker_score || 0, 10);
                problemsSolved += parseInt(b.solved || 0, 10);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    });

    return {
      hr_badges: badgesCount,
      hr_score: totalScore,
      hr_problems_solved: problemsSolved,
    };
  } catch (scrapeErr) {
    console.log(`[HACKERRANK] Error fetching stats for ${cleanUsername}: ${scrapeErr.message}`);
    return null;
  }
}

export async function syncHackerrankStats(username) {
  const stats = await getHackerrankStats(username);
  return stats || {};
}
