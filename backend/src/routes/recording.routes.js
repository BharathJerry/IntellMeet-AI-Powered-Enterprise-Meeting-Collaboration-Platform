import express, { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validId } from "../middleware/validate.js";
import * as c from "../controllers/recording.controller.js";

const router = Router();
router.use(protect); // login is checked before any large upload is read

router.post("/:id/recordings", validId(), express.raw({ type: "video/webm", limit: "50mb" }), c.upload);
router.get("/:id/recordings", validId(), c.list);
router.get("/:id/recordings/:rid", validId(), validId("rid"), c.download);

export default router;
