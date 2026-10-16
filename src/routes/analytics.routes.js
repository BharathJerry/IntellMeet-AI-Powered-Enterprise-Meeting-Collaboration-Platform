import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { overview } from "../controllers/analytics.controller.js";

const router = Router();
router.use(protect);
router.get("/overview", overview);

export default router;
