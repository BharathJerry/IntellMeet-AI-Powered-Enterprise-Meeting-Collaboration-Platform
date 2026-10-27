import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validId } from "../middleware/validate.js";
import * as controller from "../controllers/invite.controller.js";

const router = Router();
router.use(protect);

router.get("/invite/:code", controller.previewInvite);
router.post("/invite/:code/join", controller.joinByInvite);
router.post("/:id/invite", validId(), controller.getInviteCode);

export default router;
