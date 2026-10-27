import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as c from "../controllers/invite.controller.js";

const router = Router();
router.use(protect);

router.get("/invite/:code", c.previewInvite);
router.post("/invite/:code/join", c.joinByInvite);
router.post("/:id/invite", validId(), c.getInviteCode);
router.post("/:id/invite-workspace", validId(), validate(c.workspaceInviteSchema), c.inviteWorkspace);

export default router;
