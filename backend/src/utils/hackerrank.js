/**
 * utils/hackerrank.js
 * Fetches user statistics from HackerRank using their internal REST API.
 */

import axios from 'axios';

const HACKERRANK_PROFILE_URL =
  'https://www.hackerrank.com/rest/contests/master/users/{username}/profile';

export async function getHackerrankStats(username) {
  const url = HACKERRANK_PROFILE_URL.replace('{username}', username);
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });
    if (resp.status !== 200) return null;

    const model = resp.data?.model;
    if (!model) return null;

    return {
      hr_score: parseInt(model.total_score || 0, 10),
      hr_rank: model.rank || 0,
    };
  } catch (err) {
    console.log(`Error fetching HackerRank stats for ${username}: ${err.message}`);
    return null;
  }
}

export async function syncHackerrankStats(username) {
  const stats = await getHackerrankStats(username);
  return stats || {};
}
