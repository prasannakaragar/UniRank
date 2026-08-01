import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Stored as 'content' in MongoDB (db_field='content' in Mongoengine)
  content:   { type: String, required: true },
  media_url: { type: String },
  status:    { type: String, maxlength: 15, default: 'sent' },
  mentions:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  forwarded: { type: Boolean, default: false },
  deleted_for: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  is_deleted_for_everyone: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

messageSchema.index({ conversation: 1 });
messageSchema.index({ created_at: -1 });
messageSchema.index({ sender: 1 });

/**
 * Build the API response dict.
 * Requires that `sender` is populated.
 */
messageSchema.methods.toDict = function () {
  const s = this.sender;
  const isPopulated = s && s._id;
  const senderId   = isPopulated ? s._id.toString() : this.sender.toString();
  const senderName = isPopulated ? s.name : '';

  const displayContent = this.is_deleted_for_everyone
    ? 'This message was deleted'
    : this.content;

  return {
    // Primary keys used by the frontend Chats.jsx
    messageId:            this._id.toString(),
    chatId:               this.conversation.toString(),
    senderId,
    senderName,
    text:                 displayContent,
    media_url:            this.media_url,
    status:               this.status,
    forwarded:            this.forwarded,
    isDeletedForEveryone: this.is_deleted_for_everyone,
    deletedFor:           (this.deleted_for || []).map((u) =>
      typeof u === 'object' && u._id ? u._id.toString() : u.toString()
    ),
    timestamp: this.created_at.toISOString(),

    // Backward compatibility fields
    id:           this._id.toString(),
    conversation: this.conversation.toString(),
    sender_id:    senderId,
    sender_name:  senderName,
    content:      displayContent,
    is_deleted:   this.is_deleted_for_everyone,
    created_at:   this.created_at.toISOString(),
  };
};

const Message = mongoose.model('Message', messageSchema, 'messages');
export default Message;
