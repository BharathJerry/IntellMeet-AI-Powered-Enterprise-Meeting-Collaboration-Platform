import Meeting from "../models/Meeting.js";
import { notifyUser } from "../socket/index.js";
const WINDOW_MS = 10 * 60 * 1000; // remind 10 minutes before the start
// "reminder already sent for this start time" - changing the time re-arms the reminder
const notYetReminded = { $expr: { $ne: ["$reminderSentFor", "$scheduledAt"] } };

export async function sendDueReminders() {
  const now = new Date();
  const due = await Meeting.find({
    status: "scheduled",
    scheduledAt: { $gte: now, $lte: new Date(now.getTime() + WINDOW_MS) },
    ...notYetReminded,
  });

  for (const meeting of due) {
    const claimed = await Meeting.findOneAndUpdate(
      { _id: meeting._id, ...notYetReminded },
      [{ $set: { reminderSentFor: "$scheduledAt" } }]
    );
    if (!claimed) continue;
    [meeting.host, ...meeting.participants].forEach((id) =>
      notifyUser(id.toString(), "meeting:reminder", {
        meetingId: meeting.id,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt,
      })
    );
  }
}

export function startReminders() {
  const timer = setInterval(
    () => sendDueReminders().catch((error) => console.error("Reminder job failed:", error.message)),
    60 * 1000
  );
  timer.unref();
  return timer;
}
