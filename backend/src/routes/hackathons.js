/**
 * routes/hackathons.js
 * Certificate/Achievement submission and review system.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { rolesRequired } from '../middleware/roles.js';
import { User, Profile, HackathonSubmission, HackathonResult, Notification } from '../models/index.js';
import { updateUserScores } from '../utils/scoring.js';
import { getIO } from '../socket.js';

const router = Router();

const POINTS_MAP = {
  Attended: 10,
  Participated: 15,
  '3rd Place': 30,
  '2nd Place': 50,
  '1st Place': 100,
};

const VALID_EVENT_TYPES = Object.keys(POINTS_MAP);

// ── Student: Submit a certificate request ──────────────────────────
router.post('/hackathons/submit', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const data = req.body || {};
    const hackathonName = (data.hackathon_name || '').trim();
    const eventType = (data.event_type || '').trim();
    const certificateUrl = data.certificate_url || '';

    if (!hackathonName) return res.status(400).json({ error: 'Hackathon name is required' });
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        error: `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
      });
    }

    const pointsToAward = POINTS_MAP[eventType];
    const positionMap = { '1st Place': 1, '2nd Place': 2, '3rd Place': 3, Participated: 0, Attended: 0 };

    const submission = new HackathonSubmission({
      user: user._id,
      hackathon_name: hackathonName,
      event_type: eventType,
      certificate_url: certificateUrl,
      points_to_award: pointsToAward,
      position: positionMap[eventType] || 0,
    });
    await submission.save();

    // Notify admins from same college domain
    const userDomain = user.email.split('@')[1];
    const admins = await User.find({ role: { $in: ['admin', 'superadmin', 'reviewer'] } });

    for (const admin of admins) {
      const adminDomain = admin.email.split('@')[1];
      if (admin.role === 'superadmin' || adminDomain === userDomain) {
        await Notification.create({
          recipient: admin._id,
          title: 'New Certificate Request',
          message: `${user.name} submitted a certificate for ${hackathonName} (${eventType}).`,
          type: 'certificate_request',
          request_id: submission._id,
          link: '/profile',
        });
      }
    }

    // Emit Socket.IO event
    const io = getIO();
    if (io) {
      try {
        io.emit('new_certificate_request', {
          id: submission._id.toString(),
          user_name: user.name,
          hackathon_name: hackathonName,
          event_type: eventType,
          points_to_award: pointsToAward,
          college_domain: userDomain,
        });
      } catch {
        // Non-blocking
      }
    }

    return res.status(201).json({ message: 'Submission received. Pending review.' });
  } catch (err) {
    console.error('[POST /hackathons/submit] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Student: Get my own submissions ────────────────────────────────
router.get('/hackathons/my-submissions', verifyToken, async (req, res) => {
  try {
    const submissions = await HackathonSubmission.find({ user: req.userId })
      .sort({ created_at: -1 })
      .populate('user');
    return res.status(200).json({ submissions: submissions.map((s) => s.toDict()) });
  } catch (err) {
    console.error('[GET /hackathons/my-submissions] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin: Get all pending submissions ─────────────────────────────
async function handleGetPendingRequests(req, res) {
  try {
    const user = await User.findById(req.userId);
    let submissions = [];

    if (user.role === 'superadmin') {
      submissions = await HackathonSubmission.find({ status: 'pending' })
        .sort({ created_at: -1 })
        .populate('user');
    } else {
      const adminDomain = user.email.split('@')[1];
      const collegeUsers = await User.find({ email: new RegExp(`@${adminDomain}$`, 'i') }).select('_id');
      const collegeUserIds = collegeUsers.map((u) => u._id);

      submissions = await HackathonSubmission.find({
        user: { $in: collegeUserIds },
        status: 'pending',
      })
        .sort({ created_at: -1 })
        .populate('user');
    }

    return res.status(200).json({ submissions: submissions.map((s) => s.toDict()) });
  } catch (err) {
    console.error('[GET pending requests] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const adminReviewerAccess = rolesRequired('admin', 'superadmin', 'reviewer');
router.get('/hackathons/pending-requests', verifyToken, adminReviewerAccess, handleGetPendingRequests);
router.get('/hackathons/submissions', verifyToken, adminReviewerAccess, handleGetPendingRequests);

// ── Admin: Approve or Reject a submission ──────────────────────────
router.post('/hackathons/submissions/:sub_id/review', verifyToken, adminReviewerAccess, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const { sub_id } = req.params;
    const action = req.body?.action;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'." });
    }

    const submission = await HackathonSubmission.findById(sub_id).populate('user');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status !== 'pending') {
      return res.status(400).json({ error: 'Submission is already processed' });
    }

    const adminDomain = adminUser.email.split('@')[1];
    const userDomain = submission.user.email.split('@')[1];

    if (adminUser.role !== 'superadmin' && userDomain !== adminDomain) {
      return res.status(403).json({ error: 'Cannot review submissions from other colleges' });
    }

    // Mark notification as read by this admin
    const certNotifs = await Notification.find({
      request_id: submission._id,
      type: 'certificate_request',
    });

    for (const notif of certNotifs) {
      if (!notif.read_by.includes(String(adminUser._id))) {
        notif.read_by.push(String(adminUser._id));
        notif.is_read = true;
        await notif.save();
      }
    }

    const now = new Date();
    const io = getIO();

    if (action === 'approve') {
      submission.status = 'approved';
      submission.reviewed_by = adminUser._id;
      submission.reviewed_at = now;
      await submission.save();

      const points = submission.points_to_award || POINTS_MAP[submission.event_type] || 10;

      await HackathonResult.create({
        user: submission.user._id,
        hackathon_name: submission.hackathon_name,
        position: submission.position || 0,
        points,
      });

      const profile = await Profile.findOne({ user: submission.user._id });
      if (profile) {
        profile.hackathon_score += points;
        await profile.save();
        await updateUserScores(submission.user._id.toString());
      }

      await Notification.create({
        recipient: submission.user._id,
        title: 'Achievement Approved!',
        message: `Your submission for ${submission.hackathon_name} was approved! You earned ${points} points.`,
        type: 'achievement',
      });

      if (io) {
        try {
          io.emit('certificate_status_update', {
            request_id: submission._id.toString(),
            student_id: submission.user._id.toString(),
            status: 'approved',
            points,
            event_name: submission.hackathon_name,
          });
        } catch {
          // Non-blocking
        }
      }

      return res.status(200).json({
        message: `Approved! ${points} points awarded to ${submission.user.name}.`,
        points,
      });
    } else {
      submission.status = 'rejected';
      submission.reviewed_by = adminUser._id;
      submission.reviewed_at = now;
      await submission.save();

      await Notification.create({
        recipient: submission.user._id,
        title: 'Submission Rejected',
        message: `Your submission for ${submission.hackathon_name} could not be verified and was rejected.`,
        type: 'system',
      });

      if (io) {
        try {
          io.emit('certificate_status_update', {
            request_id: submission._id.toString(),
            student_id: submission.user._id.toString(),
            status: 'rejected',
            points: 0,
            event_name: submission.hackathon_name,
          });
        } catch {
          // Non-blocking
        }
      }

      return res.status(200).json({ message: 'Request rejected.' });
    }
  } catch (err) {
    console.error('[POST /hackathons/submissions/:sub_id/review] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin: Get unread certificate notification count ───────────────
router.get('/notifications/unread-count', verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.userId,
      type: 'certificate_request',
      is_read: false,
    });

    const count = notifications.filter((n) => !n.read_by.includes(String(req.userId))).length;
    return res.status(200).json({ count });
  } catch (err) {
    console.error('[GET /notifications/unread-count] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Notifications: List and mark-read ──────────────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userId }).sort({ created_at: -1 });
    return res.status(200).json({ notifications: notifications.map((n) => n.toDict()) });
  } catch (err) {
    console.error('[GET /notifications] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/:notif_id/read', verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.notif_id, recipient: req.userId });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    notif.is_read = true;
    await notif.save();
    return res.status(200).json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[POST /notifications/:notif_id/read] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
