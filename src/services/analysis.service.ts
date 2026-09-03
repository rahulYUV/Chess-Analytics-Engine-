import { Analysis, IAnalysis, IEvaluatedMove } from "../models/Analysis";

export interface GameMeta {
    gameId: string;
    pgn: string;
    white: { username: string; rating?: number; result: string };
    black: { username: string; rating?: number; result: string };
    endTime: number;
    timeClass?: string;
}

export class AnalysisService {
    /**
     * Upsert an analysis record. If the user already analyzed this game,
     * return the existing doc (so the user keeps their note). Otherwise create
     * a placeholder the client will fill with evaluatedMoves.
     */
    static async getOrCreateAnalysis(
        userId: string,
        chessUsername: string,
        game: GameMeta
    ): Promise<IAnalysis> {
        const existing = await Analysis.findOne({ userId, gameId: game.gameId });
        if (existing) return existing;

        return Analysis.create({
            userId,
            chessUsername,
            gameId: game.gameId,
            pgn: game.pgn,
            white: game.white,
            black: game.black,
            endTime: game.endTime,
            timeClass: game.timeClass || "unknown",
            evaluatedMoves: [],
            note: "",
        });
    }

    /**
     * Replace the evaluated moves for an analysis. Caller must have already
     * verified ownership of the analysis.
     */
    static async updateEvaluatedMoves(
        analysisId: string,
        moves: IEvaluatedMove[]
    ): Promise<IAnalysis | null> {
        return Analysis.findByIdAndUpdate(
            analysisId,
            { $set: { evaluatedMoves: moves } },
            { new: true, runValidators: true }
        );
    }

    /**
     * Update the user's note on an analysis. Caller must have already
     * verified ownership.
     */
    static async updateNote(
        analysisId: string,
        note: string
    ): Promise<IAnalysis | null> {
        return Analysis.findByIdAndUpdate(
            analysisId,
            { $set: { note } },
            { new: true }
        );
    }

    /**
     * Paginated list of a user's analyses, newest first.
     */
    static async listForUser(
        userId: string,
        limit: number = 20,
        before?: number
    ): Promise<IAnalysis[]> {
        const query: Record<string, any> = { userId };
        if (before) query.endTime = { $lt: before };
        return Analysis.find(query).sort({ endTime: -1 }).limit(limit);
    }

    /**
     * Fetch a single analysis. Caller should verify ownership before returning
     * the doc to the requester.
     */
    static async getById(analysisId: string): Promise<IAnalysis | null> {
        return Analysis.findById(analysisId);
    }

    /**
     * Delete an analysis. Caller must have already verified ownership.
     */
    static async deleteAnalysis(analysisId: string): Promise<void> {
        await Analysis.findByIdAndDelete(analysisId);
    }
}
