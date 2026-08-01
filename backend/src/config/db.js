import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/unirank';
  try {
    await mongoose.connect(uri);
    console.log(`INFO: MongoDB connected — ${mongoose.connection.host}`);
  } catch (err) {
    console.error('ERROR: MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('WARNING: MongoDB disconnected');
  });
};

export default connectDB;
