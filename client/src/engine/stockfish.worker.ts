/**
 * Stockfish Web Worker wrapper.
 *
 * Wraps the `lila-stockfish-web` Stockfish 16 NNUE build. The library
 * ships as a Web Worker (sf16-7.js) that you instantiate in your own
 * worker and proxy UCI commands to. This module is itself a Worker
 * module: the React app spawns it with `new Worker(new URL(...))`,
 * posts high-level commands, and receives structured info / bestmove
 * messages.
 *
 * Message protocol (this worker <-> main thread):
 *   in:  { type: 'analyze', fen: string, depth?: number, multipv?: number }
 *   in:  { type: 'hint', fen: string }         (one-shot best move)
 *   in:  { type: 'stop' }
 *   out: { type: 'info', depth, cp?, mate?, pv, multipv }
 *   out: { type: 'bestmove', move, ponder? }
 *   out: { type: 'ready' }
 *   out: { type: 'error', message }
 */

import StockfishWorker from "lila-stockfish-web/sf16-7.js?url";

type Cmd =
    | { type: "analyze"; fen: string; depth?: number; multipv?: number }
    | { type: "hint"; fen: string }
    | { type: "stop" };

// Stockfish's "info" line looks like:
//   info depth 20 seldepth 25 multipv 1 score cp 35 nodes 1234 nps 5678 hashfull 50 tbhits 0 time 200 pv e2e4 e7e5 g1f3
//   info depth 20 seldepth 25 multipv 1 score mate 3 nodes ... pv ...
type ParsedInfo = {
    depth: number;
    cp?: number;
    mate?: number;
    pv: string[];
    multipv: number;
    nps?: number;
    time?: number;
};

// We use a multi-PV=1 analysis: one best line, sent as it improves.
// For the analyzer we want the best move at the *current* position;
// for evaluating a played move, we ask the engine to evaluate the
// position AFTER the move.

let engine: Worker | null = null;
let engineReady = false;
let pendingCmd: Cmd | null = null;
let pv1Buffer: string[] = []; // pv for multipv 1 of the current analysis
let bestmoveCallback: ((move: string) => void) | null = null;

const post = (msg: any) => (self as any).postMessage(msg);

function ensureEngine(): Worker {
    if (engine) return engine;
    // The library file is a worker entry. We import the URL Vite gives us
    // and construct a Worker from it. The worker exposes `uci`, `listen`,
    // `setNnueBuffer`, etc. on its own scope, so we forward messages via
    // postMessage.
    engine = new Worker(StockfishWorker as unknown as string, { type: "module" });

    let stdout = "";
    engine.addEventListener("message", (event: MessageEvent) => {
        const line: string = (event as any).data || "";
        stdout += line + "\n";

        if (line.startsWith("uciok")) {
            // Ask for the recommended NNUE and load it
            // For simplicity in v1, we use a small NNUE buffer; users on
            // slow connections may see longer initial load.
            (engine as any).postMessage("setoption name Use NNUE value true");
            (engine as any).postMessage("setoption name UCI_AnalyseMode value true");
            (engine as any).postMessage("isready");
        } else if (line.startsWith("readyok")) {
            engineReady = true;
            post({ type: "ready" });
            if (pendingCmd) {
                const command = pendingCmd;
                pendingCmd = null;
                handleCmd(command);
            }
        } else if (line.startsWith("info") && line.includes(" pv ")) {
            const parsed = parseInfo(line);
            if (parsed) post({ type: "info", ...parsed });
        } else if (line.startsWith("bestmove")) {
            const move = line.split(/\s+/)[1] || "";
            if (bestmoveCallback) {
                bestmoveCallback(move);
                bestmoveCallback = null;
            }
            post({ type: "bestmove", move });
        }
    });

    engine.addEventListener("error", (e: any) => {
        post({ type: "error", message: e.message || "Stockfish error" });
    });

    (engine as any).postMessage("uci");
    return engine;
}

function parseInfo(line: string): ParsedInfo | null {
    // crude but reliable tokenizer
    const tokens = line.split(/\s+/);
    const out: Partial<ParsedInfo> = { pv: [] };
    let i = 1;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t === "depth") { out.depth = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "multipv") { out.multipv = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "cp") { out.cp = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "mate") { out.mate = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "nps") { out.nps = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "time") { out.time = parseInt(tokens[++i], 10); i++; continue; }
        if (t === "pv") {
            i++;
            while (i < tokens.length) { out.pv!.push(tokens[i]); i++; }
            break;
        }
        i++;
    }
    if (out.depth === undefined) return null;
    return out as ParsedInfo;
}

function send(cmd: string) {
    (ensureEngine() as any).postMessage(cmd);
}

function handleCmd(cmd: Cmd) {
    if (cmd.type === "stop") {
        pendingCmd = null;
        if (engineReady) send("stop");
        return;
    }
    if (!engineReady) {
        pendingCmd = cmd;
        return;
    }
    if (cmd.type === "analyze") {
        const depth = cmd.depth ?? 18;
        send("ucinewgame");
        send(`position fen ${cmd.fen}`);
        send(`go depth ${depth}`);
        return;
    }
    if (cmd.type === "hint") {
        send("ucinewgame");
        send(`position fen ${cmd.fen}`);
        send("go depth 12");
    }
}

(self as any).addEventListener("message", (event: MessageEvent<Cmd>) => {
    handleCmd(event.data);
});

// Eagerly boot the engine when the worker is created so the "ready"
// message arrives by the time the UI wants to analyze
ensureEngine();
