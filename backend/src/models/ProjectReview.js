import mongoose from 'mongoose';

const projectReviewSchema = new mongoose.Schema({
  name:                  { type: String, required: true, maxlength: 200 },
  description:           { type: String, required: true },
  implementation_score:  { type: Number, default: 0.0 },
  implementation_reason: { type: String, default: '' },
  impact_score:          { type: Number, default: 0.0 },
  impact_reason:         { type: String, default: '' },
  working_score:         { type: Number, default: 0.0 },
  working_reason:        { type: String, default: '' },
  total_score:           { type: Number, default: 0.0 },
  created_at:            { type: Date, default: Date.now },
});

projectReviewSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    scores: {
      implementation: this.implementation_score,
      impact: this.impact_score,
      working: this.working_score,
      total: this.total_score,
    },
    reasons: {
      implementation: this.implementation_reason,
      impact: this.impact_reason,
      working: this.working_reason,
    },
    created_at: this.created_at.toISOString(),
  };
};

const ProjectReview = mongoose.model(
  'ProjectReview',
  projectReviewSchema,
  'project_reviews'
);
export default ProjectReview;
