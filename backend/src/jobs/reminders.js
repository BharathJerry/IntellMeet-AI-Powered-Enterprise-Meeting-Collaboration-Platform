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

  for (const m of due) {
    // atomic claim, so two server instances never send the same reminder twice
    const claimed = await Meeting.findOneAndUpdate({ _id: m._id, ...notYetReminded }, [{ $set: { reminderSentFor: "$scheduledAt" } }]);
    if (!claimed) continue;
    [m.host, ...m.participants].forEach((id) =>
      notifyUser(id.toString(), "meeting:reminder", { meetingId: m.id, title: m.title, scheduledAt: m.scheduledAt })
    );
  }
}

export function startReminders() {
  const timer = setInterval(() => sendDueReminders().catch((e) => console.error("Reminder job failed:", e.message)), 60 * 1000);
  timer.unref(); // never keeps the process alive on its own
  return timer;
}
