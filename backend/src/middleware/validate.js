import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return next(new AppError(msg, 400));
  }
  req.body = result.data;
  next();
};

export const validId = (param = "id") => (req, _res, next) =>
  mongoose.isValidObjectId(req.params[param]) ? next() : next(new AppError("Invalid id", 400));
