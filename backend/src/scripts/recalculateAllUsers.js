/**
 * scripts/recalculateAllUsers.js
 * Script to iterate over all users in the database and recalculate:
 * 1. GitHub sub-scores & composite score fallback
 * 2. Competitive Programming Leaderboard Points (cp_score)
 * 3. Hackathon Points
 * 4. Activity Score
 * 5. Overall Global Score
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { updateUserScores } from '../utils/scoring.js';
import { calculateGithubScore } from '../utils/githubStats.js';

async function recalculateAll() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/unirank';
  console.log(`[RECALCULATE] Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('[RECALCULATE] Connected to MongoDB.');

  const users = await User.find({});
  console.log(`[RECALCULATE] Found ${users.length} total users to process.`);

  let updatedCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const profile = await Profile.findOne({ user: user._id });

    console.log(`\n[${i + 1}/${users.length}] Processing User: ${user.name} (${user.email}) [ID: ${user._id}]`);

    if (profile) {
      // 1. Ensure GitHub sub-scores and total score are non-zero if stats are present
      const ghRepos = profile.github_repos || 0;
      const ghStars = profile.github_stars || 0;
      const ghCommits = profile.github_commits || 0;

      if (ghRepos > 0 || ghStars > 0 || ghCommits > 0) {
        const calculatedGH = calculateGithubScore({
          github_repos: ghRepos,
          github_stars: ghStars,
          github_commits: ghCommits,
          working_score: profile.github_work_score || 5.0,
        });

        const impl = user.github_implementation || calculatedGH.github_impl;
        const work = user.github_working || calculatedGH.github_working;
        const impact = user.github_impact || calculatedGH.github_impact;

        // Composite overall score: average of implementation, working, impact
        let ghScore = user.github_score;
        if (!ghScore || ghScore === 0) {
          ghScore = Math.round(((impl + work + impact) / 3.0) * 10) / 10;
        }

        user.github_implementation = impl;
        user.github_working = work;
        user.github_impact = impact;
        user.github_score = ghScore;
        await user.save();

        profile.github_impl_score = impl;
        profile.github_work_score = work;
        profile.github_imp_score = impact;
        profile.github_total_score = ghScore;
        await profile.save();

        console.log(`  └─ GitHub Scores: Implementation=${impl}, Working=${work}, Impact=${impact} → Total=${ghScore}`);
      }
    }

    // 2. Recalculate CP rating scores, hackathon scores, activity scores, and global score
    await updateUserScores(user._id.toString());

    // Reload updated profile to display results
    const updatedProfile = await Profile.findOne({ user: user._id });
    const cpScore = updatedProfile ? updatedProfile.cp_score : 0;
    const globalScore = updatedProfile ? updatedProfile.global_score : 0;

    console.log(`  └─ Scores Updated: CP Score = ${cpScore}, Global Score = ${globalScore}`);
    updatedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`[RECALCULATE] Successfully recalculated scores for ${updatedCount} users.`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  console.log('[RECALCULATE] MongoDB connection closed.');
}

recalculateAll().catch((err) => {
  console.error('[RECALCULATE ERROR]:', err);
  process.exit(1);
});
