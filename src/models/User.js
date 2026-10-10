import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    avatar: String,
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
