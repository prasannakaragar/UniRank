import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true },
  status:      { type: String, maxlength: 20, default: 'open' },
  reported_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  created_at:  { type: Date, default: Date.now },
  resolved_at: { type: Date },
});

issueSchema.index({ created_at: -1 });
issueSchema.index({ status: 1 });

issueSchema.methods.toDict = function () {
  const reporter = this.populated('reported_by') ? this.reported_by : null;
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    status: this.status,
    reported_by: reporter ? reporter.name : 'Unknown',
    created_at: this.created_at.toISOString(),
    resolved_at: this.resolved_at ? this.resolved_at.toISOString() : null,
  };
};

const Issue = mongoose.model('Issue', issueSchema, 'issues');
export default Issue;
