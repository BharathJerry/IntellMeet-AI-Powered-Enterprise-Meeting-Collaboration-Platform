import { z } from "zod";
import { AppError, asyncHandler } from "../utils/AppError.js";

export const nameSchema = z.object({ name: z.string().trim().min(2).max(60) });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar });

export const updateMe = asyncHandler(async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
});

// The browser shrinks the picture to a small JPEG; it is stored with the user as a data URL
export const setAvatar = asyncHandler(async (req, res) => {
  const b = req.body;
  const isJpeg = Buffer.isBuffer(b) && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (!isJpeg) throw new AppError("Send a JPEG image (max 200 KB)", 400);
  req.user.avatar = `data:image/jpeg;base64,${b.toString("base64")}`;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
});
