import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1 || isConnected) {
    return;
  }

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/unirank';
  try {
    const db = await mongoose.connect(uri);
    isConnected = db.connections[0].readyState >= 1;
    console.log(`INFO: MongoDB connected — ${mongoose.connection.host}`);
  } catch (err) {
    console.error('ERROR: MongoDB connection failed:', err.message);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw err;
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('WARNING: MongoDB disconnected');
});

export default connectDB;
