import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { googleLogin, googleSchema } from "../controllers/oauth.controller.js";

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true });

router.post("/google", limiter, validate(googleSchema), googleLogin);

export default router;
