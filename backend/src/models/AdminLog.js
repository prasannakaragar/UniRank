import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  student_id:     { type: String, maxlength: 100 },
  target_user_id: { type: String, maxlength: 100 },
  platform:       { type: String, maxlength: 50 }, // 'Codeforces', 'LeetCode', 'CodeChef', 'HackerRank', 'HackerEarth'
  action:         { type: String, required: true, maxlength: 100 }, // 'RATING_OVERRIDE', 'CLEAR_OVERRIDE', etc.
  previous_value: { type: Number, default: null },
  new_value:      { type: Number, default: null },
  reason:         { type: String, default: '' },
  details:        { type: String },
  timestamp:      { type: Date, default: Date.now },
});

adminLogSchema.index({ timestamp: -1 });
adminLogSchema.index({ student_id: 1, timestamp: -1 });
adminLogSchema.index({ target_user_id: 1, timestamp: -1 });

adminLogSchema.methods.toDict = function () {
  const admin = this.populated('admin_id') ? this.admin_id : null;
  const sId = this.student_id || this.target_user_id || '';
  return {
    id: this._id.toString(),
    admin_id: admin ? admin._id.toString() : (this.admin_id ? this.admin_id.toString() : ''),
    admin: admin ? admin.name : 'Admin',
    student_id: sId,
    target_user_id: sId,
    platform: this.platform || '',
    action: this.action,
    previous_value: this.previous_value,
    new_value: this.new_value,
    reason: this.reason || '',
    details: this.details || '',
    timestamp: this.timestamp.toISOString(),
  };
};

const AdminLog = mongoose.model('AdminLog', adminLogSchema, 'admin_logs');
export default AdminLog;
