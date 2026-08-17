import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // Codeforces
    cf_handle:                { type: String, maxlength: 100 },
    cf_rating:                { type: Number, default: 0 },
    cf_max_rating:            { type: Number, default: 0 },
    cf_rank:                  { type: String, maxlength: 50, default: 'unrated' },
    cf_problems_solved:       { type: Number, default: 0 },
    cf_contests:              { type: Number, default: 0 },
    actual_codeforces_rating: { type: Number, default: 0 },
    admin_codeforces_rating:  { type: Number, default: null },

    // LeetCode
    lc_username:            { type: String, maxlength: 100 },
    lc_rating:              { type: Number, default: 0 },
    lc_max_rating:          { type: Number, default: 0 },
    lc_rank:                { type: Number, default: 0 },
    lc_problems_solved:     { type: Number, default: 0 },
    actual_leetcode_rating: { type: Number, default: 0 },
    admin_leetcode_rating:  { type: Number, default: null },

    // CodeChef
    cc_username:            { type: String, maxlength: 100 },
    codechef_username:      { type: String, maxlength: 100 },
    cc_rating:              { type: Number, default: 0 },
    cc_max_rating:          { type: Number, default: 0 },
    cc_stars:               { type: String, maxlength: 20, default: '1★' },
    cc_problems_solved:     { type: Number, default: 0 },
    cc_contests:            { type: Number, default: 0 },
    actual_codechef_rating: { type: Number, default: 0 },
    admin_codechef_rating:  { type: Number, default: null },

    // HackerRank
    hr_username:              { type: String, maxlength: 100 },
    hackerrank_username:      { type: String, maxlength: 100 },
    hr_badges:                { type: Number, default: 0 },
    hr_score:                 { type: Number, default: 0 },
    hr_rating:                { type: Number, default: 0 },
    hr_problems_solved:       { type: Number, default: 0 },
    actual_hackerrank_rating: { type: Number, default: 0 },
    admin_hackerrank_rating:  { type: Number, default: null },

    // HackerEarth
    he_username:              { type: String, maxlength: 100 },
    hackerearth_username:      { type: String, maxlength: 100 },
    he_rating:                { type: Number, default: 0 },
    he_problems_solved:       { type: Number, default: 0 },
    he_contests:              { type: Number, default: 0 },
    actual_hackerearth_rating: { type: Number, default: 0 },
    admin_hackerearth_rating:  { type: Number, default: null },

    // Legacy / Backward Compatibility Override Fields
    override_cf_score:     { type: Number, default: null },
    override_lc_score:     { type: Number, default: null },
    override_cc_score:     { type: Number, default: null },
    override_hr_score:     { type: Number, default: null },
    override_he_score:     { type: Number, default: null },
    override_cp_score:     { type: Number, default: null },
    override_github_score: { type: Number, default: null },

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

    // Cached scores for leaderboards (cp_score stores exact Leaderboard Points)
    cp_score:        { type: Number, default: 0.0 },
    hackathon_score: { type: Number, default: 0 },
    activity_score:  { type: Number, default: 0 },
    global_score:    { type: Number, default: 0.0 },
  },
  { strict: false }
);

profileSchema.index({ global_score: -1 });
profileSchema.index({ cp_score: -1 });

profileSchema.methods.toDict = function () {
  const u = this.user;
  if (!u || !u._id) {
    throw new Error('Profile.toDict() requires user to be populated');
  }

  // Determine actual, admin override, and final ratings
  const actualCF = this.actual_codeforces_rating || this.cf_rating || 0;
  const adminCF = this.admin_codeforces_rating ?? this.override_cf_score;
  const finalCF = adminCF !== null && adminCF !== undefined ? adminCF : actualCF;

  const actualLC = this.actual_leetcode_rating || this.lc_rating || 0;
  const adminLC = this.admin_leetcode_rating ?? this.override_lc_score;
  const finalLC = adminLC !== null && adminLC !== undefined ? adminLC : actualLC;

  const actualCC = this.actual_codechef_rating || this.cc_rating || 0;
  const adminCC = this.admin_codechef_rating ?? this.override_cc_score;
  const finalCC = adminCC !== null && adminCC !== undefined ? adminCC : actualCC;

  const actualHR = this.actual_hackerrank_rating || this.hr_rating || this.hr_score || 0;
  const adminHR = this.admin_hackerrank_rating ?? this.override_hr_score;
  const finalHR = adminHR !== null && adminHR !== undefined ? adminHR : actualHR;

  const actualHE = this.actual_hackerearth_rating || this.he_rating || 0;
  const adminHE = this.admin_hackerearth_rating ?? this.override_he_score;
  const finalHE = adminHE !== null && adminHE !== undefined ? adminHE : actualHE;

  const leaderboardPoints = (finalCF / 2.0) + (finalLC / 2.0) + (finalCC / 2.0) + (finalHR / 3.0) + (finalHE / 3.0);
  const roundedLeaderboardPoints = Math.round(leaderboardPoints * 100) / 100;

  return {
    user_id: u._id.toString(),
    // Handles
    cf_handle: this.cf_handle || '',
    lc_username: this.lc_username || '',
    cc_username: this.cc_username || this.codechef_username || '',
    codechef_username: this.codechef_username || this.cc_username || '',
    hr_username: this.hr_username || this.hackerrank_username || '',
    hackerrank_username: this.hackerrank_username || this.hr_username || '',
    he_username: this.he_username || this.hackerearth_username || '',
    hackerearth_username: this.hackerearth_username || this.he_username || '',

    // Codeforces Ratings
    actual_codeforces_rating: actualCF,
    admin_codeforces_rating: adminCF,
    final_codeforces_rating: finalCF,
    cf_rating: finalCF,
    cf_max_rating: this.cf_max_rating || 0,
    cf_rank: this.cf_rank || 'unrated',
    cf_problems_solved: this.cf_problems_solved || 0,
    cf_contests: this.cf_contests || 0,

    // LeetCode Ratings
    actual_leetcode_rating: actualLC,
    admin_leetcode_rating: adminLC,
    final_leetcode_rating: finalLC,
    lc_rating: finalLC,
    lc_max_rating: this.lc_max_rating || 0,
    lc_rank: this.lc_rank || 0,
    lc_problems_solved: this.lc_problems_solved || 0,

    // CodeChef Ratings
    actual_codechef_rating: actualCC,
    admin_codechef_rating: adminCC,
    final_codechef_rating: finalCC,
    cc_rating: finalCC,
    cc_max_rating: this.cc_max_rating || 0,
    cc_stars: this.cc_stars || '1★',
    cc_problems_solved: this.cc_problems_solved || 0,
    cc_contests: this.cc_contests || 0,

    // HackerRank Ratings
    actual_hackerrank_rating: actualHR,
    admin_hackerrank_rating: adminHR,
    final_hackerrank_rating: finalHR,
    hr_rating: finalHR,
    hr_badges: this.hr_badges || 0,
    hr_score: this.hr_score || 0,
    hr_problems_solved: this.hr_problems_solved || 0,

    // HackerEarth Ratings
    actual_hackerearth_rating: actualHE,
    admin_hackerearth_rating: adminHE,
    final_hackerearth_rating: finalHE,
    he_rating: finalHE,
    he_problems_solved: this.he_problems_solved || 0,
    he_contests: this.he_contests || 0,

    // Overrides Summary Object
    overrides: {
      admin_codeforces_rating: adminCF,
      admin_leetcode_rating: adminLC,
      admin_codechef_rating: adminCC,
      admin_hackerrank_rating: adminHR,
      admin_hackerearth_rating: adminHE,
    },

    // Points
    leaderboard_points: roundedLeaderboardPoints,
    cp_score: roundedLeaderboardPoints,
    hackathon_score: this.hackathon_score || 0,
    activity_score: this.activity_score || 0,
    global_score: this.global_score || 0,

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
    github_analysis: {
      implementation: u.github_implementation,
      impact: u.github_impact,
      working: u.github_working,
      total: u.github_score,
      reason: this.github_review_reason,
    },
    github_score: u.github_score,
  };
};

const Profile = mongoose.model('Profile', profileSchema, 'profiles');
export default Profile;
