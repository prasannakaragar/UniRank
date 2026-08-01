/**
 * utils/codeforces.js
 * Wrapper around the public Codeforces REST API.
 */

import axios from 'axios';

const CF_BASE = 'https://codeforces.com/api';

export async function getUserInfo(handle) {
  try {
    const resp = await axios.get(`${CF_BASE}/user.info`, {
      params: { handles: handle },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000,
    });
    const data = resp.data;
    if (data.status !== 'OK') return null;
    const user = data.result[0];
    return {
      cf_rating: user.rating || 0,
      cf_max_rating: user.maxRating || 0,
      cf_rank: user.rank || 'unrated',
      avatar_url: user.avatar || null,
    };
  } catch {
    return null;
  }
}

export async function getProblemsSolved(handle) {
  try {
    const resp = await axios.get(`${CF_BASE}/user.status`, {
      params: { handle, from: 1, count: 10000 },
      timeout: 15000,
    });
    const data = resp.data;
    if (data.status !== 'OK') return 0;

    const solved = new Set();
    for (const sub of data.result) {
      if (sub.verdict === 'OK') {
        const p = sub.problem;
        solved.add(`${p.contestId}_${p.index}`);
      }
    }
    return solved.size;
  } catch {
    return 0;
  }
}

export async function getUserContests(handle) {
  try {
    const resp = await axios.get(`${CF_BASE}/user.rating`, {
      params: { handle },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000,
    });
    const data = resp.data;
    if (data.status !== 'OK') return 0;
    return (data.result || []).length;
  } catch {
    return 0;
  }
}

export async function syncUserStats(handle) {
  const info = (await getUserInfo(handle)) || {};
  const problems = await getProblemsSolved(handle);
  const contests = await getUserContests(handle);
  return { ...info, cf_problems_solved: problems, cf_contests: contests };
}
