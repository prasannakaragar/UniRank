/**
 * utils/rankRepositories.js
 * Pure JS ranking heuristic for shortlisting top repositories prior to deep scan.
 */

/**
 * Rank repositories based on stars, forks, commit count, and recency.
 * @param {Array} repos List of repository objects
 * @param {number} limit Number of top repos to shortlist (default 10)
 * @returns {Array} Shortlisted repositories sorted descending by rank score
 */
export function rankRepositories(repos, limit = 10) {
  if (!Array.isArray(repos) || repos.length === 0) {
    return [];
  }

  const now = new Date();
  const NinetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const SixMonthsMs = 180 * 24 * 60 * 60 * 1000;

  const scoredRepos = repos.map((repo) => {
    const stars = repo.stars || repo.stargazers_count || 0;
    const forks = repo.forks || repo.forks_count || 0;
    const commits = repo.commitCount || repo.commits || 0;

    let recencyBonus = 0;
    if (repo.pushedAt) {
      const pushedDate = new Date(repo.pushedAt);
      const ageMs = now.getTime() - pushedDate.getTime();
      if (ageMs <= NinetyDaysMs) {
        recencyBonus = 5.0;
      } else if (ageMs <= SixMonthsMs) {
        recencyBonus = 2.0;
      }
    }

    const rankScore =
      stars * 3.0 +
      forks * 2.0 +
      Math.min(commits, 50) +
      recencyBonus;

    return {
      ...repo,
      id: repo.id || repo.databaseId?.toString() || repo.name,
      rankScore,
    };
  });

  scoredRepos.sort((a, b) => b.rankScore - a.rankScore);
  return scoredRepos.slice(0, limit);
}
