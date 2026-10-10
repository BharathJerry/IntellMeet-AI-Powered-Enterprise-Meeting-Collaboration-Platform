import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as c from "../controllers/ai.controller.js";

const router = Router();
router.use(protect);

router.post("/:id/transcript", validId(), validate(c.transcriptSchema), c.addTranscript);
router.post("/:id/summarize", validId(), c.summarize);
router.get("/:id/summary", validId(), c.getSummary);

export default router;
