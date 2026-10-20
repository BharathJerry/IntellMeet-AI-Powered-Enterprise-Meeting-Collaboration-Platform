import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    position: { type: Number, default: 0 }, // order inside a Kanban column (lower = higher up)
    dueDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
