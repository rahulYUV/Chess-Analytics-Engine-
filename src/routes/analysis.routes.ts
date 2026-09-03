import { Router } from "express";
import { AnalysisController } from "../controllers/analysis.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { analysisLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

// All analysis endpoints require authentication and are rate-limited per user
router.use(authMiddleware);
router.use(analysisLimiter);

router.post("/", AnalysisController.createOrFetch);
router.get("/", AnalysisController.listMine);
router.get("/:id", AnalysisController.getOne);
router.patch("/:id/moves", AnalysisController.patchMoves);
router.patch("/:id/note", AnalysisController.patchNote);

export default router;
