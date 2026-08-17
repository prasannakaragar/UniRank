/**
 * utils/codechef.js
 * Wrapper to fetch user statistics from CodeChef using public API/scrape endpoints.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const CODECHEF_API_URL = 'https://codechef-api.vercel.app/handle';
const CODECHEF_USER_URL = 'https://www.codechef.com/users';

export async function getCodechefStats(username) {
  if (!username || typeof username !== 'string') return null;
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  // Try Vercel wrapper API first
  try {
    const resp = await axios.get(`${CODECHEF_API_URL}/${encodeURIComponent(cleanUsername)}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (resp.status === 200 && resp.data && resp.data.success !== false) {
      const data = resp.data;
      const currentRating = parseInt(data.currentRating || data.rating || 0, 10);
      const highestRating = parseInt(data.highestRating || data.maxRating || currentRating, 10);
      const stars = data.stars || (currentRating > 0 ? `${getStarsFromRating(currentRating)}★` : '1★');
      const problemsSolved = parseInt(data.totalSolved || data.problemsSolved || 0, 10);
      const contests = parseInt(data.contests || data.ratingData?.length || 0, 10);

      return {
        cc_rating: isNaN(currentRating) ? 0 : currentRating,
        cc_max_rating: isNaN(highestRating) ? currentRating : highestRating,
        cc_stars: stars,
        cc_problems_solved: isNaN(problemsSolved) ? 0 : problemsSolved,
        cc_contests: isNaN(contests) ? 0 : contests,
      };
    }
  } catch (err) {
    // Fallback to HTML scrape if API fails
  }

  // Scrape fallback from codechef.com/users/:username
  try {
    const resp = await axios.get(`${CODECHEF_USER_URL}/${encodeURIComponent(cleanUsername)}`, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (resp.status !== 200) return null;

    const $ = cheerio.load(resp.data);
    const ratingText = $('.rating-number').first().text().trim();
    const currentRating = parseInt(ratingText, 10) || 0;

    const highestText = $('.rating-header small').first().text();
    const highestMatch = highestText.match(/\d+/);
    const highestRating = highestMatch ? parseInt(highestMatch[0], 10) : currentRating;

    const starsText = $('.rating-star').text().trim() || `${getStarsFromRating(currentRating)}★`;

    const problemsText = $('.problems-solved h5').text() || '';
    const problemsMatch = problemsText.match(/\d+/);
    const problemsSolved = problemsMatch ? parseInt(problemsMatch[0], 10) : 0;

    return {
      cc_rating: currentRating,
      cc_max_rating: Math.max(currentRating, highestRating),
      cc_stars: starsText,
      cc_problems_solved: problemsSolved,
      cc_contests: 0,
    };
  } catch (scrapeErr) {
    console.log(`[CODECHEF] Error fetching stats for ${cleanUsername}: ${scrapeErr.message}`);
    return null;
  }
}

function getStarsFromRating(rating) {
  if (rating < 1400) return 1;
  if (rating < 1600) return 2;
  if (rating < 1800) return 3;
  if (rating < 2000) return 4;
  if (rating < 2200) return 5;
  if (rating < 2500) return 6;
  return 7;
}

export async function syncCodechefStats(username) {
  const stats = await getCodechefStats(username);
  return stats || {};
}
