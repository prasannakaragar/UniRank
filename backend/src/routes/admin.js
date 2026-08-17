/**
 * routes/admin.js
 * Admin management endpoints (users, roles, scores, colleges, issues, logs).
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { adminOnly, mentorOrAdmin } from '../middleware/roles.js';
import { User, Profile, Announcement, TeamPost, Issue, AdminLog, College } from '../models/index.js';
import { getCurrentYearOfStudy } from '../utils/academicYear.js';
import { updateUserScores } from '../utils/scoring.js';
import { syncUserStats } from '../utils/codeforces.js';
import { syncLeetcodeStats } from '../utils/leetcode.js';

const router = Router();

// ── GET /api/admin/stats ───────────────────────────────────────────
router.get('/admin/stats', verifyToken, mentorOrAdmin, async (req, res) => {
  try {
    const stats = {
      total_users: await User.countDocuments(),
      total_announcements: await Announcement.countDocuments(),
      total_teams: await TeamPost.countDocuments(),
      total_hackathon_results: await Announcement.countDocuments({ category: 'hackathon' }),
    };
    return res.status(200).json(stats);
  } catch (err) {
    console.error('[GET /admin/stats] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────
router.get('/admin/users', verifyToken, adminOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ created_at: -1 });

    const userList = [];
    for (const u of users) {
      const profile = await Profile.findOne({ user: u._id });
      const yearInfo = getCurrentYearOfStudy(u.admission_year);
      userList.push({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        branch: u.branch,
        admission_year: u.admission_year,
        year: yearInfo.yearOfStudy,
        year_display: yearInfo.displayString,
        is_alumni: yearInfo.isAlumni,
        college: u.college,
        global_score: profile ? profile.global_score : 0,
        cf_handle: profile ? profile.cf_handle : '',
        lc_username: profile ? profile.lc_username : '',
        github_url: profile ? profile.github_url : '',
      });
    }

    return res.status(200).json({ users: userList });
  } catch (err) {
    console.error('[GET /admin/users] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/user/:uid/role ────────────────────────────────
router.post('/admin/user/:uid/role', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const data = req.body || {};
    const newRole = data.role;

    if (!['student', 'mentor', 'admin', 'reviewer', 'superadmin'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetUser = await User.findById(req.params.uid);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentDomain = currentAdmin.email.split('@')[1];
    const targetDomain = targetUser.email.split('@')[1];

    if (currentAdmin.role !== 'superadmin' && targetDomain !== currentDomain) {
      return res.status(403).json({ error: 'Cannot change role of user from different college' });
    }
    if (newRole === 'superadmin' && currentAdmin.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can grant superadmin role' });
    }

    targetUser.role = newRole;
    await targetUser.save();

    return res.status(200).json({ message: `User role updated to ${newRole}` });
  } catch (err) {
    console.error('[POST /admin/user/:uid/role] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/user/:uid ────────────────────────────────────
router.delete('/admin/user/:uid', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const targetUser = await User.findById(req.params.uid);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentDomain = currentAdmin.email.split('@')[1];
    const targetDomain = targetUser.email.split('@')[1];

    if (currentAdmin.role !== 'superadmin' && targetDomain !== currentDomain) {
      return res.status(403).json({ error: 'Cannot delete user from different college' });
    }

    await User.deleteOne({ _id: targetUser._id });
    await Profile.deleteOne({ user: targetUser._id });

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[DELETE /admin/user/:uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/recalculate ────────────────────────────────────
router.post('/admin/recalculate', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    let users = [];

    if (currentAdmin.role === 'superadmin') {
      users = await User.find();
    } else {
      const domain = currentAdmin.email.split('@')[1];
      users = await User.find({ email: new RegExp(`@${domain}$`, 'i') });
    }

    for (const u of users) {
      await updateUserScores(u._id.toString());
    }

    return res.status(200).json({
      message: `Successfully recalculated scores for ${users.length} users`,
    });
  } catch (err) {
    console.error('[POST /admin/recalculate] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/user/:uid/score ────────────────────────────────
router.post('/admin/user/:uid/score', verifyToken, adminOnly, async (req, res) => {
  try {
    const data = req.body || {};
    const points = data.points || 0;

    const profile = await Profile.findOne({ user: req.params.uid });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    profile.activity_score += parseInt(points, 10);
    await profile.save();

    await updateUserScores(req.params.uid);
    const updatedProfile = await Profile.findOne({ user: req.params.uid });

    return res.status(200).json({
      message: `Added ${points} points to user`,
      new_score: updatedProfile ? updatedProfile.global_score : 0,
    });
  } catch (err) {
    console.error('[POST /admin/user/:uid/score] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/dashboard ───────────────────────────────────────
router.get('/admin/dashboard', verifyToken, adminOnly, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalColleges = await College.countDocuments();

    const topProfiles = await Profile.find()
      .sort({ global_score: -1 })
      .limit(10)
      .populate('user');

    const top10 = [];
    for (const p of topProfiles) {
      if (p.user) {
        top10.push({
          id: p.user._id.toString(),
          name: p.user.name,
          college: p.user.college,
          global_score: p.global_score,
        });
      }
    }

    const recentIssuesDocs = await Issue.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate('reported_by');

    const recentIssues = recentIssuesDocs.map((i) => i.toDict());

    return res.status(200).json({
      total_students: totalStudents,
      total_colleges: totalColleges,
      top_10_leaderboard: top10,
      recent_issues: recentIssues,
    });
  } catch (err) {
    console.error('[GET /admin/dashboard] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/colleges/search ─────────────────────────────────
router.get('/admin/colleges/search', verifyToken, adminOnly, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let colleges = [];

    if (!q) {
      colleges = await College.find().sort({ name: 1 }).limit(10);
    } else {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      colleges = await College.find({ name: regex }).sort({ name: 1 }).limit(10);
    }

    return res.status(200).json({ colleges: colleges.map((c) => c.toDict()) });
  } catch (err) {
    console.error('[GET /admin/colleges/search] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/students ────────────────────────────────────────
router.get('/admin/students', verifyToken, adminOnly, async (req, res) => {
  try {
    const college = (req.query.college || '').trim();
    if (!college) return res.status(400).json({ error: 'College parameter is required' });

    const regex = new RegExp(`^${college.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const users = await User.find({ role: 'student', college: regex });

    const students = [];
    for (const u of users) {
      const p = await Profile.findOne({ user: u._id });
      students.push({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        branch: u.branch,
        year: u.year,
        score: p ? p.global_score : 0,
        cf_handle: p ? p.cf_handle : '',
        lc_username: p ? p.lc_username : '',
        github_url: p ? p.github_url : '',
        updatedAt: p && p.last_synced ? p.last_synced.toISOString() : u.created_at.toISOString(),
      });
    }

    return res.status(200).json({ students });
  } catch (err) {
    console.error('[GET /admin/students] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/student/:user_id ────────────────────────────────
router.put('/admin/student/:user_id', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const { user_id } = req.params;
    const data = req.body || {};

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'Student not found' });

    const profile = await Profile.findOne({ user: user._id }).populate('user');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if ('github_url' in data) {
      profile.github_url = data.github_url;
      if (!data.github_url) {
        profile.github_impl_score = 0.0;
        profile.github_imp_score = 0.0;
        profile.github_work_score = 0.0;
        profile.github_total_score = 0.0;
        profile.github_review_reason = '';
      }
    }

    if ('lc_username' in data) {
      profile.lc_username = data.lc_username;
      if (data.lc_username) {
        const stats = await syncLeetcodeStats(data.lc_username);
        if (stats) {
          profile.lc_rating = stats.lc_rating || 0;
          profile.lc_max_rating = stats.lc_max_rating || 0;
          profile.lc_rank = stats.lc_rank || 0;
          profile.lc_problems_solved = stats.lc_problems_solved || 0;
        }
      } else {
        profile.lc_rating = 0;
        profile.lc_max_rating = 0;
        profile.lc_rank = 0;
        profile.lc_problems_solved = 0;
      }
    }

    if ('cf_handle' in data) {
      profile.cf_handle = data.cf_handle;
      if (data.cf_handle) {
        const stats = await syncUserStats(data.cf_handle);
        profile.cf_rating = stats.cf_rating || 0;
        profile.cf_max_rating = stats.cf_max_rating || 0;
        profile.cf_rank = stats.cf_rank || 'unrated';
        profile.cf_problems_solved = stats.cf_problems_solved || 0;
        profile.avatar_url = stats.avatar_url;
      } else {
        profile.cf_rating = 0;
        profile.cf_max_rating = 0;
        profile.cf_rank = 'unrated';
        profile.cf_problems_solved = 0;
        profile.avatar_url = null;
      }
    }

    profile.last_synced = new Date();
    await profile.save();

    await updateUserScores(user._id.toString());

    await AdminLog.create({
      admin_id: currentAdmin._id,
      action: 'EDIT_STUDENT',
      target_user_id: user._id.toString(),
      details: `Updated handles for ${user.name}`,
    });

    return res.status(200).json({
      message: 'Student updated successfully',
      student: profile.toDict(),
    });
  } catch (err) {
    console.error('[PUT /admin/student/:user_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/student/:user_id/scores ─────────────────────────
// Admin contest rating overrides for Codeforces, LeetCode, CodeChef, HackerRank, HackerEarth
router.put('/admin/student/:user_id/scores', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const { user_id } = req.params;
    const data = req.body || {};
    const reason = data.reason || 'Admin contest rating modification';

    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ error: 'Student not found' });

    const profile = await Profile.findOne({ user: user_id }).populate('user');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { calculatePlatformRatings } = await import('../utils/scoring.js');
    const oldRatings = calculatePlatformRatings(profile);

    const platformFields = [
      {
        keys: ['admin_codeforces_rating', 'override_cf_score'],
        field: 'admin_codeforces_rating',
        platform: 'Codeforces',
        actualKey: 'cf',
      },
      {
        keys: ['admin_leetcode_rating', 'override_lc_score'],
        field: 'admin_leetcode_rating',
        platform: 'LeetCode',
        actualKey: 'lc',
      },
      {
        keys: ['admin_codechef_rating', 'override_cc_score'],
        field: 'admin_codechef_rating',
        platform: 'CodeChef',
        actualKey: 'cc',
      },
      {
        keys: ['admin_hackerrank_rating', 'override_hr_score'],
        field: 'admin_hackerrank_rating',
        platform: 'HackerRank',
        actualKey: 'hr',
      },
      {
        keys: ['admin_hackerearth_rating', 'override_he_score'],
        field: 'admin_hackerearth_rating',
        platform: 'HackerEarth',
        actualKey: 'he',
      },
    ];

    const changesLogged = [];

    for (const pf of platformFields) {
      let rawVal = undefined;
      for (const k of pf.keys) {
        if (k in data) {
          rawVal = data[k];
          break;
        }
      }

      if (rawVal !== undefined) {
        const newVal = (rawVal === '' || rawVal === null || rawVal === undefined) ? null : parseFloat(rawVal);
        const oldVal = profile[pf.field];

        if (oldVal !== newVal) {
          profile[pf.field] = newVal;
          // Sync legacy field as well
          if (pf.field === 'admin_codeforces_rating') profile.override_cf_score = newVal;
          if (pf.field === 'admin_leetcode_rating') profile.override_lc_score = newVal;
          if (pf.field === 'admin_codechef_rating') profile.override_cc_score = newVal;
          if (pf.field === 'admin_hackerrank_rating') profile.override_hr_score = newVal;
          if (pf.field === 'admin_hackerearth_rating') profile.override_he_score = newVal;

          const action = newVal !== null ? 'RATING_OVERRIDE' : 'CLEAR_OVERRIDE';
          const prevVal = oldVal !== null && oldVal !== undefined ? oldVal : oldRatings.actual[pf.actualKey];

          changesLogged.push({
            platform: pf.platform,
            action,
            old: prevVal,
            new: newVal,
          });

          await AdminLog.create({
            admin_id: currentAdmin._id,
            student_id: user_id,
            target_user_id: user_id,
            platform: pf.platform,
            action,
            previous_value: prevVal,
            new_value: newVal,
            reason,
            details: `${action} on ${pf.platform} for ${targetUser.name}: ${prevVal} → ${newVal !== null ? newVal : 'AUTO (actual rating)'}`,
          });
        }
      }
    }

    await profile.save();
    await updateUserScores(user_id);

    const updatedProfile = await Profile.findOne({ user: user_id }).populate('user');
    const newRatings = calculatePlatformRatings(updatedProfile);

    return res.status(200).json({
      message: 'Ratings updated & leaderboard recalculated',
      student: updatedProfile.toDict(),
      ratings: newRatings,
      changes_count: changesLogged.length,
    });
  } catch (err) {
    console.error('[PUT /admin/student/:user_id/scores] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/student/:user_id/score-history ─────────────────
router.get('/admin/student/:user_id/score-history', verifyToken, adminOnly, async (req, res) => {
  try {
    const { user_id } = req.params;
    const logs = await AdminLog.find({ target_user_id: user_id })
      .sort({ timestamp: -1 })
      .populate('admin_id');

    return res.status(200).json({
      logs: logs.map((l) => l.toDict()),
    });
  } catch (err) {
    console.error('[GET /admin/student/:user_id/score-history] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/issues ──────────────────────────────────────────
router.get('/admin/issues', verifyToken, adminOnly, async (req, res) => {
  try {
    const issues = await Issue.find().sort({ created_at: -1 }).populate('reported_by');
    return res.status(200).json({ issues: issues.map((i) => i.toDict()) });
  } catch (err) {
    console.error('[GET /admin/issues] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/issues/:issue_id/resolve ───────────────────────
router.put('/admin/issues/:issue_id/resolve', verifyToken, adminOnly, async (req, res) => {
  try {
    const currentAdmin = await User.findById(req.userId);
    const { issue_id } = req.params;

    const issue = await Issue.findById(issue_id).populate('reported_by');
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    issue.status = 'resolved';
    issue.resolved_at = new Date();
    await issue.save();

    await AdminLog.create({
      admin_id: currentAdmin._id,
      action: 'RESOLVE_ISSUE',
      target_user_id: issue.reported_by ? issue.reported_by._id.toString() : '',
      details: `Resolved issue: ${issue.title}`,
    });

    return res.status(200).json({
      message: 'Issue resolved successfully',
      issue: issue.toDict(),
    });
  } catch (err) {
    console.error('[PUT /admin/issues/:issue_id/resolve] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/logs ────────────────────────────────────────────
router.get('/admin/logs', verifyToken, adminOnly, async (req, res) => {
  try {
    const logs = await AdminLog.find().sort({ timestamp: -1 }).populate('admin_id');
    return res.status(200).json({ logs: logs.map((l) => l.toDict()) });
  } catch (err) {
    console.error('[GET /admin/logs] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
