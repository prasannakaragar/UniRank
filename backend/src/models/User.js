import mongoose from 'mongoose';
import { getCurrentYearOfStudy } from '../utils/academicYear.js';

const userSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, maxlength: 100 },
    email:          { type: String, required: true, unique: true, maxlength: 150 },
    password:       { type: String, required: true, maxlength: 256 },
    branch:         { type: String, required: true, maxlength: 100 },
    admission_year: { type: Number, required: true },
    college:        { type: String, maxlength: 200, default: 'Unknown' },
    role:           { type: String, maxlength: 20, default: 'student' },
    is_verified:      { type: Boolean, default: false },
    college_verified: { type: Boolean, default: false },
    otp_hash:         { type: String },
    otp_expiry:       { type: Date },
    attempts:         { type: Number, default: 0 },
    created_at:       { type: Date, default: Date.now },

    // Account-lockout fields
    failed_login_attempts: { type: Number, default: 0 },
    locked_until:          { type: Date },

    // Persistent GitHub scoring fields
    github_implementation: { type: Number, default: 0.0 },
    github_working:        { type: Number, default: 0.0 },
    github_impact:         { type: Number, default: 0.0 },
    github_score:          { type: Number, default: 0.0 },
    last_github_refresh:   { type: Date },
  },
  { strict: false }
);

userSchema.index({ branch: 1 });
userSchema.index({ admission_year: 1 });
userSchema.index({ role: 1 });
userSchema.index({ created_at: -1 });

userSchema.methods.toDict = async function () {
  let results = [];
  try {
    const HackathonResult = mongoose.models.HackathonResult || mongoose.model('HackathonResult');
    results = await HackathonResult.find({ user: this._id });
  } catch {
    results = [];
  }

  const academicInfo = getCurrentYearOfStudy(this.admission_year);

  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    branch: this.branch,
    admission_year: this.admission_year,
    year: academicInfo.yearOfStudy,
    year_display: academicInfo.displayString,
    is_alumni: academicInfo.isAlumni,
    college: this.college,
    role: this.role,
    is_verified: this.is_verified,
    college_verified: this.college_verified,
    hackathon_results: results.map((h) => h.toDict()),
    // Persistent GitHub fields
    github_implementation: this.github_implementation,
    github_working: this.github_working,
    github_impact: this.github_impact,
    github_score: this.github_score,
    last_github_refresh: this.last_github_refresh
      ? this.last_github_refresh.toISOString()
      : null,
    // Legacy mapping for frontend compatibility
    github_impl_score: this.github_implementation,
    github_work_score: this.github_working,
    github_imp_score: this.github_impact,
    github_total_score: this.github_score,
  };
};

const User = mongoose.model('User', userSchema, 'users');
export default User;
