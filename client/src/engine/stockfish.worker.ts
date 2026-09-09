/**
 * Stockfish Web Worker wrapper.
 *
 * Wraps the `lila-stockfish-web` Stockfish 16 NNUE build. This module is
 * itself the application worker, so it instantiates the package's Emscripten
 * module directly and calls its documented `setNnueBuffer` API.
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

import StockfishModule from "lila-stockfish-web/sf16-7.js";

// lila-stockfish-web does not ship NNUE binaries in its npm package. This is
// the network documented for the package's sf16-7 build.
const NNUE_WEIGHTS_URL = "https://tests.stockfishchess.org/api/nn/nn-ecb35f70ff2a.nnue";

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

// We use multi-PV analysis: one or more lines, sent as they improve.
// For the analyzer we want the best move(s) at the *current* position;
// for evaluating a played move, we ask the engine to evaluate the
// position AFTER the move.

type StockfishEngine = {
    uci: (command: string) => void;
    listen: (line: string) => void;
    setNnueBuffer: (data: Uint8Array, index?: number) => void;
    onError: (message: string) => void;
};

let engine: StockfishEngine | null = null;
let engineInit: Promise<void> | null = null;
let engineReady = false;
let pendingCmd: Cmd | null = null;
let currentMultipv = 1;
// True while a `go` search is in flight — used to decide whether we
// need to send `stop` before starting a new one.
let searchInFlight = false;
// Resolves the *next* bestmove line to the caller that asked for a
// one-shot hint, so `hint` commands can await a single result instead
// of only relying on the generic `bestmove` broadcast.
let bestmoveCallback: ((move: string) => void) | null = null;

const post = (msg: any) => (self as any).postMessage(msg);

async function loadNnueBuffer(): Promise<Uint8Array | null> {
    try {
        const res = await fetch(NNUE_WEIGHTS_URL);
        if (!res.ok) throw new Error(`NNUE fetch failed (${res.status})`);
        return new Uint8Array(await res.arrayBuffer());
    } catch (e: any) {
        post({ type: "error", message: `Failed to load NNUE weights: ${e.message || e}` });
        return null;
    }
}

async function initializeEngine(): Promise<void> {
    try {
        engine = await StockfishModule() as unknown as StockfishEngine;
        engine.listen = handleEngineLine;
        engine.onError = (message) => post({ type: "error", message: `Stockfish error: ${message}` });
        engine.uci("uci");
    } catch (e: any) {
        post({ type: "error", message: `Failed to initialize Stockfish: ${e.message || e}` });
    }
}

function ensureEngine(): Promise<void> {
    if (!engineInit) engineInit = initializeEngine();
    return engineInit;
}

async function handleEngineLine(line: string): Promise<void> {
    if (line.startsWith("uciok")) {
        if (!engine) return;
        engine.uci("setoption name Use NNUE value true");
        engine.uci("setoption name UCI_AnalyseMode value true");
        const buffer = await loadNnueBuffer();
        if (buffer) engine.setNnueBuffer(buffer);
        engine.uci("isready");
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
        searchInFlight = false;
        const move = line.split(/\s+/)[1] || "";
        if (bestmoveCallback) {
            const cb = bestmoveCallback;
            bestmoveCallback = null;
            cb(move);
        }
        post({ type: "bestmove", move });
    }
}

function parseInfo(line: string): ParsedInfo | null {
    // crude but reliable tokenizer
    const tokens = line.split(/\s+/);
    const out: Partial<ParsedInfo> = { pv: [], multipv: 1 };
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
    engine?.uci(cmd);
}

/**
 * Update the engine's MultiPV option only when it actually changes —
 * sending it on every single search is harmless but unnecessary.
 */
function setMultipv(n: number) {
    const clamped = Math.max(1, Math.min(n, 8));
    if (clamped === currentMultipv) return;
    currentMultipv = clamped;
    send(`setoption name MultiPV value ${clamped}`);
}

function handleCmd(cmd: Cmd) {
    if (cmd.type === "stop") {
        pendingCmd = null;
        if (engineReady && searchInFlight) send("stop");
        return;
    }
    if (!engineReady) {
        pendingCmd = cmd;
        return;
    }

    // If a search is already running, stop it first — sending a new
    // `position`/`go` while one is in flight leaves the engine's state
    // (and multipv/bestmove bookkeeping) undefined.
    if (searchInFlight) {
        send("stop");
    }

    if (cmd.type === "analyze") {
        const depth = cmd.depth ?? 18;
        setMultipv(cmd.multipv ?? 1);
        // Avoid `ucinewgame` here: it clears the transposition table,
        // which is expensive when we're analyzing many positions from
        // the same game back-to-back (e.g. a full game review). We
        // only need `ucinewgame` when truly starting a fresh game.
        send(`position fen ${cmd.fen}`);
        searchInFlight = true;
        send(`go depth ${depth}`);
        return;
    }
    if (cmd.type === "hint") {
        setMultipv(1);
        send(`position fen ${cmd.fen}`);
        searchInFlight = true;
        send("go depth 12");
    }
}

/**
 * Reset the engine's internal game state (transposition table, search
 * history). Call this explicitly when starting analysis of a brand
 * new game — not on every single move.
 */
function resetGame() {
    if (!engineReady) return;
    if (searchInFlight) send("stop");
    send("ucinewgame");
}

(self as any).addEventListener("message", (event: MessageEvent<Cmd | { type: "newgame" }>) => {
    const data = event.data as any;
    if (data.type === "newgame") {
        resetGame();
        return;
    }
    handleCmd(data);
});

// Eagerly boot the engine when the worker is created so the "ready"
// message arrives by the time the UI wants to analyze
void ensureEngine();