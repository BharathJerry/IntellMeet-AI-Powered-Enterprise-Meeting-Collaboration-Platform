import { z } from "zod";
import Board from "../models/Board.js";
import Task from "../models/Task.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { loadWorkspace, requireAdmin, assertMember, broadcastBoard } from "../utils/workspaceAccess.js";
import { notifyUser } from "../socket/index.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const STATUSES = ["todo", "in_progress", "done"];

export const boardSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const createBoardTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  assignee: objectId.optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(STATUSES).optional(),
});
export const updateBoardTaskSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  assignee: objectId.nullable().optional(), // null clears the assignee
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(STATUSES).optional(),
  position: z.number().optional(),
});

async function loadBoard(id, user) {
  const board = await Board.findById(id);
  if (!board) throw new AppError("Board not found", 404);
  const { workspace, role } = await loadWorkspace(board.workspace, user);
  return { board, workspace, role };
}

// New tasks go to the bottom of their column
async function nextPosition(boardId, status) {
  const last = await Task.findOne({ board: boardId, status }).sort({ position: -1 });
  return (last?.position ?? 0) + 1000;
}

export const createBoard = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace(req.params.id, req.user);
  const board = await Board.create({ workspace: workspace._id, name: req.body.name, createdBy: req.user._id });
  broadcastBoard(workspace, req.user._id, { action: "board_created", workspaceId: workspace.id, boardId: board.id });
  res.status(201).json({ success: true, board });
});

export const listBoards = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace(req.params.id, req.user);
  const boards = await Board.find({ workspace: workspace._id }).sort({ createdAt: 1 });
  res.json({ success: true, boards });
});

// Returns the board with its tasks already grouped into Kanban columns
export const getBoard = asyncHandler(async (req, res) => {
  const { board } = await loadBoard(req.params.id, req.user);
  const tasks = await Task.find({ board: board._id })
    .populate("assignee", "name email")
    .sort({ position: 1, createdAt: 1 });
  const columns = { todo: [], in_progress: [], done: [] };
  tasks.forEach((t) => columns[t.status].push(t));
  res.json({ success: true, board, columns });
});

export const updateBoard = asyncHandler(async (req, res) => {
  const { board, workspace } = await loadBoard(req.params.id, req.user);
  board.name = req.body.name;
  await board.save();
  broadcastBoard(workspace, req.user._id, { action: "board_updated", boardId: board.id });
  res.json({ success: true, board });
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const { board, workspace, role } = await loadBoard(req.params.id, req.user);
  requireAdmin(role);
  await Task.deleteMany({ board: board._id });
  await board.deleteOne();
  broadcastBoard(workspace, req.user._id, { action: "board_deleted", boardId: board.id });
  res.status(204).end();
});

export const createBoardTask = asyncHandler(async (req, res) => {
  const { board, workspace } = await loadBoard(req.params.id, req.user);
  const { title, assignee, dueDate } = req.body;
  const status = req.body.status ?? "todo";
  if (assignee) assertMember(workspace, assignee);

  const task = await Task.create({
    title,
    assignee,
    dueDate,
    status,
    board: board._id,
    workspace: workspace._id,
    createdBy: req.user._id,
    position: await nextPosition(board._id, status),
  });

  if (assignee && assignee !== req.user.id)
    notifyUser(assignee, "task:assigned", { taskId: task.id, title, boardId: board.id });
  broadcastBoard(workspace, req.user._id, { action: "task_created", boardId: board.id, taskId: task.id });
  res.status(201).json({ success: true, task });
});

// One endpoint for edits AND drag-and-drop: send { status, position } to move a card
export const updateBoardTask = asyncHandler(async (req, res) => {
  const { board, workspace } = await loadBoard(req.params.id, req.user);
  const task = await Task.findOne({ _id: req.params.taskId, board: board._id });
  if (!task) throw new AppError("Task not found on this board", 404);

  const b = req.body;
  if (b.title !== undefined) task.title = b.title;
  if (b.dueDate !== undefined) task.dueDate = b.dueDate ?? undefined;

  let newAssignee;
  if ("assignee" in b) {
    if (b.assignee) {
      assertMember(workspace, b.assignee);
      if (!task.assignee?.equals(b.assignee)) newAssignee = b.assignee;
      task.assignee = b.assignee;
    } else {
      task.assignee = undefined;
    }
  }

  const statusChanged = b.status !== undefined && b.status !== task.status;
  if (b.status !== undefined) task.status = b.status;
  if (b.position !== undefined) task.position = b.position;
  else if (statusChanged) task.position = await nextPosition(board._id, task.status);

  await task.save();
  await task.populate("assignee", "name email");

  if (newAssignee && newAssignee !== req.user.id)
    notifyUser(newAssignee, "task:assigned", { taskId: task.id, title: task.title, boardId: board.id });
  broadcastBoard(workspace, req.user._id, { action: "task_updated", boardId: board.id, taskId: task.id });
  res.json({ success: true, task });
});

export const deleteBoardTask = asyncHandler(async (req, res) => {
  const { board, workspace } = await loadBoard(req.params.id, req.user);
  const task = await Task.findOne({ _id: req.params.taskId, board: board._id });
  if (!task) throw new AppError("Task not found on this board", 404);
  await task.deleteOne();
  broadcastBoard(workspace, req.user._id, { action: "task_deleted", boardId: board.id, taskId: task.id });
  res.status(204).end();
});
