import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as b from "../controllers/board.controller.js";

const router = Router();
router.use(protect);

router
  .route("/:id")
  .all(validId())
  .get(b.getBoard)
  .patch(validate(b.boardSchema), b.updateBoard)
  .delete(b.deleteBoard);

router.post("/:id/tasks", validId(), validate(b.createBoardTaskSchema), b.createBoardTask);
router
  .route("/:id/tasks/:taskId")
  .all(validId(), validId("taskId"))
  .patch(validate(b.updateBoardTaskSchema), b.updateBoardTask)
  .delete(b.deleteBoardTask);

export default router;
