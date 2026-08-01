import mongoose from 'mongoose';

const internshipSchema = new mongoose.Schema(
  {
    project_title:       { type: String, required: true, maxlength: 200 },
    professor_name:      { type: String, required: true, maxlength: 100 },
    professor_image:     { type: String, default: '' },
    college_name:        { type: String, required: true, maxlength: 200 },
    college_domain:      { type: String, required: true, maxlength: 100 },
    duration:            { type: String, maxlength: 50, default: '3 Months' },
    mode:                { type: String, maxlength: 20, default: 'remote' },
    stipend:             { type: String, maxlength: 100, default: 'Unpaid' },
    stipend_amount:      { type: Number, default: 0 },
    description:         { type: String, required: true },
    skills_required:     { type: [String], default: [] },
    deadline:            { type: String, maxlength: 50 },
    application_process: { type: String, default: '' },
    professor_email:     { type: String, maxlength: 150, default: '' },
    opportunity_score:   { type: Number, default: 0 },
    created_at:          { type: Date, default: Date.now },
  },
  { strict: false }
);

internshipSchema.index({ college_name: 1 });
internshipSchema.index({ opportunity_score: 1 });
internshipSchema.index({ created_at: 1 });

internshipSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    project_title: this.project_title,
    professor_name: this.professor_name,
    professor_image: this.professor_image,
    college_name: this.college_name,
    college_domain: this.college_domain,
    duration: this.duration,
    mode: this.mode,
    stipend: this.stipend,
    stipend_amount: this.stipend_amount,
    description: this.description,
    skills_required: this.skills_required,
    deadline: this.deadline,
    application_process: this.application_process,
    professor_email: this.professor_email,
    opportunity_score: this.opportunity_score,
    created_at: this.created_at.toISOString(),
  };
};

const Internship = mongoose.model('Internship', internshipSchema, 'internships');
export default Internship;
