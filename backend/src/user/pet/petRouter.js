import express from "express";
import { listPets, createPet, updatePet, deletePet } from "./petController.js";

const router = express.Router({ mergeParams: true });

router.get("/", listPets);
router.post("/", createPet);
router.patch("/:id", updatePet);
router.delete("/:id", deletePet);

export default router;
