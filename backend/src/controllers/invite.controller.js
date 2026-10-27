import crypto from "crypto";
import { z } from "zod";
import Meeting from "../models/Meeting.js";
import Workspace from "../models/Workspace.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { invalidateMeeting } from "../utils/cache.js";
import { notifyUser } from "../socket/index.js";

export const workspaceInviteSchema = z.object({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

const isMember = (meeting, userId) =>
  meeting.host.equals(userId) || meeting.participants.some((participant) => participant.equals(userId));

async function getMeetingForMember(id, user) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new AppError("Meeting not found", 404);
  if (!isMember(meeting, user._id)) throw new AppError("Forbidden", 403);
  return meeting;
}

export const getInviteCode = asyncHandler(async (req, res) => {
  const meeting = await getMeetingForMember(req.params.id, req.user);
  if (!meeting.inviteCode) {
    meeting.inviteCode = crypto.randomBytes(16).toString("base64url");
    await meeting.save();
    await invalidateMeeting(meeting.id);
  }
  res.json({ success: true, code: meeting.inviteCode });
});

export const previewInvite = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({
    inviteCode: req.params.code,
    status: { $ne: "ended" },
  }).populate("host", "name");
  if (!meeting) throw new AppError("This invite link is no longer valid", 404);
  res.json({
    success: true,
    meeting: {
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      status: meeting.status,
      host: meeting.host.name,
    },
  });
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

export const inviteWorkspace = asyncHandler(async (req, res) => {
  const meeting = await getMeetingForMember(req.params.id, req.user);
  const workspace = await Workspace.findById(req.body.workspaceId);
  if (!workspace || !workspace.members.some((member) => member.user.equals(req.user._id))) {
    throw new AppError("Workspace not found", 404);
  }

  const invitees = workspace.members
    .map((member) => member.user)
    .filter((userId) => !isMember(meeting, userId));

  meeting.participants.push(...invitees);
  await meeting.save();
  await invalidateMeeting(meeting.id);

  invitees.forEach((userId) =>
    notifyUser(userId.toString(), "meeting:invited", {
      meetingId: meeting.id,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      by: req.user.name,
    })
  );
  res.json({ success: true, added: invitees.length });
});
