import mongoose from "mongoose";

export interface IEvaluatedMove {
    ply: number;
    playedMove: string;        // SAN
    bestMove: string;          // SAN
    evalBefore: number;        // centipawns, side-to-move-relative
    evalAfter: number;         // centipawns, side-to-move-relative
    classification: "blunder" | "mistake" | "inaccuracy" | "good" | "best" | "brilliant";
    theme: "hanging_piece" | "missed_fork" | "back_rank" | "opening_deviation" | "time_pressure" | "none";
    explanation: string;
}

export interface IAnalysis extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    chessUsername: string;
    gameId: string;            // Chess.com game URL or stable identifier
    pgn: string;
    white: { username: string; rating?: number; result: string };
    black: { username: string; rating?: number; result: string };
    endTime: number;           // epoch seconds
    timeClass: string;
    evaluatedMoves: IEvaluatedMove[];
    note: string;
    createdAt: Date;
    updatedAt: Date;
}

const evaluatedMoveSchema = new mongoose.Schema<IEvaluatedMove>(
    {
        ply: { type: Number, required: true },
        playedMove: { type: String, required: true },
        bestMove: { type: String, required: true },
        evalBefore: { type: Number, required: true },
        evalAfter: { type: Number, required: true },
        classification: {
            type: String,
            enum: ["blunder", "mistake", "inaccuracy", "good", "best", "brilliant"],
            required: true,
        },
        theme: {
            type: String,
            enum: ["hanging_piece", "missed_fork", "back_rank", "opening_deviation", "time_pressure", "none"],
            default: "none",
        },
        explanation: { type: String, default: "" },
    },
    { _id: false }
);

const analysisSchema = new mongoose.Schema<IAnalysis>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        chessUsername: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        gameId: {
            type: String,
            required: true,
            trim: true,
        },
        pgn: { type: String, required: true },
        white: {
            username: { type: String, required: true },
            rating: { type: Number },
            result: { type: String, required: true },
        },
        black: {
            username: { type: String, required: true },
            rating: { type: Number },
            result: { type: String, required: true },
        },
        endTime: { type: Number, required: true },
        timeClass: { type: String, default: "unknown" },
        evaluatedMoves: { type: [evaluatedMoveSchema], default: [] },
        note: { type: String, default: "" },
    },
    { timestamps: true }
);

// Compound indexes for common queries
analysisSchema.index({ userId: 1, endTime: -1 });

analysisSchema.index({ userId: 1, gameId: 1 }, { unique: true });

export const Analysis = mongoose.model<IAnalysis>("Analysis", analysisSchema);
