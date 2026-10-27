import crypto from "crypto";
import { z } from "zod";
import Meeting from "../models/Meeting.js";
import Workspace from "../models/Workspace.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { invalidateMeeting } from "../utils/cache.js";
import { notifyUser } from "../socket/index.js";

export const workspaceInviteSchema = z.object({ workspaceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") });

const isMember = (m, uid) => m.host.equals(uid) || m.participants.some((p) => p.equals(uid));

async function getAsMember(id, user) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new AppError("Meeting not found", 404);
  if (!isMember(meeting, user._id)) throw new AppError("Forbidden", 403);
  return meeting;
}

// Returns the meeting's invite code, creating it the first time. Anyone with the link can join.
export const getInviteCode = asyncHandler(async (req, res) => {
  const meeting = await getAsMember(req.params.id, req.user);
  if (!meeting.inviteCode) {
    meeting.inviteCode = crypto.randomBytes(6).toString("base64url");
    await meeting.save();
    await invalidateMeeting(meeting.id);
  }
  res.json({ success: true, code: meeting.inviteCode });
});

export const previewInvite = asyncHandler(async (req, res) => {
  const m = await Meeting.findOne({ inviteCode: req.params.code, status: { $ne: "ended" } }).populate("host", "name");
  if (!m) throw new AppError("This invite link is no longer valid", 404);
  res.json({ success: true, meeting: { title: m.title, scheduledAt: m.scheduledAt, status: m.status, host: m.host.name } });
});

export const joinByInvite = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOneAndUpdate(
    { inviteCode: req.params.code, status: { $ne: "ended" } },
    { $addToSet: { participants: req.user._id } },
    { new: true }
  );
  if (!meeting) throw new AppError("This invite link is no longer valid", 404);
  await invalidateMeeting(meeting.id);
  res.json({ success: true, meetingId: meeting.id });
});

// Adds everyone in one of YOUR workspaces to the meeting and notifies them
export const inviteWorkspace = asyncHandler(async (req, res) => {
  const meeting = await getAsMember(req.params.id, req.user);
  const ws = await Workspace.findById(req.body.workspaceId);
  if (!ws || !ws.members.some((m) => m.user.equals(req.user._id))) throw new AppError("Workspace not found", 404);

  const fresh = ws.members.map((m) => m.user).filter((id) => !isMember(meeting, id));
  meeting.participants.push(...fresh);
  await meeting.save();
  await invalidateMeeting(meeting.id);
  fresh.forEach((id) =>
    notifyUser(id.toString(), "meeting:invited", { meetingId: meeting.id, title: meeting.title, scheduledAt: meeting.scheduledAt, by: req.user.name })
  );
  res.json({ success: true, added: fresh.length });
});
