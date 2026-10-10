import { z } from "zod";
import Task from "../models/Task.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createTaskSchema = z.object({
  title: z.string().min(2),
  meeting: objectId.optional(),
  assignee: objectId.optional(),
  dueDate: z.coerce.date().optional(),
});
export const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  assignee: objectId.optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.coerce.date().optional(),
});

export const createTask = asyncHandler(async (req, res) => {
  const task = await Task.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, task });
});

export const listTasks = asyncHandler(async (req, res) => {
  const filter = { $or: [{ createdBy: req.user._id }, { assignee: req.user._id }] };
  if (req.query.status) filter.status = req.query.status;
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, tasks });
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError("Task not found", 404);
  const allowed = task.createdBy.equals(req.user._id) || task.assignee?.equals(req.user._id);
  if (!allowed) throw new AppError("Forbidden", 403);
  Object.assign(task, req.body);
  await task.save();
  res.json({ success: true, task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError("Task not found", 404);
  if (!task.createdBy.equals(req.user._id)) throw new AppError("Forbidden", 403);
  await task.deleteOne();
  res.status(204).end();
});
