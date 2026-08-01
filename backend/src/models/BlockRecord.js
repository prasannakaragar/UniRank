import mongoose from 'mongoose';

const blockRecordSchema = new mongoose.Schema({
  blocker:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blocked:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
});

const BlockRecord = mongoose.model('BlockRecord', blockRecordSchema, 'chat_blocks');
export default BlockRecord;
