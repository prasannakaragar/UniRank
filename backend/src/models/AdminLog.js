import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action:         { type: String, required: true, maxlength: 100 },
  target_user_id: { type: String, maxlength: 100 },
  details:        { type: String },
  timestamp:      { type: Date, default: Date.now },
});

adminLogSchema.index({ timestamp: -1 });

adminLogSchema.methods.toDict = function () {
  const admin = this.populated('admin_id') ? this.admin_id : null;
  return {
    id: this._id.toString(),
    admin: admin ? admin.name : 'Unknown',
    action: this.action,
    target_user_id: this.target_user_id,
    details: this.details,
    timestamp: this.timestamp.toISOString(),
  };
};

const AdminLog = mongoose.model('AdminLog', adminLogSchema, 'admin_logs');
export default AdminLog;
