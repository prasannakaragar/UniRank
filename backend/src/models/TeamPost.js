import mongoose from 'mongoose';

const teamPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  post_type:     { type: String, required: true, maxlength: 30 },
  title:         { type: String, required: true, maxlength: 200 },
  description:   { type: String },
  skills_needed: { type: String, maxlength: 300 },
  contact_info:  { type: String, maxlength: 200 },
  team_size:     { type: Number },
  is_active:     { type: Boolean, default: true },
  created_at:    { type: Date, default: Date.now },
});

teamPostSchema.methods.toDict = function () {
  const authorObj = this.populated('author') ? this.author : null;
  return {
    id: this._id.toString(),
    author: authorObj ? authorObj.name : 'Unknown',
    author_branch: authorObj ? authorObj.branch : '',
    author_year: authorObj ? authorObj.year : 0,
    post_type: this.post_type,
    title: this.title,
    description: this.description,
    skills_needed: this.skills_needed
      ? this.skills_needed.split(',').map((s) => s.trim())
      : [],
    contact_info: this.contact_info,
    team_size: this.team_size,
    is_active: this.is_active,
    created_at: this.created_at.toISOString(),
  };
};

const TeamPost = mongoose.model('TeamPost', teamPostSchema, 'team_posts');
export default TeamPost;
