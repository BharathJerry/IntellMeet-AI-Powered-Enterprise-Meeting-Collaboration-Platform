import express, { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as c from "../controllers/user.controller.js";

const router = Router();
router.use(protect);

router.patch("/me", validate(c.nameSchema), c.updateMe);
router.put("/me/avatar", express.raw({ type: "image/jpeg", limit: "200kb" }), c.setAvatar);

export default router;
