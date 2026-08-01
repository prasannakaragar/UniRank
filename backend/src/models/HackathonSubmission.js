import mongoose from 'mongoose';

const hackathonSubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hackathon_name:  { type: String, required: true, maxlength: 200 },
    event_type:      { type: String, maxlength: 30, default: 'Attended' },
    certificate_url: { type: String, default: '' },
    points_to_award: { type: Number, default: 0 },
    status:          { type: String, maxlength: 20, default: 'pending' },
    reviewed_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewed_at:     { type: Date },
    created_at:      { type: Date, default: Date.now },

    // Legacy fields for backward compat
    position:   { type: Number, default: 0 },
    approvals:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rejections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { strict: false }
);

hackathonSubmissionSchema.methods.toDict = function () {
  const u = this.populated('user') ? this.user : null;
  return {
    id: this._id.toString(),
    user_id: u ? u._id.toString() : this.user.toString(),
    user_name: u ? u.name : '',
    user_college: u ? u.college : '',
    hackathon_name: this.hackathon_name,
    event_type: this.event_type || '',
    certificate_url: this.certificate_url || '',
    points_to_award: this.points_to_award || 0,
    status: this.status,
    reviewed_by: this.reviewed_by
      ? (this.populated('reviewed_by')
          ? this.reviewed_by._id.toString()
          : this.reviewed_by.toString())
      : null,
    reviewed_at: this.reviewed_at ? this.reviewed_at.toISOString() : null,
    created_at: this.created_at.toISOString(),
  };
};

const HackathonSubmission = mongoose.model(
  'HackathonSubmission',
  hackathonSubmissionSchema,
  'hackathon_submissions'
);
export default HackathonSubmission;
