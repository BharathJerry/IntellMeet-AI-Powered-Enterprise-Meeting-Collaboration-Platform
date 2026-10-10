import jwt from "jsonwebtoken";
import crypto from "crypto";

export const signAccess = (id) =>
  jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });

export const signRefresh = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

// sha256 (not bcrypt): bcrypt only reads the first 72 bytes, and JWT starts are near-identical
export const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
