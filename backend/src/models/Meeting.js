import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema({
  task: { type: String, required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: Date,
  converted: { type: Boolean, default: false },
});

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    scheduledAt: Date,
    status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled" },
    transcript: { type: String, default: "" },
    summary: { type: String, default: "" },
    aiStatus: { type: String, enum: ["none", "pending", "done", "failed"], default: "none" },
    inviteCode: { type: String, unique: true, sparse: true },
    reminderSentFor: Date,
    actionItems: [actionItemSchema],
  },
  { timestamps: true }
);

meetingSchema.index({ title: "text" });

export default mongoose.model("Meeting", meetingSchema);
