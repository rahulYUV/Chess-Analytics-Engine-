import { Request, Response } from "express";
import { AnalysisService, GameMeta } from "../services/analysis.service";
import { handleError } from "../utils/helpers";
import { IEvaluatedMove } from "../models/Analysis";

export class AnalysisController {
    /**
     * Create or fetch an analysis for a game.
     * Any authenticated user may analyze any game (decided in planning).
     */
    static async createOrFetch(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { chessUsername, game } = req.body as {
                chessUsername?: string;
                game?: GameMeta;
            };

            if (!chessUsername || typeof chessUsername !== "string") {
                return res.status(400).json({ error: "chessUsername is required" });
            }
            if (!game || !game.gameId || !game.pgn) {
                return res.status(400).json({ error: "game.gameId and game.pgn are required" });
            }
            if (!game.white?.username || !game.black?.username) {
                return res.status(400).json({ error: "game.white and game.black are required" });
            }
            if (typeof game.endTime !== "number") {
                return res.status(400).json({ error: "game.endTime is required" });
            }

            const analysis = await AnalysisService.getOrCreateAnalysis(
                userId,
                chessUsername.trim(),
                game
            );

            res.status(200).json({ success: true, analysis });
        } catch (error) {
            handleError(res, error);
        }
    }

    /**
     * Replace the evaluated moves for an analysis. Ownership check inline.
     */
    static async patchMoves(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const { moves } = req.body as { moves: IEvaluatedMove[] };
            if (!Array.isArray(moves)) {
                return res.status(400).json({ error: "moves must be an array" });
            }

            const existing = await AnalysisService.getById(id);
            if (!existing) {
                return res.status(404).json({ error: "Analysis not found" });
            }
            if (existing.userId.toString() !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            const updated = await AnalysisService.updateEvaluatedMoves(id, moves);
            res.status(200).json({ success: true, analysis: updated });
        } catch (error) {
            handleError(res, error);
        }
    }

    /**
     * Update the user's personal note.
     */
    static async patchNote(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const { note } = req.body as { note: string };
            if (typeof note !== "string") {
                return res.status(400).json({ error: "note must be a string" });
            }

            const existing = await AnalysisService.getById(id);
            if (!existing) {
                return res.status(404).json({ error: "Analysis not found" });
            }
            if (existing.userId.toString() !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            const updated = await AnalysisService.updateNote(id, note);
            res.status(200).json({ success: true, analysis: updated });
        } catch (error) {
            handleError(res, error);
        }
    }

    /**
     * List the caller's analyses, paginated by endTime desc.
     */
    static async listMine(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const limit = Math.min(50, parseInt((req.query.limit as string) || "20", 10));
            const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

            const analyses = await AnalysisService.listForUser(userId, limit, before);
            res.status(200).json({ success: true, analyses });
        } catch (error) {
            handleError(res, error);
        }
    }

    /**
     * Fetch a single analysis (caller must own it).
     */
    static async getOne(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const analysis = await AnalysisService.getById(id);
            if (!analysis) {
                return res.status(404).json({ error: "Analysis not found" });
            }
            if (analysis.userId.toString() !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            res.status(200).json({ success: true, analysis });
        } catch (error) {
            handleError(res, error);
        }
    }
}
