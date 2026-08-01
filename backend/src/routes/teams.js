/**
 * routes/teams.js
 * Team formation board — students signal availability or recruit members.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { rolesRequired } from '../middleware/roles.js';
import { User, TeamPost } from '../models/index.js';
import { updateUserScores } from '../utils/scoring.js';

const router = Router();

// ── GET /api/teams ─────────────────────────────────────────────────
router.get('/teams', verifyToken, async (req, res) => {
  try {
    const postType = req.query.type;
    const queryParams = { is_active: true };
    if (postType) queryParams.post_type = postType;

    const posts = await TeamPost.find(queryParams)
      .sort({ created_at: -1 })
      .populate('author');

    return res.status(200).json({
      teams: posts.map((p) => p.toDict()),
    });
  } catch (err) {
    console.error('[GET /teams] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/teams ────────────────────────────────────────────────
router.post('/teams', verifyToken, rolesRequired('student', 'admin', 'superadmin'), async (req, res) => {
  try {
    const data = req.body || {};
    if (!['looking', 'recruiting'].includes(data.post_type)) {
      return res.status(400).json({ error: "post_type must be 'looking' or 'recruiting'" });
    }
    if (!data.title) {
      return res.status(400).json({ error: "'title' is required" });
    }

    const author = await User.findById(req.userId);
    if (!author) return res.status(404).json({ error: 'User not found' });

    let skills = data.skills_needed || '';
    if (Array.isArray(skills)) skills = skills.join(',');

    const post = new TeamPost({
      author: author._id,
      post_type: data.post_type,
      title: data.title.trim(),
      description: data.description,
      skills_needed: skills,
      contact_info: data.contact_info,
      team_size: data.team_size,
    });

    await post.save();
    await post.populate('author');
    await updateUserScores(req.userId);

    return res.status(201).json({
      message: 'Team post created',
      team: post.toDict(),
    });
  } catch (err) {
    console.error('[POST /teams] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/teams/:post_id ─────────────────────────────────────
router.delete('/teams/:post_id', verifyToken, async (req, res) => {
  try {
    const requester = await User.findById(req.userId);
    const post = await TeamPost.findById(req.params.post_id);
    if (!post) return res.status(404).json({ error: 'Team post not found' });

    if (post.author.toString() !== String(req.userId) && requester.role !== 'admin' && requester.role !== 'superadmin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const authorId = post.author.toString();
    await TeamPost.deleteOne({ _id: post._id });
    await updateUserScores(authorId);

    return res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE /teams/:post_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/teams/:post_id/close ────────────────────────────────
router.patch('/teams/:post_id/close', verifyToken, async (req, res) => {
  try {
    const requester = await User.findById(req.userId);
    const post = await TeamPost.findById(req.params.post_id);
    if (!post) return res.status(404).json({ error: 'Team post not found' });

    if (post.author.toString() !== String(req.userId) && requester.role !== 'admin' && requester.role !== 'superadmin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    post.is_active = false;
    await post.save();

    return res.status(200).json({ message: 'Post marked as closed' });
  } catch (err) {
    console.error('[PATCH /teams/:post_id/close] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
