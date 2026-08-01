import mongoose from 'mongoose';

// ── Embedded sub-schema for conversation members ──────────────────
const conversationMemberSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unread_count: { type: Number, default: 0 },
    is_admin:     { type: Boolean, default: false },
    joined_at:    { type: Date, default: Date.now },
    last_read_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  kind:         { type: String, maxlength: 10, default: 'dm' },
  name:         { type: String, maxlength: 100 },
  description:  { type: String, maxlength: 300 },
  group_photo:  { type: String, maxlength: 500, default: '' },
  is_deleted:   { type: Boolean, default: false },
  members:      [conversationMemberSchema],
  last_message: { type: String, maxlength: 500, default: '' },
  last_sender:  { type: String, maxlength: 100, default: '' },
  created_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at:   { type: Date, default: Date.now },
  updated_at:   { type: Date, default: Date.now },
});

conversationSchema.index({ 'members.user': 1 });
conversationSchema.index({ updated_at: -1 });
conversationSchema.index({ is_deleted: 1 });

/**
 * Return the member sub-doc for a given user id string.
 */
conversationSchema.methods.getMember = function (userId) {
  for (const m of this.members) {
    if (m.user.toString() === String(userId)) return m;
  }
  return null;
};

/**
 * Build the API response dict.
 * Requires that `members.user` is populated.
 */
conversationSchema.methods.toDict = function (viewerId) {
  let unread = 0;
  if (viewerId) {
    const m = this.getMember(viewerId);
    unread = m ? m.unread_count : 0;
  }

  const adminList = [];
  const memberList = this.members.map((m) => {
    const u = m.user; // should be populated
    const isPopulated = u && u._id;
    const uid = isPopulated ? u._id.toString() : m.user.toString();
    if (m.is_admin) adminList.push(uid);
    return {
      user_id: uid,
      name: isPopulated ? u.name : '',
      branch: isPopulated ? u.branch : '',
      year: isPopulated ? (u.admission_year ? (new Date().getFullYear() - u.admission_year + 1) : u.year) : 0,
      is_admin: m.is_admin,
      joined_at: m.joined_at ? m.joined_at.toISOString() : null,
    };
  });

  return {
    id: this._id.toString(),
    kind: this.kind,
    name: this.name,
    description: this.description,
    group_photo: this.group_photo || '',
    is_deleted: !!this.is_deleted,
    admins: adminList,
    members: memberList,
    last_message: this.last_message,
    last_sender: this.last_sender,
    unread_count: unread,
    created_at: this.created_at.toISOString(),
    updated_at: this.updated_at.toISOString(),
  };
};

const Conversation = mongoose.model(
  'Conversation',
  conversationSchema,
  'conversations'
);
export { conversationMemberSchema };
export default Conversation;
