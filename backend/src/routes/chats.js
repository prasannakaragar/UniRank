/**
 * routes/chats.js
 * REST API for the Chats / Messaging module.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { User, Conversation, Message, Profile, BlockRecord } from '../models/index.js';
import { getIO } from '../socket.js';

const router = Router();

// Helper to check membership
function isMember(conv, userId) {
  return conv.getMember(userId) !== null;
}

// Helper to batch-fetch avatar_url from Profile collection
async function getUserAvatarsMap(userIds) {
  const map = new Map();
  if (!userIds || userIds.length === 0) return map;
  const uniqueIds = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  if (uniqueIds.length === 0) return map;
  const profiles = await Profile.find({ user: { $in: uniqueIds } }, 'user avatar_url');
  for (const p of profiles) {
    if (p.user) {
      map.set(p.user.toString(), p.avatar_url || null);
    }
  }
  return map;
}

async function populateConvAvatars(convDict) {
  if (!convDict || !Array.isArray(convDict.members)) return convDict;
  const userIds = convDict.members.map((m) => m.user_id).filter(Boolean);
  const map = await getUserAvatarsMap(userIds);
  for (const m of convDict.members) {
    m.avatar_url = map.get(String(m.user_id)) || null;
  }
  return convDict;
}

// ── GET /api/chats ─────────────────────────────────────────────────
router.get('/chats', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const convs = await Conversation.find({
      'members.user': user._id,
      is_deleted: { $ne: true },
    })
      .sort({ updated_at: -1 })
      .populate('members.user');

    const convDicts = convs.map((c) => c.toDict(req.userId));

    // Collect all member user_ids across all conversations
    const allUserIds = [];
    for (const c of convDicts) {
      if (c.members) {
        for (const m of c.members) {
          if (m.user_id) allUserIds.push(m.user_id);
        }
      }
    }

    const avatarsMap = await getUserAvatarsMap(allUserIds);

    for (const c of convDicts) {
      if (c.members) {
        for (const m of c.members) {
          m.avatar_url = avatarsMap.get(String(m.user_id)) || null;
        }
      }
    }

    return res.status(200).json({
      conversations: convDicts,
    });
  } catch (err) {
    console.error('[GET /chats] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/dm ─────────────────────────────────────────────
router.post('/chats/dm', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const data = req.body || {};
    const targetId = data.user_id;

    if (!targetId || String(targetId) === String(req.userId)) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    const other = await User.findById(targetId);
    if (!other) return res.status(404).json({ error: 'User not found' });

    // Check existing DM
    const existing = await Conversation.find({
      kind: 'dm',
      'members.user': me._id,
    }).populate('members.user');

    for (const conv of existing) {
      const ids = new Set(conv.members.map((m) => m.user._id.toString()));
      if (ids.has(String(req.userId)) && ids.has(String(targetId)) && ids.size === 2) {
        return res.status(200).json({ conversation: conv.toDict(req.userId) });
      }
    }

    // Create new DM
    const conv = new Conversation({
      kind: 'dm',
      created_by: me._id,
      members: [
        { user: me._id, is_admin: true },
        { user: other._id, is_admin: false },
      ],
    });
    await conv.save();
    await conv.populate('members.user');

    return res.status(201).json({ conversation: conv.toDict(req.userId) });
  } catch (err) {
    console.error('[POST /chats/dm] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/group ──────────────────────────────────────────
router.post('/chats/group', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const data = req.body || {};

    const name = (data.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const memberIds = data.member_ids || [];
    const allIds = [...new Set([req.userId, ...memberIds.map(String)])];

    const members = [];
    for (let idx = 0; idx < allIds.length; idx++) {
      const mid = allIds[idx];
      const u = await User.findById(mid);
      if (u) {
        members.push({ user: u._id, is_admin: idx === 0 });
      }
    }

    if (members.length < 2) {
      return res.status(400).json({ error: 'A group needs at least 2 members' });
    }

    const conv = new Conversation({
      kind: 'group',
      name,
      description: (data.description || '').trim(),
      group_photo: (data.group_photo || '').trim(),
      created_by: me._id,
      members,
    });
    await conv.save();
    await conv.populate('members.user');

    return res.status(201).json({ conversation: conv.toDict(req.userId) });
  } catch (err) {
    console.error('[POST /chats/group] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/chats/:conv_id/messages ───────────────────────────────
router.get('/chats/:conv_id/messages', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const user = await User.findById(req.userId);
    const conv = await Conversation.findById(conv_id);

    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!isMember(conv, req.userId)) return res.status(403).json({ error: 'Access denied' });

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(100, parseInt(req.query.per_page || '50', 10));
    const skip = (page - 1) * perPage;

    const msgs = await Message.find({
      conversation: conv._id,
      deleted_for: { $ne: user._id },
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(perPage)
      .populate('sender');

    const msgsList = msgs.reverse().map((m) => m.toDict());

    // Collect sender_id from each message
    const senderIds = msgsList.map((m) => m.senderId || m.sender_id).filter(Boolean);
    const avatarsMap = await getUserAvatarsMap(senderIds);

    for (const m of msgsList) {
      const sid = String(m.senderId || m.sender_id);
      m.sender_avatar_url = avatarsMap.get(sid) || null;
    }

    // Mark status as delivered
    await Message.updateMany(
      { conversation: conv._id, status: 'sent', sender: { $ne: user._id } },
      { $set: { status: 'delivered' } }
    );

    return res.status(200).json({
      messages: msgsList,
      page,
      per_page: perPage,
    });
  } catch (err) {
    console.error('[GET /chats/:conv_id/messages] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/:conv_id/messages ──────────────────────────────
router.post('/chats/:conv_id/messages', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const me = await User.findById(req.userId);
    const conv = await Conversation.findById(conv_id);

    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!isMember(conv, req.userId)) return res.status(403).json({ error: 'Access denied' });

    const data = req.body || {};
    const content = (data.content || '').trim();
    const mediaUrl = data.media_url;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }
    if (content && content.length > 4000) {
      return res.status(400).json({ error: 'Message too long (max 4000 chars)' });
    }

    const mentionIds = data.mention_ids || [];
    const mentioned = [];
    for (const mid of mentionIds) {
      if (mid) {
        const u = await User.findById(mid);
        if (u) mentioned.push(u._id);
      }
    }

    const msg = new Message({
      conversation: conv._id,
      sender: me._id,
      content,
      media_url: mediaUrl,
      mentions: mentioned,
    });
    await msg.save();
    await msg.populate('sender');

    const msgDict = msg.toDict();
    const avatarsMap = await getUserAvatarsMap([msgDict.senderId]);
    msgDict.sender_avatar_url = avatarsMap.get(String(msgDict.senderId)) || null;

    // Update conversation preview + unread count
    const previewText = content || '📷 Photo';
    conv.last_message = previewText.length > 120 ? previewText.slice(0, 120) + '…' : previewText;
    conv.last_sender = me.name;
    conv.updated_at = new Date();

    for (const m of conv.members) {
      if (m.user.toString() !== String(req.userId)) {
        m.unread_count += 1;
      }
    }
    await conv.save();

    // Socket.IO emissions
    const io = getIO();
    if (io) {
      io.to(conv_id).emit('new_message', {
        conversation_id: conv_id,
        message: msgDict,
      });

      for (const m of conv.members) {
        io.to(`user_${m.user.toString()}`).emit('unread_update', {
          conversation_id: conv_id,
          unread_count: m.unread_count,
        });
      }
    }

    return res.status(201).json({ message: msgDict });
  } catch (err) {
    console.error('[POST /chats/:conv_id/messages] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/chats/:conv_id/messages/bulk-delete ────────────────
router.delete('/chats/:conv_id/messages/bulk-delete', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const user = await User.findById(req.userId);
    const data = req.body || {};
    const msgIds = data.message_ids || [];
    const mode = data.mode || 'me';

    if (!msgIds.length) return res.status(400).json({ error: 'No messages selected' });

    const conv = await Conversation.findById(conv_id);
    if (!conv || !isMember(conv, req.userId)) {
      return res.status(403).json({ error: 'Conversation not found or access denied' });
    }

    let deletedCount = 0;
    const io = getIO();

    for (const mid of msgIds) {
      const msg = await Message.findOne({ _id: mid, conversation: conv_id });
      if (!msg) continue;

      if (mode === 'everyone') {
        if (msg.sender.toString() === String(req.userId)) {
          await Message.deleteOne({ _id: msg._id });
          deletedCount++;
          if (io) {
            io.to(conv_id).emit('message_deleted', {
              conversation_id: conv_id,
              message_id: mid,
              mode: 'everyone',
            });
          }
        }
      } else {
        if (!msg.deleted_for.some((id) => id.toString() === user._id.toString())) {
          msg.deleted_for.push(user._id);
          if (msg.deleted_for.length >= conv.members.length) {
            await Message.deleteOne({ _id: msg._id });
          } else {
            await msg.save();
          }
          deletedCount++;
          if (io) {
            io.to(`user_${req.userId}`).emit('message_deleted', {
              conversation_id: conv_id,
              message_id: mid,
              mode: 'me',
            });
          }
        }
      }
    }

    return res.status(200).json({ ok: true, deleted_count: deletedCount });
  } catch (err) {
    console.error('[DELETE /chats/:conv_id/messages/bulk-delete] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/chats/:conv_id/messages/:msg_id ────────────────────
router.delete('/chats/:conv_id/messages/:msg_id', verifyToken, async (req, res) => {
  try {
    const { conv_id, msg_id } = req.params;
    const user = await User.findById(req.userId);
    const mode = req.query.mode || 'me';

    const conv = await Conversation.findById(conv_id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const msg = await Message.findOne({ _id: msg_id, conversation: conv_id });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const io = getIO();

    if (mode === 'everyone') {
      if (msg.sender.toString() !== String(req.userId)) {
        return res.status(403).json({ error: "Cannot delete another user's message for everyone" });
      }

      await Message.deleteOne({ _id: msg._id });
      if (io) {
        io.to(conv_id).emit('message_deleted', {
          conversation_id: conv_id,
          message_id: msg_id,
          mode: 'everyone',
        });
      }
    } else {
      if (!msg.deleted_for.some((id) => id.toString() === user._id.toString())) {
        msg.deleted_for.push(user._id);
        if (msg.deleted_for.length >= conv.members.length) {
          await Message.deleteOne({ _id: msg._id });
        } else {
          await msg.save();
        }
      }

      if (io) {
        io.to(`user_${req.userId}`).emit('message_deleted', {
          conversation_id: conv_id,
          message_id: msg_id,
          mode: 'me',
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[DELETE /chats/:conv_id/messages/:msg_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/messages/:msg_id/forward ───────────────────────
router.post('/chats/messages/:msg_id/forward', verifyToken, async (req, res) => {
  try {
    const { msg_id } = req.params;
    const me = await User.findById(req.userId);
    const data = req.body || {};
    const targetChatId = data.target_chat_id;

    if (!targetChatId) return res.status(400).json({ error: 'Target chat ID required' });

    const oldMsg = await Message.findById(msg_id);
    if (!oldMsg) return res.status(404).json({ error: 'Original message not found' });

    const targetConv = await Conversation.findById(targetChatId);
    if (!targetConv || !isMember(targetConv, req.userId)) {
      return res.status(403).json({ error: 'Target chat not found or access denied' });
    }

    const newMsg = new Message({
      conversation: targetConv._id,
      sender: me._id,
      content: oldMsg.content,
      forwarded: true,
    });
    await newMsg.save();
    await newMsg.populate('sender');

    targetConv.last_message = 'Forwarded: ' + (newMsg.content.slice(0, 100) + '...');
    targetConv.last_sender = me.name;
    targetConv.updated_at = new Date();

    for (const m of targetConv.members) {
      if (m.user.toString() !== String(req.userId)) {
        m.unread_count += 1;
      }
    }
    await targetConv.save();

    const io = getIO();
    if (io) {
      io.to(targetChatId).emit('new_message', {
        conversation_id: targetChatId,
        message: newMsg.toDict(),
      });

      io.to(`user_${req.userId}`).emit('message_forwarded', {
        source_message_id: msg_id,
        new_message: newMsg.toDict(),
      });
    }

    return res.status(201).json({ message: newMsg.toDict() });
  } catch (err) {
    console.error('[POST /chats/messages/:msg_id/forward] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/:conv_id/read ──────────────────────────────────
router.post('/chats/:conv_id/read', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const member = conv.getMember(req.userId);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    member.unread_count = 0;
    member.last_read_at = new Date();
    await conv.save();

    await Message.updateMany(
      { conversation: conv._id, status: { $in: ['sent', 'delivered'] }, sender: { $ne: req.userId } },
      { $set: { status: 'seen' } }
    );

    const io = getIO();
    if (io) {
      io.to(conv_id).emit('messages_read', {
        conversation_id: conv_id,
        user_id: req.userId,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[POST /chats/:conv_id/read] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



// ── GET /api/chats/search/users ────────────────────────────────────
router.get('/chats/search/users', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const branch = req.query.branch || '';
    const year = req.query.year || '';

    const queryFilter = { _id: { $ne: req.userId } };
    if (branch) queryFilter.branch = branch;
    if (year && !isNaN(parseInt(year, 10))) queryFilter.year = parseInt(year, 10);

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      queryFilter.$or = [{ name: regex }, { email: regex }];
    }

    const users = await User.find(queryFilter).limit(30);

    const results = [];
    for (const u of users) {
      const profile = await Profile.findOne({ user: u._id });
      results.push({
        user_id: u._id.toString(),
        name: u.name,
        branch: u.branch,
        year: u.year,
        avatar_url: profile ? profile.avatar_url : null,
        cf_rating: profile ? profile.cf_rating : 0,
        cf_rank: profile ? profile.cf_rank : 'unrated',
      });
    }

    return res.status(200).json({ users: results });
  } catch (err) {
    console.error('[GET /chats/search/users] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/chats/unread ───────────────────────────────────────────
router.get('/chats/unread', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(200).json({ unread: 0 });

    const convs = await Conversation.find({ 'members.user': user._id });
    const total = convs.reduce((sum, conv) => {
      const m = conv.getMember(req.userId);
      return sum + (m ? m.unread_count : 0);
    }, 0);

    return res.status(200).json({ unread: total });
  } catch (err) {
    console.error('[GET /chats/unread] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST & DELETE /api/chats/block/:target_uid ─────────────────────
router.post('/chats/block/:target_uid', verifyToken, async (req, res) => {
  try {
    const { target_uid } = req.params;
    const me = await User.findById(req.userId);
    const target = await User.findById(target_uid);

    if (!target) return res.status(404).json({ error: 'User not found' });

    const existing = await BlockRecord.findOne({ blocker: me._id, blocked: target._id });
    if (!existing) {
      await BlockRecord.create({ blocker: me._id, blocked: target._id });
    }

    return res.status(200).json({ ok: true, blocked: target_uid });
  } catch (err) {
    console.error('[POST /chats/block/:target_uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/chats/block/:target_uid', verifyToken, async (req, res) => {
  try {
    const { target_uid } = req.params;
    const me = await User.findById(req.userId);
    const target = await User.findById(target_uid);

    if (target) {
      await BlockRecord.deleteOne({ blocker: me._id, blocked: target._id });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[DELETE /chats/block/:target_uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE & PATCH /api/chats/:conv_id ─────────────────────────────
router.delete('/chats/:conv_id', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const member = conv.getMember(req.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });

    if (conv.kind === 'dm') {
      await Message.deleteMany({ conversation: conv._id });
      await Conversation.deleteOne({ _id: conv._id });
    } else {
      conv.members = conv.members.filter((m) => m.user.toString() !== String(req.userId));
      if (!conv.members.length) {
        await Message.deleteMany({ conversation: conv._id });
        await Conversation.deleteOne({ _id: conv._id });
      } else {
        if (member.is_admin && !conv.members.some((m) => m.is_admin)) {
          conv.members[0].is_admin = true;
        }
        await conv.save();
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[DELETE /chats/:conv_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/chats/:conv_id', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv || conv.kind !== 'group' || conv.is_deleted) return res.status(404).json({ error: 'Group not found' });

    const member = conv.getMember(req.userId);
    if (!member || !member.is_admin) {
      return res.status(403).json({ error: 'Only admins can update group info' });
    }

    const data = req.body || {};
    if (data.name && data.name.trim()) conv.name = data.name.trim();
    if ('description' in data) conv.description = (data.description || '').trim();
    if ('group_photo' in data) conv.group_photo = (data.group_photo || '').trim();

    conv.updated_at = new Date();
    await conv.save();
    await conv.populate('members.user');

    const io = getIO();
    if (io) {
      io.to(conv_id).emit('group_updated', {
        conversation_id: conv_id,
        name: conv.name,
        description: conv.description,
        group_photo: conv.group_photo,
      });
    }

    return res.status(200).json({ conversation: conv.toDict(req.userId) });
  } catch (err) {
    console.error('[PATCH /chats/:conv_id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/chats/:conv_id/members ──────────────────────────────
router.post('/chats/:conv_id/members', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv || conv.kind !== 'group' || conv.is_deleted) return res.status(404).json({ error: 'Group not found' });

    const requesterMember = conv.getMember(req.userId);
    if (!requesterMember || !requesterMember.is_admin) {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    const data = req.body || {};
    let memberIds = [];
    if (Array.isArray(data.member_ids)) {
      memberIds = data.member_ids.map(String);
    } else if (data.user_id) {
      memberIds = [String(data.user_id)];
    }

    if (!memberIds.length) return res.status(400).json({ error: 'No members provided' });

    let addedCount = 0;
    for (const mid of memberIds) {
      if (!conv.getMember(mid)) {
        const u = await User.findById(mid);
        if (u) {
          conv.members.push({ user: u._id, is_admin: false, joined_at: new Date() });
          addedCount++;
        }
      }
    }

    conv.updated_at = new Date();
    await conv.save();
    await conv.populate('members.user');

    const io = getIO();
    if (io) {
      io.to(conv_id).emit('group_updated', { conversation_id: conv_id });
    }

    return res.status(200).json({
      ok: true,
      message: `Added ${addedCount} member(s)`,
      conversation: conv.toDict(req.userId),
    });
  } catch (err) {
    console.error('[POST /chats/:conv_id/members] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/chats/:conv_id/members/:target_uid ─────────────────
router.delete('/chats/:conv_id/members/:target_uid', verifyToken, async (req, res) => {
  try {
    const { conv_id, target_uid } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv || conv.kind !== 'group' || conv.is_deleted) return res.status(404).json({ error: 'Group not found' });

    const requesterMember = conv.getMember(req.userId);
    if (!requesterMember) return res.status(403).json({ error: 'Access denied' });

    const targetMember = conv.getMember(target_uid);
    if (!targetMember) return res.status(404).json({ error: 'Member not found in group' });

    const isSelfRemoval = String(target_uid) === String(req.userId);
    if (!isSelfRemoval && !requesterMember.is_admin) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Remove target member
    conv.members = conv.members.filter((m) => m.user.toString() !== String(target_uid));

    // Precedence Check:
    // 1. If no members remain -> Soft Delete (is_deleted = true)
    if (conv.members.length === 0) {
      conv.is_deleted = true;
      conv.updated_at = new Date();
      await conv.save();
      return res.status(200).json({ message: 'Group emptied and archived (soft-deleted).' });
    }

    // 2. If members remain and 0 admins remain -> Auto-promote earliest joined member
    const hasAdmin = conv.members.some((m) => m.is_admin);
    if (!hasAdmin && conv.members.length > 0) {
      conv.members.sort((a, b) => new Date(a.joined_at || 0) - new Date(b.joined_at || 0));
      conv.members[0].is_admin = true;
    }

    conv.updated_at = new Date();
    await conv.save();
    await conv.populate('members.user');

    const io = getIO();
    if (io) {
      io.to(conv_id).emit('group_updated', { conversation_id: conv_id });
    }

    return res.status(200).json({ message: 'Member removed', conversation: conv.toDict(req.userId) });
  } catch (err) {
    console.error('[DELETE /chats/:conv_id/members/:target_uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/chats/:conv_id/admins/:target_uid ──────────────────
router.patch('/chats/:conv_id/admins/:target_uid', verifyToken, async (req, res) => {
  try {
    const { conv_id, target_uid } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv || conv.kind !== 'group' || conv.is_deleted) return res.status(404).json({ error: 'Group not found' });

    const requesterMember = conv.getMember(req.userId);
    if (!requesterMember || !requesterMember.is_admin) {
      return res.status(403).json({ error: 'Only admins can manage admin status' });
    }

    const targetMember = conv.getMember(target_uid);
    if (!targetMember) return res.status(404).json({ error: 'Member not found in group' });

    const data = req.body || {};
    const makeAdmin = data.is_admin !== undefined ? !!data.is_admin : (data.action === 'promote');

    // Prevent last admin from demoting themselves
    if (!makeAdmin && String(target_uid) === String(req.userId)) {
      const adminCount = conv.members.filter((m) => m.is_admin).length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote yourself as the last remaining admin. Transfer adminship first.' });
      }
    }

    targetMember.is_admin = makeAdmin;
    conv.updated_at = new Date();
    await conv.save();
    await conv.populate('members.user');

    const io = getIO();
    if (io) {
      io.to(conv_id).emit('group_updated', { conversation_id: conv_id });
    }

    return res.status(200).json({ message: `Admin status updated`, conversation: conv.toDict(req.userId) });
  } catch (err) {
    console.error('[PATCH /chats/:conv_id/admins/:target_uid] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/chats/:conv_id/media ──────────────────────────────────
router.get('/chats/:conv_id/media', verifyToken, async (req, res) => {
  try {
    const { conv_id } = req.params;
    const conv = await Conversation.findById(conv_id);
    if (!conv || !isMember(conv, req.userId)) {
      return res.status(403).json({ error: 'Conversation not found or access denied' });
    }

    const mediaMsgs = await Message.find({
      conversation: conv._id,
      media_url: { $ne: null, $exists: true, $ne: '' },
    })
      .sort({ created_at: -1 })
      .populate('sender');

    const results = mediaMsgs.map((m) => ({
      messageId: m._id.toString(),
      media_url: m.media_url,
      sender_name: m.sender ? m.sender.name : 'Unknown',
      timestamp: m.created_at.toISOString(),
    }));

    return res.status(200).json(results);
  } catch (err) {
    console.error('[GET /chats/:conv_id/media] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
