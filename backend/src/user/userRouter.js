import express from "express";
import { createUser, getUser, deleteUser } from "./userController.js";
import petRouter from "./pet/petRouter.js"

const router = express.Router();

router.post("/", createUser);
router.get("/:name", getUser);
router.delete("/:name", deleteUser);
router.use("/:name/pets", petRouter);

export default router;
