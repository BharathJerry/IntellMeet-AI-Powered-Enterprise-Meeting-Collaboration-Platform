import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate, validId } from "../middleware/validate.js";
import * as c from "../controllers/task.controller.js";

const router = Router();
router.use(protect);

router.route("/").post(validate(c.createTaskSchema), c.createTask).get(c.listTasks);
router
  .route("/:id")
  .all(validId())
  .patch(validate(c.updateTaskSchema), c.updateTask)
  .delete(c.deleteTask);

export default router;
