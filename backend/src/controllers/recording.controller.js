import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

// Recordings live in MongoDB GridFS: no extra service or API key, so the demo runs anywhere
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "recordings" });

async function getAccessible(id, user) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new AppError("Meeting not found", 404);
  const ok = meeting.host.equals(user._id) || meeting.participants.some((p) => p.equals(user._id));
  if (!ok) throw new AppError("Forbidden", 403);
  return meeting;
}

async function findFile(meeting, rid) {
  const [file] = await bucket().find({ _id: new mongoose.Types.ObjectId(rid), "metadata.meeting": meeting.id }).toArray();
  if (!file) throw new AppError("Recording not found", 404);
  return file;
}

export const upload = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError("Send the recording as video/webm", 400);

  const filename = `${meeting.title}-${Date.now()}.webm`.replace(/[^\w.-]+/g, "-");
  const stream = bucket().openUploadStream(filename, {
    contentType: "video/webm",
    metadata: { meeting: meeting.id, user: req.user.id, userName: req.user.name },
  });
  await new Promise((ok, fail) => stream.once("finish", ok).once("error", fail).end(req.body));
  res.status(201).json({ success: true, recording: { id: stream.id, filename, size: req.body.length } });
});

export const list = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  const files = await bucket().find({ "metadata.meeting": meeting.id }).sort({ uploadDate: -1 }).toArray();
  res.json({
    success: true,
    recordings: files.map((f) => ({ id: f._id, filename: f.filename, size: f.length, by: f.metadata.userName, createdAt: f.uploadDate })),
  });
});

export const download = asyncHandler(async (req, res) => {
  const meeting = await getAccessible(req.params.id, req.user);
  const file = await findFile(meeting, req.params.rid);
  res.set({ "Content-Type": "video/webm", "Content-Length": file.length });
  bucket().openDownloadStream(file._id).pipe(res);
});
