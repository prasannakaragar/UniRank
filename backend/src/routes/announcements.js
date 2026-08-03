/**
 * routes/announcements.js
 * CRUD for hackathon / contest announcements.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { User, Announcement } from '../models/index.js';
import { updateUserScores } from '../utils/scoring.js';

const router = Router();

// ── GET /api/announcements ─────────────────────────────────────────
router.get('/announcements', verifyToken, async (req, res) => {
  try {
    const category = req.query.category;
    const queryParams = {};
    if (category) queryParams.category = category;

    const posts = await Announcement.find(queryParams)
      .sort({ is_pinned: -1, created_at: -1 })
      .populate('author');

    return res.status(200).json({
      announcements: posts.map((p) => p.toDict()),
    });
  } catch (err) {
    console.error('[GET /announcements] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/announcements/:id ─────────────────────────────────────
router.get('/announcements/:id', verifyToken, async (req, res) => {
  try {
    const post = await Announcement.findById(req.params.id).populate('author');
    if (!post) return res.status(404).json({ error: 'Announcement not found' });

    const isUserRegistered = post.registrations.some(
      (r) => r.toString() === req.userId.toString()
    );

    return res.status(200).json({
      announcement: {
        ...post.toDict(),
        is_user_registered: isUserRegistered,
      },
    });
  } catch (err) {
    console.error('[GET /announcements/:id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/announcements ────────────────────────────────────────
router.post('/announcements', verifyToken, adminOnly, async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.title || !data.description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const author = await User.findById(req.userId);
    if (!author) return res.status(404).json({ error: 'Author not found' });

    let expiresAt = null;
    const eventDateStr = data.event_date;
    if (eventDateStr) {
      const dt = new Date(eventDateStr);
      if (!isNaN(dt.getTime())) {
        expiresAt = new Date(dt.getTime() + 24 * 60 * 60 * 1000); // dt + 1 day
      }
    }

    // Sanitize stages array
    let stages = [];
    if (Array.isArray(data.stages)) {
      stages = data.stages
        .filter((s) => s && (s.title || s.date_range || s.description))
        .map((s) => ({
          title: (s.title || '').trim(),
          date_range: (s.date_range || '').trim(),
          description: (s.description || '').trim(),
        }));
    }

    // Sanitize faqs array
    let faqs = [];
    if (Array.isArray(data.faqs)) {
      faqs = data.faqs
        .filter((f) => f && (f.question || f.answer))
        .map((f) => ({
          question: (f.question || '').trim(),
          answer: (f.answer || '').trim(),
        }));
    }

    const post = new Announcement({
      author: author._id,
      title: data.title.trim(),
      description: data.description.trim(),
      link: data.link,
      event_date: eventDateStr,
      category: data.category || 'general',
      organization: data.organization || '',
      participation_type: data.participation_type || 'Individual Participation',
      mode: data.mode || 'Online',
      tags: Array.isArray(data.tags) ? data.tags.join(',') : data.tags || '',
      deadline: data.deadline,
      banner_url: data.banner_url,
      background_banner_url: data.background_banner_url,
      team_size: data.team_size || 'Individual',
      perks: data.perks || '',
      expires_at: expiresAt,

      // New fields
      registration_start_date: data.registration_start_date || null,
      prize_pool: data.prize_pool || '',
      eligibility: data.eligibility || '',
      stages,
      faqs,
    });

    await post.save();
    await post.populate('author');
    await updateUserScores(req.userId);

    return res.status(201).json({
      message: 'Announcement posted',
      announcement: post.toDict(),
    });
  } catch (err) {
    console.error('[POST /announcements] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/announcements/:id/register ──────────────────────────
router.post('/announcements/:id/register', verifyToken, async (req, res) => {
  try {
    const post = await Announcement.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Announcement not found' });

    const userId = req.userId;
    const alreadyRegistered = post.registrations.some(
      (r) => r.toString() === userId.toString()
    );
    if (alreadyRegistered) {
      return res.status(409).json({ error: 'Already registered' });
    }

    post.registrations.push(userId);
    post.registered_count = post.registrations.length;
    await post.save();

    return res.status(200).json({
      message: 'Registered successfully',
      registered_count: post.registered_count,
    });
  } catch (err) {
    console.error('[POST /announcements/:id/register] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/announcements/:post_id ─────────────────────────────
router.delete('/announcements/:post_id', verifyToken, adminOnly, async (req, res) => {
  try {
    const post = await Announcement.findById(req.params.post_id);
    if (!post) return res.status(404).json({ error: 'Announcement not found' });

    await Announcement.deleteOne({ _id: post._id });
    await updateUserScores(req.userId);

    return res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE /announcements/:post_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
