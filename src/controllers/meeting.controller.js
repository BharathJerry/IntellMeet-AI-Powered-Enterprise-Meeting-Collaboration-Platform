import { z } from "zod";
import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

export const createMeetingSchema = z.object({
  title: z.string().min(2),
  scheduledAt: z.coerce.date().optional(),
});
export const updateMeetingSchema = z.object({
  title: z.string().min(2).optional(),
  scheduledAt: z.coerce.date().optional(),
  status: z.enum(["scheduled", "live", "ended"]).optional(),
});

const isMember = (m, uid) =>
  m.host.equals(uid) || m.participants.some((p) => p.equals(uid));

async function getAccessible(id, user) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new AppError("Meeting not found", 404);
  if (!isMember(meeting, user._id)) throw new AppError("Forbidden", 403);
  return meeting;
}

export const createMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.create({ ...req.body, host: req.user._id });
  res.status(201).json({ success: true, meeting });
});

export const listMeetings = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const filter = { $or: [{ host: req.user._id }, { participants: req.user._id }] };
  if (req.query.q) filter.$text = { $search: String(req.query.q) };
  if (req.query.status) filter.status = req.query.status;

  const [meetings, total] = await Promise.all([
    Meeting.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Meeting.countDocuments(filter),
  ]);
  res.json({ success: true, page, total, meetings });
});

export const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  res.json({ success: true, meeting });
});

export const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  if (!meeting.host.equals(req.user._id)) throw new AppError("Only the host can edit", 403);
  Object.assign(meeting, req.body);
  await meeting.save();
  res.json({ success: true, meeting });
});

export const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  if (!meeting.host.equals(req.user._id)) throw new AppError("Only the host can delete", 403);
  await meeting.deleteOne();
  res.status(204).end();
});

export const joinMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { participants: req.user._id } },
    { new: true }
  );
  if (!meeting) throw new AppError("Meeting not found", 404);
  res.json({ success: true, meeting });
});

// Turns AI action items into tasks (one-time per item)
export const convertActionItems = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  const pending = meeting.actionItems.filter((a) => !a.converted);
  const tasks = await Task.insertMany(
    pending.map((a) => ({
      title: a.task,
      meeting: meeting._id,
      assignee: a.assignee,
      dueDate: a.dueDate,
      createdBy: req.user._id,
    }))
  );
  pending.forEach((a) => (a.converted = true));
  await meeting.save();
  res.status(201).json({ success: true, tasks });
});
