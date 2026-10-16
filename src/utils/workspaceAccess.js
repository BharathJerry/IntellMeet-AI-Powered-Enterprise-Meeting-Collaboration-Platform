import Workspace from "../models/Workspace.js";
import { AppError } from "./AppError.js";
import { notifyUser } from "../socket/index.js";

// Loads a workspace and the caller's role in it. 404 if missing, 403 if not a member.
export async function loadWorkspace(id, user) {
  const workspace = await Workspace.findById(id);
  if (!workspace) throw new AppError("Workspace not found", 404);
  const member = workspace.members.find((m) => m.user.equals(user._id));
  if (!member) throw new AppError("Forbidden", 403);
  return { workspace, role: member.role };
}

export function requireAdmin(role) {
  if (role !== "admin") throw new AppError("Only workspace admins can do this", 403);
}

export function assertMember(workspace, userId) {
  if (!workspace.members.some((m) => m.user.equals(userId)))
    throw new AppError("Assignee must be a workspace member", 400);
}

// Real-time: tells every other member's open sessions that a board changed
export function broadcastBoard(workspace, actorId, payload) {
  workspace.members.forEach((m) => {
    if (!m.user.equals(actorId)) notifyUser(m.user.toString(), "board:update", payload);
  });
}
