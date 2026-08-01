/**
 * utils/githubAi.js
 * Uses Gemini AI (or heuristic fallback) to evaluate GitHub profiles.
 * Reuses preloaded repo metadata & contents from githubGraphql.js to eliminate redundant REST calls.
 */

import axios from 'axios';

let genAI = null;

async function initGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
  } catch {
    return null;
  }
}

export async function analyzeGithubProfile(githubUrl, preloadedRepoData = null) {
  if (!githubUrl) return null;

  const ai = genAI || (await initGenAI());
  if (!ai) return analyzeGithubProfileHeuristic(githubUrl);

  const match = githubUrl.match(/github\.com\/([^/]+)/);
  if (!match) return null;
  const username = match[1];

  try {
    let repoSummaries = [];

    if (preloadedRepoData && Array.isArray(preloadedRepoData.shortlist) && preloadedRepoData.shortlist.length > 0) {
      const contentsMap = preloadedRepoData.contentsMap || {};
      repoSummaries = preloadedRepoData.shortlist.map((r) => {
        const content = contentsMap[r.name] || {};
        return {
          name: r.name,
          description: r.description || null,
          language: r.primaryLanguage || (r.languages && r.languages[0]) || null,
          stars: r.stars || r.stargazerCount || 0,
          forks: r.forks || r.forkCount || 0,
          topics: r.topics || [],
          readmeSnippet: content.readme ? content.readme.slice(0, 300) : null,
          setupFile: content.setupFile || null,
        };
      });
    } else {
      // Fallback: Fetch via REST if no preloaded data was provided
      const reposResp = await axios.get(
        `https://api.github.com/users/${username}/repos?per_page=30&sort=updated`,
        { timeout: 15000 }
      );
      if (reposResp.status !== 200) return null;

      const repos = reposResp.data;
      if (!repos.length) {
        return {
          implementation: 0.0, impact: 0.0, working: 0.0, total: 0.0,
          reason: 'Analyzed successfully. No public repositories found.',
        };
      }

      repoSummaries = repos
        .filter((r) => !r.fork)
        .map((r) => ({
          name: r.name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          topics: r.topics || [],
        }));
    }

    if (!repoSummaries.length) {
      return {
        implementation: 0.0, impact: 0.0, working: 0.0, total: 0.0,
        reason: 'Only forked repositories found. AI requires original work to analyze.',
      };
    }

    const prompt = `
You are an expert Senior Software Engineer AI. I am going to provide you with a list of GitHub repositories belonging to a student.

Repositories Data:
${JSON.stringify(repoSummaries, null, 2)}

Based on these repositories (their descriptions, tech stacks, stars, README snippets, and complexities), evaluate this developer on three metrics (each strictly on a scale of 0.0 to 10.0):
1. implementation: How complex/well-architected the projects seem based on their tech stack and descriptions.
2. impact: How useful or impactful the projects are (consider stars, forks, and the problem it solves).
3. working: Assume functionality based on tech stack diversity and project maturity.

Calculate the average of these three as the 'total' score.
Also provide a short 1-2 sentence 'reason' explaining the assessment.

You MUST return ONLY a raw JSON object with the following exact keys and format. Do NOT wrap it in markdown block quotes (like \`\`\`json). Just return the JSON:
{
    "implementation": 7.5,
    "impact": 6.0,
    "working": 8.0,
    "total": 7.1,
    "reason": "Solid use of React and Python, solving practical problems, though impact is moderate."
}
`;

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    let textResponse = result.response.text().trim();

    // Clean up markdown wrapping
    if (textResponse.startsWith('```json')) textResponse = textResponse.slice(7);
    if (textResponse.startsWith('```')) textResponse = textResponse.slice(3);
    if (textResponse.endsWith('```')) textResponse = textResponse.slice(0, -3);

    const data = JSON.parse(textResponse.trim());

    const imp = parseFloat(data.implementation || 0);
    const impact = parseFloat(data.impact || 0);
    const work = parseFloat(data.working || 0);
    const total = Math.round(((imp + impact + work) / 3) * 10) / 10;

    return {
      implementation: Math.round(imp * 10) / 10,
      impact: Math.round(impact * 10) / 10,
      working: Math.round(work * 10) / 10,
      total,
      reason: data.reason || 'Analyzed successfully by Gemini AI.',
    };
  } catch (err) {
    console.log(`Gemini AI Analysis Error: ${err.message}`);
    return analyzeGithubProfileHeuristic(githubUrl);
  }
}

export async function analyzeGithubProfileHeuristic(githubUrl) {
  const match = githubUrl.match(/github\.com\/([^/]+)/);
  if (!match) return null;
  const username = match[1];

  try {
    const resp = await axios.get(
      `https://api.github.com/users/${username}/repos?per_page=100`,
      { timeout: 10000 }
    );
    if (resp.status !== 200) return null;

    const repos = resp.data;
    if (!repos.length) {
      return {
        implementation: 2.0, impact: 1.0, working: 2.0, total: 1.7,
        reason: `Analyzed @${username}'s profile. No public repositories found.`,
      };
    }

    const originalRepos = repos.filter((r) => !r.fork);
    const repoCount = originalRepos.length;
    const langs = new Set(
      originalRepos.map((r) => r.language).filter(Boolean)
    );
    let implScore = Math.min(10.0, 4.0 + repoCount * 0.2 + langs.size * 0.5);

    const totalStars = originalRepos.reduce(
      (s, r) => s + (r.stargazers_count || 0), 0
    );
    const totalForks = originalRepos.reduce(
      (s, r) => s + (r.forks_count || 0), 0
    );
    let impactScore = 3.0 + totalStars * 0.5 + totalForks * 0.8;
    if (totalStars > 0 || totalForks > 0) impactScore += 2.0;
    impactScore = Math.min(10.0, impactScore);

    const totalSize = originalRepos.reduce((s, r) => s + (r.size || 0), 0);
    let workScore = Math.min(10.0, 5.0 + totalSize / 5000);

    implScore = Math.round(implScore * 10) / 10;
    impactScore = Math.round(impactScore * 10) / 10;
    workScore = Math.round(workScore * 10) / 10;
    const totalScore =
      Math.round(((implScore + impactScore + workScore) / 3) * 10) / 10;

    const langStr = [...langs].slice(0, 3).join(', ') || 'various technologies';
    const reason = `Heuristic Analysis: Scanned ${repoCount} original repositories by @${username}. Demonstrates proficiency in ${langStr}.`;

    return {
      implementation: implScore,
      impact: impactScore,
      working: workScore,
      total: totalScore,
      reason,
    };
  } catch (err) {
    console.log(`Fallback Analysis Error: ${err.message}`);
    return null;
  }
}
