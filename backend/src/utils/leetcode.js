/**
 * utils/leetcode.js
 * Fetches user statistics and contest ratings from LeetCode using their GraphQL API.
 */

import axios from 'axios';

const LEETCODE_URL = 'https://leetcode.com/graphql';

export async function getLeetcodeStats(username) {
  const query = `
    query userStats($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        topPercentage
      }
    }
  `;

  try {
    const resp = await axios.post(
      LEETCODE_URL,
      { query, variables: { username } },
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          Referer: 'https://leetcode.com/',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (resp.status !== 200) return null;

    const data = resp.data;
    if (data.errors) return null;

    const result = data.data || {};
    const matchedUser = result.matchedUser;
    const contestRanking = result.userContestRanking;

    if (!matchedUser) return null;

    // Get total problems solved
    const stats = matchedUser.submitStatsGlobal?.acSubmissionNum || [];
    let totalSolved = 0;
    for (const item of stats) {
      if (item.difficulty === 'All') {
        totalSolved = item.count;
        break;
      }
    }

    // Get contest rating and global rank
    let rating = 0;
    let globalRank = 0;
    if (contestRanking) {
      rating = parseInt(contestRanking.rating || 0, 10);
      globalRank = contestRanking.globalRanking || 0;
    }

    return {
      lc_problems_solved: totalSolved,
      lc_rating: rating,
      lc_rank: globalRank,
      lc_max_rating: rating,
    };
  } catch (err) {
    console.log(`Error fetching LeetCode stats for ${username}: ${err.message}`);
    return null;
  }
}

export async function syncLeetcodeStats(username) {
  const stats = await getLeetcodeStats(username);
  return stats || {};
}
