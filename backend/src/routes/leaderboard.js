/**
 * routes/leaderboard.js
 * Supports Global, CP, Hackathon, GitHub, and Overall leaderboards with in-memory caching.
 */

import { Router } from 'express';
import NodeCache from 'node-cache';
import { verifyToken } from '../middleware/auth.js';
import { rolesRequired } from '../middleware/roles.js';
import { User, Profile, HackathonResult } from '../models/index.js';
import {
  getCurrentAcademicSession,
  calculateAdmissionYear,
  getCurrentYearOfStudy,
} from '../utils/academicYear.js';
import { updateUserScores, setCache } from '../utils/scoring.js';

const router = Router();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes default TTL
setCache(cache);

function getLbCacheKey(req, currentUser) {
  const type = req.query.type || 'cp';
  const scope = req.query.scope || 'global';
  const branch = req.query.branch || '';
  const year = req.query.year || '';

  let collegeDomain = '';
  if (scope === 'college' && currentUser) {
    try {
      collegeDomain = currentUser.email.split('@')[1].trim().toLowerCase();
    } catch {
      // Ignore
    }
  }

  return `lb_${type}_${scope}_${collegeDomain}_${branch}_${year}`;
}

// ── GET /api/leaderboard ───────────────────────────────────────────
router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const cacheKey = getLbCacheKey(req, currentUser);

    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const lbType = req.query.type || 'cp';
    const scope = req.query.scope || 'global';
    const branch = req.query.branch;
    const year = req.query.year;

    // Filter by role="student"
    const userQueryFilter = { role: 'student' };

    if (scope === 'college' && currentUser) {
      try {
        const domain = currentUser.email.split('@')[1].trim().toLowerCase();
        userQueryFilter.email = new RegExp(`@${domain}$`, 'i');
      } catch {
        // Ignore
      }
    }

    if (branch) userQueryFilter.branch = branch;

    // Reverse mapping for admission_year
    if (year) {
      const currentSession = getCurrentAcademicSession();
      if (year.toString().toLowerCase() === 'alumni' || parseInt(year, 10) > 4) {
        userQueryFilter.admission_year = { $lte: currentSession - 4 };
      } else {
        const parsedYear = parseInt(year, 10);
        if (!isNaN(parsedYear)) {
          userQueryFilter.admission_year = calculateAdmissionYear(parsedYear);
        }
      }
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(100, parseInt(req.query.per_page || '50', 10));
    const skip = (page - 1) * perPage;

    let leaderboard = [];
    let totalCount = 0;

    if (lbType === 'github') {
      totalCount = await User.countDocuments(userQueryFilter);
      const users = await User.find(userQueryFilter)
        .sort({ github_score: -1 })
        .skip(skip)
        .limit(perPage);

      const userIds = users.map((u) => u._id);
      const profilesList = await Profile.find({ user: { $in: userIds } });
      const profilesMap = new Map();
      profilesList.forEach((p) => profilesMap.set(p.user.toString(), p));

      for (let idx = 0; idx < users.length; idx++) {
        const u = users[idx];
        const rank = skip + idx + 1;
        const p = profilesMap.get(u._id.toString()) || {};
        const yearInfo = getCurrentYearOfStudy(u.admission_year);

        let collegeDisplay = u.college;
        if (!collegeDisplay || collegeDisplay.trim().toLowerCase() === 'unknown') {
          try {
            collegeDisplay = u.email.split('@')[1].trim().toUpperCase();
          } catch {
            collegeDisplay = 'Unknown';
          }
        }

        leaderboard.push({
          rank,
          user_id: u._id.toString(),
          name: u.name,
          branch: u.branch,
          year: yearInfo.yearOfStudy,
          year_display: yearInfo.displayString,
          is_alumni: yearInfo.isAlumni,
          college: collegeDisplay,
          avatar_url: p.avatar_url || null,
          github_url: p.github_url || null,
          github_impl_score: u.github_implementation,
          github_imp_score: u.github_impact,
          github_work_score: u.github_working,
          github_total_score: u.github_score,
          github_review_reason: p.github_review_reason || '',
          github_username: p.github_username || '',
          github_rank: p.github_rank || '',
          github_score: u.github_score,
        });
      }
    } else {
      const studentUsers = await User.find(userQueryFilter).select('_id');
      const studentUserIds = studentUsers.map((u) => u._id);

      const sortMap = {
        cp: { cp_score: -1 },
        hackathon: { hackathon_score: -1 },
        overall: { global_score: -1 },
        global: { global_score: -1 },
      };
      const sortObj = sortMap[lbType] || { cp_score: -1 };

      const profileFilter = { user: { $in: studentUserIds } };
      totalCount = await Profile.countDocuments(profileFilter);

      const profiles = await Profile.find(profileFilter)
        .sort(sortObj)
        .skip(skip)
        .limit(perPage)
        .populate('user');

      for (let idx = 0; idx < profiles.length; idx++) {
        const p = profiles[idx];
        const u = p.user;
        if (!u) continue;

        const rank = skip + idx + 1;
        const yearInfo = getCurrentYearOfStudy(u.admission_year);
        let collegeDisplay = u.college;
        if (!collegeDisplay || collegeDisplay.trim().toLowerCase() === 'unknown') {
          try {
            collegeDisplay = u.email.split('@')[1].trim().toUpperCase();
          } catch {
            collegeDisplay = 'Unknown';
          }
        }

        const entry = {
          rank,
          user_id: u._id.toString(),
          name: u.name,
          branch: u.branch,
          year: yearInfo.yearOfStudy,
          year_display: yearInfo.displayString,
          is_alumni: yearInfo.isAlumni,
          college: collegeDisplay,
          avatar_url: p.avatar_url || null,
        };

        if (lbType === 'cp') {
          const dict = p.toDict();
          Object.assign(entry, {
            cf_handle: p.cf_handle || null,
            cf_rating: dict.final_codeforces_rating,
            actual_cf_rating: dict.actual_codeforces_rating,
            admin_cf_rating: dict.admin_codeforces_rating,

            lc_username: p.lc_username || null,
            lc_rating: dict.final_leetcode_rating,
            actual_lc_rating: dict.actual_leetcode_rating,
            admin_lc_rating: dict.admin_leetcode_rating,

            cc_username: dict.codechef_username || null,
            cc_rating: dict.final_codechef_rating,
            actual_cc_rating: dict.actual_codechef_rating,
            admin_cc_rating: dict.admin_codechef_rating,

            hr_username: dict.hackerrank_username || null,
            hr_rating: dict.final_hackerrank_rating,
            actual_hr_rating: dict.actual_hackerrank_rating,
            admin_hr_rating: dict.admin_hackerrank_rating,

            he_username: dict.hackerearth_username || null,
            he_rating: dict.final_hackerearth_rating,
            actual_he_rating: dict.actual_hackerearth_rating,
            admin_he_rating: dict.admin_hackerearth_rating,

            leaderboard_points: Math.round(p.cp_score * 100) / 100,
            cp_score: Math.round(p.cp_score * 100) / 100,
          });
        } else if (lbType === 'hackathon') {
          const hCount = await HackathonResult.countDocuments({ user: u._id });
          Object.assign(entry, {
            score: p.hackathon_score,
            hackathons_count: hCount,
          });
        } else if (['overall', 'global'].includes(lbType)) {
          Object.assign(entry, {
            score: Math.round(p.global_score * 10) / 10,
            global_score: Math.round(p.global_score * 10) / 10,
            cp_score: Math.round(p.cp_score * 10) / 10,
            hackathon_score: p.hackathon_score,
            github_score: Math.round((u.github_score || 0) * 10) / 10,
          });
        }

        leaderboard.push(entry);
      }
    }

    const responseData = {
      leaderboard,
      total: totalCount,
      page,
      per_page: perPage,
    };

    cache.set(cacheKey, responseData, 300);
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('[GET /leaderboard] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/hackathon/result ─────────────────────────────────────
router.post('/hackathon/result', verifyToken, rolesRequired('admin', 'superadmin', 'reviewer'), async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const data = req.body || {};

    const targetUserId = currentAdmin.role === 'student' ? req.userId : (data.user_id || req.userId);
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

    const hName = data.hackathon_name;
    const position = data.position || 0;
    const points = data.points || 0;

    if (!hName) return res.status(400).json({ error: 'Missing hackathon_name' });

    const newRes = await HackathonResult.create({
      user: targetUser._id,
      hackathon_name: hName,
      position,
      points,
    });

    await updateUserScores(targetUserId.toString());
    return res.status(201).json({
      message: 'Hackathon result added successfully',
      result: newRes.toDict(),
    });
  } catch (err) {
    console.error('[POST /hackathon/result] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/hackathon/result/:res_id ───────────────────────────
router.delete('/hackathon/result/:res_id', verifyToken, async (req, res) => {
  try {
    const resId = req.params.res_id;
    const resultDoc = await HackathonResult.findById(resId);
    if (!resultDoc) return res.status(404).json({ error: 'Result not found' });

    if (resultDoc.user.toString() !== String(req.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await HackathonResult.deleteOne({ _id: resultDoc._id });
    await updateUserScores(req.userId.toString());

    return res.status(200).json({ message: 'Result deleted' });
  } catch (err) {
    console.error('[DELETE /hackathon/result/:res_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
