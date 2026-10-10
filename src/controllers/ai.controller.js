import { z } from "zod";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { generateInsights } from "../services/ai.service.js";
import { notifyUser } from "../socket/index.js";

export const transcriptSchema = z.object({ text: z.string().trim().min(1).max(20000) });

const MAX_TRANSCRIPT = 200000;

async function getAccessible(id, user) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new AppError("Meeting not found", 404);
  const ok = meeting.host.equals(user._id) || meeting.participants.some((p) => p.equals(user._id));
  if (!ok) throw new AppError("Forbidden", 403);
  return meeting;
}

function matchAssignee(name, members) {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  const found =
    members.find((u) => u.name.toLowerCase() === n) ||
    members.find((u) => u.name.toLowerCase().split(" ")[0] === n.split(" ")[0]);
  return found?._id;
}

// Background job: runs after the HTTP response has been sent
async function runSummaryJob(meetingId) {
  const meeting = await Meeting.findById(meetingId);
  const memberIds = [meeting.host, ...meeting.participants];
  try {
    const members = await User.find({ _id: { $in: memberIds } });
    const result = await generateInsights(meeting.transcript);

    const fresh = result.actionItems.map((a) => {
      const due = a.dueDate ? new Date(a.dueDate) : null;
      return {
        task: a.task,
        assignee: matchAssignee(a.assignee, members),
        dueDate: due && !isNaN(due) ? due : undefined,
      };
    });

    meeting.summary = result.summary;
    // keep items already turned into tasks so "convert" never creates duplicates
    meeting.actionItems = [...meeting.actionItems.filter((a) => a.converted), ...fresh];
    meeting.aiStatus = "done";
  } catch (err) {
    console.error("AI job failed:", err.message);
    meeting.aiStatus = "failed";
  }
  await meeting.save();
  memberIds.forEach((id) =>
    notifyUser(id.toString(), "summary:ready", { meetingId, status: meeting.aiStatus })
  );
}

export const addTranscript = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  const line = `${req.user.name}: ${req.body.text}`;
  const next = meeting.transcript ? `${meeting.transcript}\n${line}` : line;
  if (next.length > MAX_TRANSCRIPT) throw new AppError("Transcript too long", 413);
  meeting.transcript = next;
  await meeting.save();
  res.status(201).json({ success: true, length: next.length });
});

export const summarize = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  if (!meeting.host.equals(req.user._id)) throw new AppError("Only the host can summarize", 403);
  if (!meeting.transcript.trim()) throw new AppError("No transcript yet", 400);
  if (meeting.aiStatus === "pending") throw new AppError("Already processing", 409);

  meeting.aiStatus = "pending";
  await meeting.save();
  res.status(202).json({ success: true, aiStatus: "pending" });

  runSummaryJob(meeting.id).catch((e) => console.error("AI job crashed:", e));
});

export const getSummary = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  res.json({
    success: true,
    aiStatus: meeting.aiStatus,
    summary: meeting.summary,
    actionItems: meeting.actionItems,
  });
});
