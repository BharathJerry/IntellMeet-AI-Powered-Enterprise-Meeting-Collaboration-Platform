import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { signAccess, signRefresh, hashToken } from "../utils/tokens.js";

export const googleSchema = z.object({ credential: z.string().min(20) });

// "Sign in with Google": the browser sends Google's ID token, and we verify it with Google's public keys
export const googleLogin = asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new AppError("Google login is not configured", 501);

  let profile;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: req.body.credential, audience: clientId });
    profile = ticket.getPayload();
  } catch {
    throw new AppError("Invalid Google token", 401);
  }
  if (!profile?.email || !profile.email_verified) throw new AppError("Google email is not verified", 401);

  const email = profile.email.toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: profile.name || email.split("@")[0],
      email,
      password: await bcrypt.hash(crypto.randomUUID(), 12), // random: this account signs in with Google
    });
  }

  const accessToken = signAccess(user.id);
  const refreshToken = signRefresh(user.id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    accessToken,
    refreshToken,
  });
});
