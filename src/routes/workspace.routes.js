import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as w from "../controllers/workspace.controller.js";
import * as b from "../controllers/board.controller.js";

const router = Router();
router.use(protect);

router.route("/").post(validate(w.workspaceSchema), w.createWorkspace).get(w.listWorkspaces);
router
  .route("/:id")
  .all(validId())
  .get(w.getWorkspace)
  .patch(validate(w.workspaceSchema), w.updateWorkspace)
  .delete(w.deleteWorkspace);

router.post("/:id/members", validId(), validate(w.addMemberSchema), w.addMember);
router.delete("/:id/members/:userId", validId(), validId("userId"), w.removeMember);

router.route("/:id/boards").all(validId()).post(validate(b.boardSchema), b.createBoard).get(b.listBoards);

export default router;
