/**
 * utils/githubStats.js
 * Fetch GitHub statistics using GraphQL Rank → Shortlist → Deep Scan pipeline.
 * Includes diff-based caching by repo ID and automatic fallback to REST.
 */

import axios from 'axios';
import { fetchAllRepoMetadata, fetchRepoContents } from './githubGraphql.js';
import { rankRepositories } from './rankRepositories.js';

/**
 * Score a single repository based on its metadata and deep scan content.
 */
function scoreShortlistRepo(repo, content) {
  let score = 0.0;

  // Homepage / deployment bonus
  if (repo.homepage) score += 3.0;

  // Commit depth bonus
  const commits = repo.commitCount || 0;
  if (commits >= 10) score += 1.5;
  else if (commits >= 5) score += 0.75;

  // Language bonus
  if (repo.primaryLanguage || (repo.languages && repo.languages.length > 0)) score += 1.0;

  // Structure / Setup files bonus
  if (content && content.manifest) score += 2.0;

  // README bonus
  if (content && content.readme) score += 1.5;

  return Math.min(score, 10.0);
}

/**
 * Main export: Get GitHub statistics for a given username.
 * @param {string} username GitHub username
 * @param {object} options Configuration options ({ existingCache })
 */
export async function getGithubStats(username, options = {}) {
  const stats = {
    github_repos: 0,
    github_stars: 0,
    github_commits: 0,
    working_score: 0.0,
    updated_cache: {},
    graphql_data: null,
  };

  if (!username) return stats;
  const token = process.env.GITHUB_TOKEN;
  const existingCache = options.existingCache || {};

  if (token) {
    try {
      // 1. Fetch Metadata via GraphQL
      const validRepos = await fetchAllRepoMetadata(username, token);
      stats.github_repos = validRepos.length;
      stats.github_stars = validRepos.reduce((acc, r) => acc + (r.stars || 0), 0);

      if (validRepos.length > 0) {
        // 2. Shortlist top repos (max 10)
        const shortlist = rankRepositories(validRepos, 10);

        // 3. Diff-check against cache by repo ID
        const uncachedRepos = [];
        const repoScoresMap = {};
        const updatedCache = { ...existingCache };

        for (const repo of shortlist) {
          const repoId = repo.id;
          const cached = existingCache[repoId];

          if (cached && cached.pushedAt === repo.pushedAt && typeof cached.repoScore === 'number') {
            // Reuse cached score
            repoScoresMap[repoId] = cached.repoScore;
          } else {
            // Needs deep scan
            uncachedRepos.push(repo);
          }
        }

        // 4. Deep Scan uncached repos via GraphQL
        let contentsMap = {};
        if (uncachedRepos.length > 0) {
          const owner = uncachedRepos[0].owner || username;
          try {
            contentsMap = await fetchRepoContents(owner, uncachedRepos, token);
          } catch (err) {
            console.warn(`[GITHUB DEEP SCAN] Contents fetch error for @${username}: ${err.message}`);
          }
        }

        // 5. Score uncached repos and update cache
        for (const repo of uncachedRepos) {
          const repoId = repo.id;
          const repoContent = contentsMap[repo.name] || null;
          const repoScore = scoreShortlistRepo(repo, repoContent);
          repoScoresMap[repoId] = repoScore;

          updatedCache[repoId] = {
            id: repoId,
            name: repo.name,
            pushedAt: repo.pushedAt,
            repoScore,
          };
        }

        // Calculate working score as average of shortlisted repo scores
        const shortlistScores = shortlist.map((r) => repoScoresMap[r.id] ?? 0.0);
        if (shortlistScores.length > 0) {
          const avg = shortlistScores.reduce((a, b) => a + b, 0) / shortlistScores.length;
          stats.working_score = Math.min(avg, 10.0);
        }

        stats.updated_cache = updatedCache;

        // Total commits count calculation
        const totalGraphqlCommits = validRepos.reduce((acc, r) => acc + (r.commitCount || 0), 0);
        stats.github_commits = totalGraphqlCommits;

        stats.graphql_data = {
          repos: validRepos,
          shortlist,
          contentsMap,
        };

        return stats;
      }
    } catch (err) {
      console.warn(`[GITHUB GRAPHQL SCAN] GraphQL failed for ${username}: ${err.message}. Falling back to REST.`);
    }
  }

  // Fallback to legacy REST pipeline if no token or GraphQL failed
  return getGithubStatsREST(username);
}

/**
 * Legacy REST scanner preserved as fallback if GraphQL API fails or token is unconfigured.
 */
async function getGithubStatsREST(username) {
  const stats = {
    github_repos: 0,
    github_stars: 0,
    github_commits: 0,
    working_score: 0.0,
    updated_cache: {},
    graphql_data: null,
  };
  if (!username) return stats;

  const headers = {
    'User-Agent': 'UniRank-App',
    Accept: 'application/vnd.github.v3+json',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `token ${token}`;

  try {
    const userResp = await axios.get(`https://api.github.com/users/${username}`, {
      headers,
      timeout: 8000,
    });
    if (userResp.status === 200) {
      stats.github_repos = userResp.data.public_repos || 0;
    }

    const reposResp = await axios.get(`https://api.github.com/users/${username}/repos`, {
      params: { per_page: 100 },
      headers,
      timeout: 10000,
    });

    if (reposResp.status === 200) {
      const validRepos = (reposResp.data || []).filter((r) => !r.fork);
      stats.github_stars = validRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
      if (stats.github_repos === 0) stats.github_repos = validRepos.length;

      // Limit REST evaluations to top 5 repos to prevent abuse rate limits
      const shortlist = rankRepositories(validRepos, 5);
      let totalRepoScores = 0;
      let evaluatedCount = 0;

      for (const repo of shortlist) {
        try {
          const contentsResp = await axios.get(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents`,
            { headers, timeout: 6000 }
          );
          if (Array.isArray(contentsResp.data)) {
            const files = contentsResp.data.map((f) => (f.name || '').toLowerCase());
            let rScore = 0;
            if (repo.homepage) rScore += 3.0;
            if (files.some((f) => ['package.json', 'requirements.txt', 'go.mod'].includes(f))) rScore += 2.0;
            if (files.some((f) => f.startsWith('readme'))) rScore += 1.5;
            totalRepoScores += rScore;
            evaluatedCount++;
          }
        } catch {
          // Ignore REST content error
        }
      }

      if (evaluatedCount > 0) {
        stats.working_score = Math.min(totalRepoScores / evaluatedCount, 10.0);
      }
    }

    // Commit search fallback chain
    try {
      const searchResp = await axios.get(`https://api.github.com/search/commits`, {
        params: { q: `author:${username}` },
        headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' },
        timeout: 8000,
      });
      if (searchResp.status === 200) {
        stats.github_commits = searchResp.data.total_count || 0;
      } else {
        throw new Error('Search API non-200');
      }
    } catch {
      try {
        const eventsResp = await axios.get(`https://api.github.com/users/${username}/events/public`, {
          params: { per_page: 100 },
          headers,
          timeout: 6000,
        });
        if (eventsResp.status === 200) {
          let pushCommits = 0;
          for (const event of eventsResp.data) {
            if (event.type === 'PushEvent') {
              pushCommits += (event.payload?.commits || []).length;
            }
          }
          stats.github_commits = Math.max(pushCommits, stats.github_repos * 5);
        } else {
          stats.github_commits = stats.github_repos * 5;
        }
      } catch {
        stats.github_commits = stats.github_repos * 5;
      }
    }
  } catch (err) {
    console.warn(`[GITHUB REST SCAN] Error fetching stats for ${username}: ${err.message}`);
  }

  return stats;
}

export function calculateGithubScore(stats) {
  const repos = stats.github_repos || 0;
  const stars = stats.github_stars || 0;
  const commits = stats.github_commits || 0;

  // 1. Implementation Score (0–10)
  let impl = 0.0;
  if (commits > 1000) impl += 6.0;
  else if (commits > 500) impl += 5.0;
  else if (commits > 200) impl += 4.0;
  else if (commits > 100) impl += 3.0;
  else if (commits > 50) impl += 2.0;
  else if (commits > 20) impl += 1.5;
  else if (commits > 5) impl += 1.0;
  else if (commits > 0) impl += 0.5;

  if (repos > 30) impl += 4.0;
  else if (repos > 20) impl += 3.0;
  else if (repos > 10) impl += 2.5;
  else if (repos > 5) impl += 2.0;
  else if (repos > 3) impl += 1.5;
  else if (repos > 1) impl += 1.0;
  else if (repos > 0) impl += 0.5;

  impl = Math.min(impl, 10.0);

  // 2. Working Score (0–10)
  const working = Math.min(stats.working_score || 0.0, 10.0);

  // 3. Impact Score (0–10)
  let impact = 0.0;
  if (stars > 500) impact += 8.0;
  else if (stars > 100) impact += 6.5;
  else if (stars > 50) impact += 5.0;
  else if (stars > 20) impact += 3.5;
  else if (stars > 10) impact += 2.5;
  else if (stars > 5) impact += 2.0;
  else if (stars > 0) impact += 1.0;

  if (repos > 20) impact += 2.0;
  else if (repos > 10) impact += 1.5;
  else if (repos > 5) impact += 1.0;
  else if (repos > 0) impact += 0.5;

  impact = Math.min(impact, 10.0);

  // Final score
  const total = Math.round(((impl + working + impact) / 3.0) * 100) / 100;

  let rank = 'Starter';
  if (total >= 9) rank = 'Elite';
  else if (total >= 7) rank = 'Advanced';
  else if (total >= 5) rank = 'Intermediate';
  else if (total >= 3) rank = 'Beginner';

  return {
    github_impl: Math.round(impl * 10) / 10,
    github_working: Math.round(working * 10) / 10,
    github_impact: Math.round(impact * 10) / 10,
    github_score: total,
    github_rank: rank,
  };
}
