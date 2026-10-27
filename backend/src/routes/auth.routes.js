import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as c from "../controllers/auth.controller.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  standardHeaders: true,
  message: { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
});
router.post("/signup", limiter, validate(c.signupSchema), c.signup);
router.post("/login", limiter, validate(c.loginSchema), c.login);
router.post("/refresh", limiter, validate(c.refreshSchema), c.refresh);
router.post("/logout", protect, c.logout);
router.get("/me", protect, c.me);

export default router;
