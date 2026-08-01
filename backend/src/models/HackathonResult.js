import mongoose from 'mongoose';

const hackathonResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hackathon_name: { type: String, required: true, maxlength: 200 },
  position:       { type: Number, default: 0 },
  points:         { type: Number, default: 0 },
  date:           { type: Date, default: Date.now },
});

hackathonResultSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    hackathon_name: this.hackathon_name,
    position: this.position,
    points: this.points,
    date: this.date.toISOString(),
  };
};

const HackathonResult = mongoose.model(
  'HackathonResult',
  hackathonResultSchema,
  'hackathon_results'
);
export default HackathonResult;
