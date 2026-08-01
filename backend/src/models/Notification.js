import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title:      { type: String, required: true, maxlength: 100 },
    message:    { type: String, required: true },
    type:       { type: String, maxlength: 50, default: 'system' },
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonSubmission' },
    read_by:    { type: [String], default: [] },
    link:       { type: String },
    is_read:    { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { strict: false }
);

notificationSchema.index({ created_at: -1 });
notificationSchema.index({ recipient: 1 });

notificationSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    title: this.title,
    message: this.message,
    type: this.type,
    request_id: this.request_id ? this.request_id.toString() : null,
    read_by: this.read_by || [],
    link: this.link,
    is_read: this.is_read,
    created_at: this.created_at.toISOString(),
  };
};

const Notification = mongoose.model(
  'Notification',
  notificationSchema,
  'notifications'
);
export default Notification;
