import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { googleLogin, googleSchema } from "../controllers/oauth.controller.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  standardHeaders: true,
  message: { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
});

router.post("/google", limiter, validate(googleSchema), googleLogin);

export default router;
