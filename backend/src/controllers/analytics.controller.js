import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import { asyncHandler } from "../utils/AppError.js";

const DAYS = 14;

// [{ _id: "done", count: 3 }] -> { todo: 0, in_progress: 0, done: 3 }
const toMap = (rows, keys) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.forEach((r) => (out[r._id] = r.count));
  return out;
};

export const overview = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const mine = { $or: [{ host: uid }, { participants: uid }] };

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [meetingRows, dayRows, summaries, itemRows, taskRows] = await Promise.all([
    Meeting.aggregate([{ $match: mine }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Meeting.aggregate([
      { $match: { ...mine, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    Meeting.countDocuments({ ...mine, aiStatus: "done" }),
    Meeting.aggregate([
      { $match: mine },
      {
        $project: {
          total: { $size: "$actionItems" },
          converted: { $size: { $filter: { input: "$actionItems", cond: "$$this.converted" } } },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" }, converted: { $sum: "$converted" } } },
    ]),
    Task.aggregate([
      { $match: { $or: [{ createdBy: uid }, { assignee: uid }] } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const meetingStatus = toMap(meetingRows, ["scheduled", "live", "ended"]);
  const taskStatus = toMap(taskRows, ["todo", "in_progress", "done"]);
  const taskTotal = Object.values(taskStatus).reduce((a, b) => a + b, 0);

  // continuous series (zeros for quiet days) so charts have no gaps
  const byDay = Object.fromEntries(dayRows.map((r) => [r._id, r.count]));
  const perDay = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, count: byDay[date] ?? 0 };
  });

  res.json({
    success: true,
    meetings: {
      total: Object.values(meetingStatus).reduce((a, b) => a + b, 0),
      byStatus: meetingStatus,
      perDay,
    },
    tasks: {
      total: taskTotal,
      byStatus: taskStatus,
      completionRate: taskTotal ? Math.round((taskStatus.done / taskTotal) * 100) : 0,
    },
    ai: {
      summaries,
      actionItems: { total: itemRows[0]?.total ?? 0, converted: itemRows[0]?.converted ?? 0 },
    },
  });
});
