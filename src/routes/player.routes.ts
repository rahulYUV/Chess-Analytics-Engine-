import { Router } from "express";
import { PlayerController } from "../controllers/player.controller";
import { gamesProxyLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:id", PlayerController.getPlayer);
router.get("/:id/stats", PlayerController.getPlayerStats);
router.get("/:id/full", PlayerController.getPlayerFull);
router.get("/:id/clubs", PlayerController.getPlayerClubs);
router.get("/:id/matches", PlayerController.getPlayerMatches);
router.get("/:id/insights", PlayerController.getPlayerInsights);
router.get("/:id/games/last-3-months", gamesProxyLimiter, PlayerController.getPlayerGamesLastThreeMonths);
router.get("/:id/games", gamesProxyLimiter, PlayerController.getPlayerGames);

export default router;
