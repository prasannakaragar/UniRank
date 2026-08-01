import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, maxlength: 100 },
    email:      { type: String, required: true, unique: true, maxlength: 150 },
    password:   { type: String, required: true, maxlength: 256 },
    branch:         { type: String, required: true, maxlength: 100 },
    admission_year: { type: Number, required: true },
    college:        { type: String, maxlength: 200 },
    otp_hash:   { type: String, required: true },
    otp_expiry: { type: Date, required: true },
    attempts:   { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
  },
  { strict: false }
);

// TTL index — documents expire automatically when otp_expiry is reached
pendingUserSchema.index({ otp_expiry: 1 }, { expireAfterSeconds: 0 });

const PendingUser = mongoose.model('PendingUser', pendingUserSchema, 'pending_users');
export default PendingUser;
