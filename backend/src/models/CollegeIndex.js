import mongoose from 'mongoose';

const collegeIndexSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, maxlength: 200, index: true },
    domain:   { type: String, required: true, maxlength: 100 },
    location: { type: String, maxlength: 200, default: 'India' },
    logo_url: { type: String, maxlength: 300, default: '' },
  },
  { strict: false }
);

collegeIndexSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    domain: this.domain,
    location: this.location,
    logo_url: this.logo_url || '',
  };
};

const CollegeIndex = mongoose.model('CollegeIndex', collegeIndexSchema, 'college_indexes');
export default CollegeIndex;
