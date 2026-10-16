import { z } from "zod";
import Workspace from "../models/Workspace.js";
import Board from "../models/Board.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { loadWorkspace, requireAdmin } from "../utils/workspaceAccess.js";
import { notifyUser } from "../socket/index.js";

export const workspaceSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.create({
    name: req.body.name,
    owner: req.user._id,
    members: [{ user: req.user._id, role: "admin" }],
  });
  res.status(201).json({ success: true, workspace });
});

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({ "members.user": req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, workspaces });
});

export const getWorkspace = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace(req.params.id, req.user);
  await workspace.populate("members.user", "name email");
  res.json({ success: true, workspace });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspace(req.params.id, req.user);
  requireAdmin(role);
  workspace.name = req.body.name;
  await workspace.save();
  res.json({ success: true, workspace });
});

// Only the owner can delete; removes its boards and their tasks too
export const deleteWorkspace = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace(req.params.id, req.user);
  if (!workspace.owner.equals(req.user._id)) throw new AppError("Only the owner can delete a workspace", 403);
  const boardIds = (await Board.find({ workspace: workspace._id }).select("_id")).map((b) => b._id);
  await Task.deleteMany({ board: { $in: boardIds } });
  await Board.deleteMany({ workspace: workspace._id });
  await workspace.deleteOne();
  res.status(204).end();
});

// Team invitation (simple version): admin adds an existing user by email
export const addMember = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspace(req.params.id, req.user);
  requireAdmin(role);

  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!user) throw new AppError("No user with that email. Ask them to sign up first", 404);
  if (workspace.members.some((m) => m.user.equals(user._id))) throw new AppError("Already a member", 409);

  workspace.members.push({ user: user._id, role: req.body.role });
  await workspace.save();
  notifyUser(user.id, "workspace:invited", { workspaceId: workspace.id, name: workspace.name });
  res.status(201).json({
    success: true,
    member: { userId: user.id, name: user.name, email: user.email, role: req.body.role },
  });
});

// Admins can remove anyone except the owner; any member can remove themselves
export const removeMember = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspace(req.params.id, req.user);
  const target = req.params.userId;
  if (req.user.id !== target) requireAdmin(role);
  if (workspace.owner.equals(target)) throw new AppError("The owner cannot be removed", 400);

  const before = workspace.members.length;
  workspace.members = workspace.members.filter((m) => !m.user.equals(target));
  if (workspace.members.length === before) throw new AppError("Member not found", 404);
  await workspace.save();
  res.status(204).end();
});
