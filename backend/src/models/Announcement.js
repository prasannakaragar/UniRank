import mongoose from 'mongoose';

const stageSchema = new mongoose.Schema(
  { title: String, date_range: String, description: String },
  { _id: false }
);

const faqSchema = new mongoose.Schema(
  { question: String, answer: String },
  { _id: false }
);

const announcementSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title:       { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true },
  link:        { type: String, maxlength: 300 },
  event_date:  { type: String, maxlength: 50 },
  category:    { type: String, maxlength: 50, default: 'general' },
  organization:        { type: String, maxlength: 200, default: '' },
  participation_type:  { type: String, maxlength: 100, default: 'Individual Participation' },
  mode:                { type: String, maxlength: 50, default: 'Online' },
  tags:                { type: String, maxlength: 300, default: '' },
  deadline:            { type: String, maxlength: 50 },
  banner_url:          { type: String, maxlength: 500 },
  background_banner_url: { type: String, maxlength: 500 },
  team_size:           { type: String, maxlength: 50, default: 'Individual' },
  perks:               { type: String, maxlength: 300, default: '' },
  is_pinned:           { type: Boolean, default: false },
  created_at:          { type: Date, default: Date.now },
  expires_at:          { type: Date },

  // ── New fields (Unstop-equivalent) ─────────────────────────────────
  registration_start_date: { type: String, maxlength: 50 },
  prize_pool:              { type: String, maxlength: 200, default: '' },
  eligibility:             { type: String, maxlength: 200, default: '' },
  stages:                  [stageSchema],
  faqs:                    [faqSchema],
  registered_count:        { type: Number, default: 0 },
  registrations:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

// TTL index — auto-delete when expires_at is reached
announcementSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

announcementSchema.methods.toDict = function () {
  const authorObj = this.populated('author') ? this.author : null;
  return {
    id: this._id.toString(),
    author: authorObj ? authorObj.name : 'Unknown',
    author_id: authorObj ? authorObj._id.toString() : this.author.toString(),
    title: this.title,
    description: this.description,
    link: this.link,
    event_date: this.event_date,
    category: this.category,
    organization: this.organization,
    participation_type: this.participation_type,
    mode: this.mode,
    tags: this.tags
      ? this.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
    deadline: this.deadline,
    banner_url: this.banner_url,
    background_banner_url: this.background_banner_url,
    team_size: this.team_size,
    perks: this.perks,
    is_pinned: this.is_pinned,
    created_at: this.created_at.toISOString(),

    // New fields
    registration_start_date: this.registration_start_date || null,
    prize_pool: this.prize_pool || '',
    eligibility: this.eligibility || '',
    stages: Array.isArray(this.stages)
      ? this.stages.map((s) => ({
          title: s.title || '',
          date_range: s.date_range || '',
          description: s.description || '',
        }))
      : [],
    faqs: Array.isArray(this.faqs)
      ? this.faqs.map((f) => ({ question: f.question || '', answer: f.answer || '' }))
      : [],
    registered_count: this.registered_count || 0,
  };
};

const Announcement = mongoose.model(
  'Announcement',
  announcementSchema,
  'announcements'
);
export default Announcement;
