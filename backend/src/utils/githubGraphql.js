/**
 * utils/githubGraphql.js
 * GraphQL metadata and content fetchers for GitHub profile scanning.
 * Implements exponential backoff retry and partial failure parsing.
 */

import axios from 'axios';

const GRAPHQL_URL = 'https://api.github.com/graphql';

/**
 * Helper to execute GraphQL queries with exponential backoff on 403/429/rate-limit errors.
 */
async function executeGraphqlQuery(query, variables, token, maxRetries = 3) {
  let attempt = 0;
  let delayMs = 1000;

  while (attempt < maxRetries) {
    try {
      const response = await axios.post(
        GRAPHQL_URL,
        { query, variables },
        {
          headers: {
            Authorization: `bearer ${token}`,
            'User-Agent': 'UniRank-App',
            Accept: 'application/vnd.github.v3+json',
          },
          timeout: 12000,
        }
      );

      // Check for rate limit or secondary rate limit errors inside response data
      if (response.data && response.data.errors) {
        const rateLimitErr = response.data.errors.find((e) =>
          (e.message || '').toLowerCase().includes('rate limit')
        );
        if (rateLimitErr && attempt < maxRetries - 1) {
          console.warn(
            `[GITHUB GRAPHQL] Rate limit encountered (Attempt ${attempt + 1}/${maxRetries}): ${rateLimitErr.message}. Retrying in ${delayMs}ms...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          attempt++;
          delayMs *= 2;
          continue;
        }
      }

      return response;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 403 || status === 429) && attempt < maxRetries - 1) {
        console.warn(
          `[GITHUB GRAPHQL] HTTP ${status} (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error('[GITHUB GRAPHQL] Maximum retry attempts reached.');
}

/**
 * Fetch metadata for up to 100 non-fork, non-archived repositories in 1 GraphQL query.
 */
export async function fetchAllRepoMetadata(username, token) {
  if (!token) {
    throw new Error('No GITHUB_TOKEN configured for GraphQL API');
  }

  const query = `
    query GetUserRepos($username: String!) {
      rateLimit {
        remaining
        resetAt
      }
      user(login: $username) {
        repositories(
          first: 100
          isFork: false
          privacy: PUBLIC
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes {
            id
            databaseId
            name
            owner {
              login
            }
            stargazerCount
            forkCount
            pushedAt
            homepageUrl
            primaryLanguage {
              name
            }
            languages(first: 5) {
              nodes {
                name
              }
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  history {
                    totalCount
                  }
                }
              }
            }
            repositoryTopics(first: 10) {
              nodes {
                topic {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await executeGraphqlQuery(query, { username }, token);

  const rateLimit = response.data?.data?.rateLimit;
  if (rateLimit) {
    console.log(
      `[GITHUB GRAPHQL] RateLimit: remaining=${rateLimit.remaining}, resetAt=${rateLimit.resetAt}`
    );
  }

  if (response.data?.errors && !response.data?.data?.user) {
    const msg = response.data.errors.map((e) => e.message).join('; ');
    throw new Error(`[GITHUB GRAPHQL] Query failed: ${msg}`);
  }

  const repoNodes = response.data?.data?.user?.repositories?.nodes || [];
  return repoNodes.map((repo) => ({
    id: repo.id || repo.databaseId?.toString() || repo.name,
    databaseId: repo.databaseId,
    name: repo.name,
    owner: repo.owner?.login,
    stars: repo.stargazerCount || 0,
    forks: repo.forkCount || 0,
    pushedAt: repo.pushedAt,
    homepage: repo.homepageUrl || null,
    primaryLanguage: repo.primaryLanguage?.name || null,
    languages: (repo.languages?.nodes || []).map((l) => l.name),
    commitCount:
      repo.defaultBranchRef?.target?.history?.totalCount || 0,
    topics: (repo.repositoryTopics?.nodes || []).map((t) => t.topic?.name),
  }));
}

/**
 * Pure function to parse GraphQL content response with partial failure handling.
 */
export function parseGraphqlContentResponse(rawResponse, repoNames) {
  const result = {};
  const data = rawResponse?.data?.data || {};
  const errors = rawResponse?.data?.errors || [];

  if (errors.length > 0) {
    console.warn(
      `[GITHUB GRAPHQL] Partial errors present in content response: ${errors.map((e) => e.message).join('; ')}`
    );
  }

  repoNames.forEach((name, index) => {
    const aliasKey = `r${index}`;
    const repoData = data[aliasKey];

    if (!repoData) {
      console.warn(
        `[GITHUB GRAPHQL] Missing/null content data for repo "${name}".`
      );
      result[name] = { readme: null, manifest: null, setupFile: null };
      return;
    }

    const readmeBlob = repoData.readme?.text || repoData.readmeLower?.text || null;
    const packageJson = repoData.packageJson?.text || null;
    const requirementsTxt = repoData.requirementsTxt?.text || null;
    const goMod = repoData.goMod?.text || null;
    const pomXml = repoData.pomXml?.text || null;
    const cargoToml = repoData.cargoToml?.text || null;

    let manifest = packageJson || requirementsTxt || goMod || pomXml || cargoToml || null;
    let setupFile = null;
    if (packageJson) setupFile = 'package.json';
    else if (requirementsTxt) setupFile = 'requirements.txt';
    else if (goMod) setupFile = 'go.mod';
    else if (pomXml) setupFile = 'pom.xml';
    else if (cargoToml) setupFile = 'Cargo.toml';

    result[name] = {
      readme: readmeBlob,
      manifest,
      setupFile,
    };
  });

  return result;
}

/**
 * Fetch README and setup files for up to 10 shortlisted repositories in 1 GraphQL query using aliases.
 */
export async function fetchRepoContents(owner, reposShortlist, token) {
  if (!token) {
    throw new Error('No GITHUB_TOKEN configured for GraphQL API');
  }

  if (!reposShortlist || reposShortlist.length === 0) {
    return {};
  }

  const repoNames = reposShortlist.map((r) => r.name);
  const aliasQueries = reposShortlist
    .map((repo, idx) => {
      const alias = `r${idx}`;
      return `
      ${alias}: repository(owner: "${owner}", name: "${repo.name}") {
        readme: object(expression: "HEAD:README.md") {
          ... on Blob { text }
        }
        readmeLower: object(expression: "HEAD:readme.md") {
          ... on Blob { text }
        }
        packageJson: object(expression: "HEAD:package.json") {
          ... on Blob { text }
        }
        requirementsTxt: object(expression: "HEAD:requirements.txt") {
          ... on Blob { text }
        }
        goMod: object(expression: "HEAD:go.mod") {
          ... on Blob { text }
        }
        pomXml: object(expression: "HEAD:pom.xml") {
          ... on Blob { text }
        }
        cargoToml: object(expression: "HEAD:Cargo.toml") {
          ... on Blob { text }
        }
      }
    `;
    })
    .join('\n');

  const query = `
    query GetRepoContents {
      ${aliasQueries}
    }
  `;

  const response = await executeGraphqlQuery(query, {}, token);
  return parseGraphqlContentResponse(response, repoNames);
}
