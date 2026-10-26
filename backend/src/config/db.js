import mongoose from "mongoose";

export async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("MongoDB connected");
}