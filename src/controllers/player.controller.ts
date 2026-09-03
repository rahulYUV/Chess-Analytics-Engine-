import { Request, Response } from "express";
import { chessService } from "../services/chess.service";
import { handleError } from "../utils/helpers";

export class PlayerController {
    static async getPlayer(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayer(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerStats(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayerStats(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerFull(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayerFull(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerClubs(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayerClubs(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerMatches(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayerMatches(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async comparePlayers(req: Request, res: Response) {
        try {
            const { p1, p2 } = req.params;
            if (!p1 || !p2) return res.status(400).json({ error: "Both player IDs are required" });

            const data = await chessService.comparePlayers(p1, p2);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerInsights(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.getPlayerInsights(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    /**
     * List games for a player in a given year/month. Thin proxy in front of
     * chessService.listGamesForUser so the frontend can fetch through the
     * same origin (avoids CORS, gains server-side caching and rate limiting).
     */
    static async getPlayerGames(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const now = new Date();
            const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
            const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

            if (month < 1 || month > 12) {
                return res.status(400).json({ error: "month must be between 1 and 12" });
            }

            const data = await chessService.listGamesForUser(id, year, month);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }

    static async getPlayerGamesLastThreeMonths(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ error: "Player ID is required" });

            const data = await chessService.listGamesForLastThreeMonths(id);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    }
}
