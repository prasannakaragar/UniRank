/**
 * utils/hackerearth.js
 * Wrapper to fetch user statistics from HackerEarth using public profile scraping.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const HACKEREARTH_URL = 'https://www.hackerearth.com/@';

export async function getHackerearthStats(username) {
  if (!username || typeof username !== 'string') return null;
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) return null;

  try {
    const resp = await axios.get(`${HACKEREARTH_URL}${encodeURIComponent(cleanUsername)}`, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (resp.status !== 200) return null;

    const $ = cheerio.load(resp.data);
    const bodyText = $('body').text();

    // Rating pattern e.g. "Rating: 1650" or rating number block
    let rating = 0;
    const ratingMatch = bodyText.match(/(?:rating|score)\s*[:\-–=]?\s*(\d{3,5})/i);
    if (ratingMatch) {
      rating = parseInt(ratingMatch[1], 10);
    }

    // Problems solved pattern e.g. "Problems Solved: 145"
    let problemsSolved = 0;
    const problemsMatch = bodyText.match(/(?:problems?\s*solved|solutions?)\s*[:\-–=]?\s*(\d+)/i);
    if (problemsMatch) {
      problemsSolved = parseInt(problemsMatch[1], 10);
    }

    // Contests pattern e.g. "Contests: 12"
    let contests = 0;
    const contestsMatch = bodyText.match(/contests?\s*[:\-–=]?\s*(\d+)/i);
    if (contestsMatch) {
      contests = parseInt(contestsMatch[1], 10);
    }

    return {
      he_rating: rating,
      he_problems_solved: problemsSolved,
      he_contests: contests,
    };
  } catch (err) {
    console.log(`[HACKEREARTH] Error fetching stats for ${cleanUsername}: ${err.message}`);
    return null;
  }
}

export async function syncHackerearthStats(username) {
  const stats = await getHackerearthStats(username);
  return stats || {};
}
