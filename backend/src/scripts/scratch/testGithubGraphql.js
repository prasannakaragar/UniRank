/**
 * Test script for GraphQL GitHub scanner utilities.
 */
import { parseGraphqlContentResponse } from '../../utils/githubGraphql.js';
import { rankRepositories } from '../../utils/rankRepositories.js';

console.log('--- Testing rankRepositories ---');
const testRepos = [
  { id: '1', databaseId: 101, name: 'old-popular', stars: 50, forks: 10, commitCount: 100, pushedAt: '2023-01-01T00:00:00Z' },
  { id: '2', databaseId: 102, name: 'new-active', stars: 10, forks: 2, commitCount: 30, pushedAt: new Date().toISOString() },
  { id: '3', databaseId: 103, name: 'tiny-repo', stars: 0, forks: 0, commitCount: 2, pushedAt: '2024-01-01T00:00:00Z' },
];

const ranked = rankRepositories(testRepos, 2);
console.log('Ranked result (top 2):', ranked.map(r => ({ id: r.id, name: r.name, rankScore: r.rankScore })));

console.log('\n--- Testing parseGraphqlContentResponse ---');
const mockResponse = {
  data: {
    data: {
      r0: {
        readme: { text: '# Old Popular README' },
        packageJson: { text: '{"name": "old-popular"}' },
      },
      r1: null, // Partial failure or deleted repo
    },
    errors: [{ message: 'Could not resolve to a Repository resource' }],
  },
};

const parsed = parseGraphqlContentResponse(mockResponse, ['old-popular', 'deleted-repo']);
console.log('Parsed content response:', parsed);
