import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as c from "../controllers/meeting.controller.js";

const router = Router();
router.use(protect);

router.route("/").post(validate(c.createMeetingSchema), c.createMeeting).get(c.listMeetings);
router
  .route("/:id")
  .all(validId())
  .get(c.getMeeting)
  .patch(validate(c.updateMeetingSchema), c.updateMeeting)
  .delete(c.deleteMeeting);
router.post("/:id/join", validId(), c.joinMeeting);
router.post("/:id/action-items/convert", validId(), c.convertActionItems);

export default router;
