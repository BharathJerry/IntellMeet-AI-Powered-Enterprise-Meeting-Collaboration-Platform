import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { signAccess, signRefresh, hashToken } from "../utils/tokens.js";

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

async function issueTokens(user) {
  const accessToken = signAccess(user.id);
  const refreshToken = signRefresh(user.id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) throw new AppError("Email already registered", 409);
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ success: true, user: publicUser(user), ...(await issueTokens(user)) });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");
  const ok = user && (await bcrypt.compare(req.body.password, user.password));
  if (!ok) throw new AppError("Invalid email or password", 401);
  res.json({ success: true, user: publicUser(user), ...(await issueTokens(user)) });
});

export const refresh = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }
  const user = await User.findById(payload.id).select("+refreshTokenHash");
  if (!user || user.refreshTokenHash !== hashToken(req.body.refreshToken))
    throw new AppError("Refresh token revoked", 401);
  res.json({ success: true, ...(await issueTokens(user)) }); // rotation
});

export const logout = asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save();
  res.json({ success: true });
});

export const me = (req, res) => res.json({ success: true, user: publicUser(req.user) });
