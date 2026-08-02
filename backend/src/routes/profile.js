/**
 * routes/profile.js
 * View and update student profiles + trigger Codeforces, LeetCode, GitHub sync.
 * Implements independent, conditional multi-platform profile sync.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { rateLimitSlidingWindow } from '../middleware/rateLimiter.js';
import { User, Profile } from '../models/index.js';
import { calculateAdmissionYear, getCurrentYearOfStudy } from '../utils/academicYear.js';
import { syncUserStats } from '../utils/codeforces.js';
import { syncLeetcodeStats } from '../utils/leetcode.js';
import { getGithubStats, calculateGithubScore } from '../utils/githubStats.js';
import { analyzeGithubProfile } from '../utils/githubAi.js';
import { updateUserScores } from '../utils/scoring.js';

const router = Router();

/**
 * Background GitHub scan runner.
 * Note: If using Redis/BullMQ in production, this function would be enqueued to a worker queue.
 */
async function runBackgroundGithubScan(userId, username) {
  try {
    const user = await User.findById(userId);
    const profile = await Profile.findOne({ user: userId });
    if (!user || !profile) return;

    // Fetch GitHub stats using GraphQL pipeline + diff cache
    const ghStats = await getGithubStats(username, {
      existingCache: profile.github_repo_cache || {},
    });

    let implementation = user.github_implementation || 0.0;
    let working = user.github_working || 0.0;
    let impact = user.github_impact || 0.0;
    let githubScore = user.github_score || 0.0;
    let githubRank = profile.github_rank || 'Starter';
    let reviewReason = profile.github_review_reason || '';

    // Calculate heuristic / base scores
    const calculated = calculateGithubScore(ghStats);
    implementation = calculated.github_impl;
    working = calculated.github_working;
    impact = calculated.github_impact;
    githubScore = calculated.github_score;
    githubRank = calculated.github_rank;

    // Optional Gemini AI analysis reusing preloaded GraphQL repo data
    if (profile.github_url && ghStats.graphql_data) {
      try {
        const aiResult = await analyzeGithubProfile(profile.github_url, ghStats.graphql_data);
        if (aiResult) {
          implementation = aiResult.implementation || implementation;
          working = aiResult.working || working;
          impact = aiResult.impact || impact;
          githubScore = aiResult.total || githubScore;
          reviewReason = aiResult.reason || reviewReason;
        }
      } catch (aiErr) {
        console.warn(`[GITHUB BACKGROUND AI] Gemini AI skipped for ${username}: ${aiErr.message}`);
      }
    }

    githubScore = Math.max(0.0, Math.min(10.0, githubScore));

    // Save persistent User scores
    user.github_implementation = implementation;
    user.github_working = working;
    user.github_impact = impact;
    user.github_score = githubScore;
    await user.save();

    // Save Profile metadata & cache
    profile.github_impl_score = implementation;
    profile.github_work_score = working;
    profile.github_imp_score = impact;
    profile.github_total_score = githubScore;
    profile.github_rank = githubRank;
    profile.github_review_reason = reviewReason;
    profile.github_repos = ghStats.github_repos || 0;
    profile.github_stars = ghStats.github_stars || 0;
    profile.github_commits = ghStats.github_commits || 0;

    if (ghStats.updated_cache && Object.keys(ghStats.updated_cache).length > 0) {
      profile.github_repo_cache = ghStats.updated_cache;
    }

    profile.github_scan_status = 'done';
    profile.last_synced = new Date();
    await profile.save();

    await updateUserScores(userId.toString());
    console.log(`[GITHUB BACKGROUND SCAN] Scan completed for ${user.email} → score ${githubScore}`);
  } catch (err) {
    console.error(`[GITHUB BACKGROUND SCAN] Scan failed for user ${userId}: ${err.message}`);
    try {
      const profile = await Profile.findOne({ user: userId });
      if (profile) {
        profile.github_scan_status = 'failed';
        await profile.save();
      }
    } catch {
      // Ignore save error on cleanup
    }
  }
}

// ── GET /api/profile ───────────────────────────────────────────────
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await Profile.findOne({ user: req.userId }).populate('user');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const userDict = await user.toDict();
    const profileDict = profile.toDict();
    const data = { ...userDict, ...profileDict };
    data.combined_score = profile.global_score;
    return res.status(200).json(data);
  } catch (err) {
    console.error('[GET /profile] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/profile/scan-status ──────────────────────────────────
router.get('/profile/scan-status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const profile = await Profile.findOne({ user: req.userId });
    if (!user || !profile) return res.status(404).json({ error: 'User or profile not found' });

    const hasGithub = Boolean(profile.github_url || profile.github_username);
    let status = profile.github_scan_status || 'idle';

    if (!hasGithub && status !== 'pending') {
      status = 'not_configured';
    }

    const now = new Date();
    const cooldownPassed =
      !user.last_github_refresh ||
      now.getTime() - user.last_github_refresh.getTime() >= 60 * 60 * 1000;
    const can_refresh = cooldownPassed && profile.github_scan_status !== 'pending' && hasGithub;

    return res.status(200).json({
      status,
      github_score: user.github_score || 0.0,
      github_implementation: user.github_implementation || 0.0,
      github_working: user.github_working || 0.0,
      github_impact: user.github_impact || 0.0,
      github_rank: profile.github_rank || 'Starter',
      last_synced: profile.last_synced ? profile.last_synced.toISOString() : null,
      can_refresh,
    });
  } catch (err) {
    console.error('[GET /profile/scan-status] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/profile/:uid ──────────────────────────────────────────
router.get('/profile/:uid', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await Profile.findOne({ user: req.params.uid }).populate('user');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const userDict = await user.toDict();
    const profileDict = profile.toDict();
    const data = { ...userDict, ...profileDict };
    data.combined_score = profile.global_score;

    const currentUser = await User.findById(req.userId);
    const isFollowing = currentUser
      ? profile.followers.some((f) => f.toString() === req.userId.toString())
      : false;
    data.is_following = isFollowing;

    return res.status(200).json(data);
  } catch (err) {
    console.error('[GET /profile/:uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/profile/:uid/follow ──────────────────────────────────
router.post('/profile/:uid/follow', verifyToken, async (req, res) => {
  try {
    const targetUid = req.params.uid;
    if (String(targetUid) === String(req.userId)) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(targetUid);
    if (!currentUser || !targetUser) return res.status(404).json({ error: 'User not found' });

    const currentProfile = await Profile.findOne({ user: currentUser._id });
    const targetProfile = await Profile.findOne({ user: targetUser._id });
    if (!currentProfile || !targetProfile) return res.status(404).json({ error: 'Profile not found' });

    if (!targetProfile.followers.some((id) => id.toString() === currentUser._id.toString())) {
      targetProfile.followers.push(currentUser._id);
      await targetProfile.save();
    }

    if (!currentProfile.following.some((id) => id.toString() === targetUser._id.toString())) {
      currentProfile.following.push(targetUser._id);
      await currentProfile.save();
    }

    return res.status(200).json({
      message: 'Successfully followed user',
      followers_count: targetProfile.followers.length,
    });
  } catch (err) {
    console.error('[POST /profile/:uid/follow] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/profile/:uid/unfollow ────────────────────────────────
router.post('/profile/:uid/unfollow', verifyToken, async (req, res) => {
  try {
    const targetUid = req.params.uid;
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(targetUid);
    if (!currentUser || !targetUser) return res.status(404).json({ error: 'User not found' });

    const currentProfile = await Profile.findOne({ user: currentUser._id });
    const targetProfile = await Profile.findOne({ user: targetUser._id });
    if (!currentProfile || !targetProfile) return res.status(404).json({ error: 'Profile not found' });

    targetProfile.followers = targetProfile.followers.filter(
      (id) => id.toString() !== currentUser._id.toString()
    );
    await targetProfile.save();

    currentProfile.following = currentProfile.following.filter(
      (id) => id.toString() !== targetUser._id.toString()
    );
    await currentProfile.save();

    return res.status(200).json({
      message: 'Successfully unfollowed user',
      followers_count: targetProfile.followers.length,
    });
  } catch (err) {
    console.error('[POST /profile/:uid/unfollow] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/profile/:uid/followers ───────────────────────────────
router.get('/profile/:uid/followers', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await Profile.findOne({ user: user._id }).populate('followers');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const followersData = [];
    for (const follower of profile.followers) {
      const fProfile = await Profile.findOne({ user: follower._id });
      const info = getCurrentYearOfStudy(follower.admission_year);
      followersData.push({
        id: follower._id.toString(),
        name: follower.name,
        branch: follower.branch,
        year: info.yearOfStudy,
        year_display: info.displayString,
        avatar_url: fProfile ? fProfile.avatar_url : null,
      });
    }

    return res.status(200).json(followersData);
  } catch (err) {
    console.error('[GET /profile/:uid/followers] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/profile/:uid/following ───────────────────────────────
router.get('/profile/:uid/following', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await Profile.findOne({ user: user._id }).populate('following');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const followingData = [];
    for (const f of profile.following) {
      const fProfile = await Profile.findOne({ user: f._id });
      const info = getCurrentYearOfStudy(f.admission_year);
      followingData.push({
        id: f._id.toString(),
        name: f.name,
        branch: f.branch,
        year: info.yearOfStudy,
        year_display: info.displayString,
        avatar_url: fProfile ? fProfile.avatar_url : null,
      });
    }

    return res.status(200).json(followingData);
  } catch (err) {
    console.error('[GET /profile/:uid/following] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/profile and /api/profile/:uid ─────────────────────────
async function handleUpdateProfile(req, res) {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.uid || currentUserId;

    const requester = await User.findById(currentUserId);
    if (!requester) return res.status(404).json({ error: 'User not found' });

    if (requester.role === 'mentor') {
      return res.status(403).json({ error: 'Mentors cannot edit profiles' });
    }

    if (String(targetUserId) !== String(currentUserId) && requester.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this profile' });
    }

    const data = req.body || {};
    const user = await User.findById(targetUserId);
    const profile = await Profile.findOne({ user: targetUserId }).populate('user');
    if (!user || !profile) return res.status(404).json({ error: 'User or Profile not found' });

    if (data.year || data.admission_year) {
      const yearInput = data.year || data.admission_year;
      user.admission_year = calculateAdmissionYear(yearInput);
      await user.save();
    }

    // Admin role update
    if (requester.role === 'admin' && data.role) {
      if (['student', 'mentor', 'admin'].includes(data.role)) {
        user.role = data.role;
        await user.save();
      }
    }

    const updatable = ['cf_handle', 'lc_username', 'bio', 'skills', 'github_url', 'linkedin_url'];
    for (const field of updatable) {
      if (field in data) {
        profile[field] = data[field];
      }
    }

    // Synchronous CF & LC sync (fast & low cost)
    if (data.cf_handle) {
      const stats = await syncUserStats(data.cf_handle);
      profile.cf_rating = stats.cf_rating || 0;
      profile.cf_max_rating = stats.cf_max_rating || 0;
      profile.cf_rank = stats.cf_rank || 'unrated';
      profile.cf_problems_solved = stats.cf_problems_solved || 0;
      profile.avatar_url = stats.avatar_url;
      profile.last_synced = new Date();
    }

    if (data.lc_username) {
      const stats = await syncLeetcodeStats(data.lc_username);
      if (stats) {
        profile.lc_rating = stats.lc_rating || 0;
        // Track true historical max — only update if current rating is higher
        profile.lc_max_rating = Math.max(profile.lc_max_rating || 0, stats.lc_rating || 0);
        profile.lc_rank = stats.lc_rank || 0;
        profile.lc_problems_solved = stats.lc_problems_solved || 0;
        profile.last_synced = new Date();
      }
    }

    let shouldTriggerScan = false;
    let ghUsername = null;

    if ('github_url' in data) {
      const githubUrl = data.github_url;
      if (githubUrl) {
        ghUsername = githubUrl.replace(/\/$/, '').split('/').pop();
        profile.github_username = ghUsername;

        if (profile.github_scan_status !== 'pending') {
          profile.github_scan_status = 'pending';
          shouldTriggerScan = true;
        }
      }
    }

    await profile.save();
    await updateUserScores(user._id.toString());

    // Launch background scan after saving lock state
    if (shouldTriggerScan && ghUsername) {
      setImmediate(() => runBackgroundGithubScan(targetUserId, ghUsername));
    }

    const responseDict = profile.toDict();
    return res.status(200).json({
      message: 'Profile updated',
      profile: responseDict,
      github_scan_status: profile.github_scan_status || 'idle',
    });
  } catch (err) {
    console.error('[PUT /profile] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

router.put('/profile', verifyToken, handleUpdateProfile);
router.put('/profile/:uid', verifyToken, handleUpdateProfile);

// ── POST /api/profile/sync & /api/profile/refresh/:uid ─────────────
async function handleRefreshProfile(req, res) {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.uid || currentUserId;

    const user = await User.findById(targetUserId);
    const profile = await Profile.findOne({ user: targetUserId });
    if (!user || !profile) return res.status(404).json({ error: 'User or Profile not found' });

    let username = null;
    if (profile.github_url) {
      username = profile.github_url.replace(/\/$/, '').split('/').pop();
    }
    if (!username && profile.github_username) {
      username = profile.github_username;
    }

    const hasGithub = Boolean(username);
    const hasCF = Boolean(profile.cf_handle);
    const hasLC = Boolean(profile.lc_username);

    if (!hasGithub && !hasCF && !hasLC) {
      return res.status(400).json({
        error:
          'No profiles configured to sync. Add a Codeforces handle, LeetCode username, or GitHub URL first.',
      });
    }

    // Apply GitHub-specific lock & cooldown ONLY if GitHub is configured
    if (hasGithub) {
      if (profile.github_scan_status === 'pending') {
        return res.status(409).json({
          error: 'A scan is already in progress',
          status: 'pending',
          can_refresh: false,
        });
      }

      const now = new Date();
      if (user.last_github_refresh) {
        const nextAllowed = new Date(user.last_github_refresh.getTime() + 60 * 60 * 1000);
        if (now < nextAllowed) {
          const remaining = Math.ceil((nextAllowed.getTime() - now.getTime()) / (60 * 1000));
          return res.status(429).json({
            error: 'Too many requests',
            next_refresh_in_minutes: remaining,
            can_refresh: false,
          });
        }
      }
    }

    // Synchronous Codeforces sync if configured
    if (hasCF) {
      const cfStats = await syncUserStats(profile.cf_handle);
      profile.cf_rating = cfStats.cf_rating || 0;
      profile.cf_max_rating = cfStats.cf_max_rating || 0;
      profile.cf_rank = cfStats.cf_rank || 'unrated';
      profile.cf_problems_solved = cfStats.cf_problems_solved || 0;
      profile.cf_contests = cfStats.cf_contests || 0;
      if (cfStats.avatar_url) profile.avatar_url = cfStats.avatar_url;
    }

    // Synchronous LeetCode sync if configured
    if (hasLC) {
      const lcStats = await syncLeetcodeStats(profile.lc_username);
      if (lcStats) {
        profile.lc_rating = lcStats.lc_rating || 0;
        // Track true historical max — only update if current rating is higher
        profile.lc_max_rating = Math.max(profile.lc_max_rating || 0, lcStats.lc_rating || 0);
        profile.lc_rank = lcStats.lc_rank || 0;
        profile.lc_problems_solved = lcStats.lc_problems_solved || 0;
      }
    }

    // Trigger GitHub background scan ONLY if GitHub is configured
    if (hasGithub) {
      const now = new Date();
      user.last_github_refresh = now;
      await user.save();

      profile.github_scan_status = 'pending';
      setImmediate(() => runBackgroundGithubScan(targetUserId, username));
    }

    profile.last_synced = new Date();
    await profile.save();
    await updateUserScores(user._id.toString());

    // Build dynamic response based on what was actually synced
    const response = {
      message: 'Profile refresh processed',
      synced: {
        codeforces: hasCF,
        leetcode: hasLC,
        github: hasGithub,
      },
    };

    if (hasCF) {
      response.cf_rating = profile.cf_rating;
      response.cf_rank = profile.cf_rank;
    }
    if (hasLC) {
      response.lc_rating = profile.lc_rating;
      response.lc_problems_solved = profile.lc_problems_solved;
    }
    if (hasGithub) {
      response.github_status = 'pending';
      response.can_refresh = false;
      response.github_score = user.github_score;
      response.implementation = user.github_implementation;
      response.working = user.github_working;
      response.impact = user.github_impact;
    } else {
      response.github_status = 'not_configured';
    }

    const statusCode = hasGithub ? 202 : 200;
    return res.status(statusCode).json(response);
  } catch (err) {
    console.error('[REFRESH PROFILE] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const syncRateLimit = rateLimitSlidingWindow(3, 60);
router.post('/profile/sync', verifyToken, syncRateLimit, handleRefreshProfile);
router.post('/profile/refresh/:uid', verifyToken, syncRateLimit, handleRefreshProfile);

export default router;
