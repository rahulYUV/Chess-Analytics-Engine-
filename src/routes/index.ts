import { Router } from "express";
import playerRoutes from "./player.routes";
import generalRoutes from "./general.routes";
import authRoutes from "./auth.routes";
import analysisRoutes from "./analysis.routes";

const router = Router();

// Auth routes
router.use("/auth", authRoutes);

// Player routes
router.use("/player", playerRoutes);

// Analysis routes (auth-gated inside the router)
router.use("/analysis", analysisRoutes);

// General routes
router.use("/", generalRoutes);

export default router;
