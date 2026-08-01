import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cf_handle:          { type: String, maxlength: 100 },
    lc_username:        { type: String, maxlength: 100 },
    cf_rating:          { type: Number, default: 0 },
    cf_max_rating:      { type: Number, default: 0 },
    cf_rank:            { type: String, maxlength: 50, default: 'unrated' },
    cf_problems_solved: { type: Number, default: 0 },
    cf_contests:        { type: Number, default: 0 },
    lc_rating:          { type: Number, default: 0 },
    lc_max_rating:      { type: Number, default: 0 },
    lc_rank:            { type: Number, default: 0 },
    lc_problems_solved: { type: Number, default: 0 },
    avatar_url:         { type: String, maxlength: 300 },
    bio:                { type: String, maxlength: 300 },
    skills:             { type: String, maxlength: 300 },
    github_url:         { type: String, maxlength: 200 },
    github_username:    { type: String, maxlength: 100, default: '' },
    github_rank:        { type: String, maxlength: 30, default: '' },
    linkedin_url:       { type: String, maxlength: 200 },
    last_synced:        { type: Date },

    // Social
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // GitHub Score Card scores
    github_impl_score:    { type: Number, default: 0.0 },
    github_imp_score:     { type: Number, default: 0.0 },
    github_work_score:    { type: Number, default: 0.0 },
    github_total_score:   { type: Number, default: 0.0 },
    github_review_reason: { type: String, default: '' },
    github_repos:         { type: Number, default: 0 },
    github_stars:         { type: Number, default: 0 },
    github_commits:       { type: Number, default: 0 },

    // Diff-based caching & Background scanning status
    github_repo_cache:  { type: mongoose.Schema.Types.Mixed, default: {} },
    github_scan_status: { type: String, enum: ['idle', 'pending', 'done', 'failed'], default: 'idle' },

    // Cached scores for leaderboards
    cp_score:        { type: Number, default: 0.0 },
    hackathon_score: { type: Number, default: 0 },
    activity_score:  { type: Number, default: 0 },
    global_score:    { type: Number, default: 0.0 },
  },
  { strict: false }
);

profileSchema.index({ global_score: -1 });
profileSchema.index({ cp_score: -1 });
profileSchema.index({ cf_rating: -1 });
profileSchema.index({ lc_rating: -1 });

/**
 * Build the API response dict.
 * Requires that `this.user` is populated (call `.populate('user')` first).
 */
profileSchema.methods.toDict = function () {
  const u = this.user; // must be populated
  if (!u || !u._id) {
    throw new Error('Profile.toDict() requires user to be populated');
  }

  return {
    user_id: u._id.toString(),
    cf_handle: this.cf_handle,
    lc_username: this.lc_username,
    cf_rating: this.cf_rating,
    cf_max_rating: this.cf_max_rating,
    cf_rank: this.cf_rank,
    cf_problems_solved: this.cf_problems_solved,
    cf_contests: this.cf_contests,
    lc_rating: this.lc_rating,
    lc_max_rating: this.lc_max_rating,
    lc_rank: this.lc_rank,
    lc_problems_solved: this.lc_problems_solved,
    avatar_url: this.avatar_url,
    bio: this.bio,
    skills: this.skills ? this.skills.split(',').map((s) => s.trim()) : [],
    github_url: this.github_url,
    github_username: this.github_username || '',
    github_rank: this.github_rank || '',
    github_repos: this.github_repos,
    github_stars: this.github_stars,
    github_commits: this.github_commits,
    linkedin_url: this.linkedin_url,
    followers_count: (this.followers || []).length,
    following_count: (this.following || []).length,
    last_synced: this.last_synced ? this.last_synced.toISOString() : null,
    hackathon_score: this.hackathon_score,
    activity_score: this.activity_score,
    global_score: this.global_score,
    // Legacy field kept for backward compat
    github_analysis: {
      implementation: u.github_implementation,
      impact: u.github_impact,
      working: u.github_working,
      total: u.github_score,
      reason: this.github_review_reason,
    },
    // Flat fields used by leaderboard and GitHubScoreCard
    github_score: u.github_score,
    // Primary names (match User model and frontend expectations)
    github_implementation: u.github_implementation,
    github_working: u.github_working,
    github_impact: u.github_impact,
    // Legacy names kept for backward compat
    github_impl_score: u.github_implementation,
    github_imp_score: u.github_impact,
    github_work_score: u.github_working,
  };
};

const Profile = mongoose.model('Profile', profileSchema, 'profiles');
export default Profile;
