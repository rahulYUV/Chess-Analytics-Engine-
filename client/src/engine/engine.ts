import StockfishWorker from "./stockfish.worker?worker";

export interface EngineResult {
    cp: number;
    mate?: number;
    bestMove: string;
    depth: number;
}

type Request = {
    id: string;
    fen: string;
    depth: number;
    hint: boolean;
    resolve: (result: EngineResult) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    cleanupAbort?: () => void;
};

export class StockfishEngine {
    private readonly worker: Worker;
    private readonly queue: Request[] = [];
    private current: Request | null = null;
    private sequence = 0;
    private latestCp = 0;
    private latestMate: number | undefined;
    private latestDepth = 0;
    private timeout: number | null = null;

    constructor() {
        this.worker = new StockfishWorker();
        this.worker.addEventListener("message", this.onMessage);
    }

    evaluate(fen: string, depth: number, opts: { signal?: AbortSignal; hint?: boolean } = {}): Promise<EngineResult> {
        return new Promise((resolve, reject) => {
            const request: Request = {
                id: `analysis-${++this.sequence}`,
                fen,
                depth,
                hint: opts.hint ?? false,
                resolve,
                reject,
                signal: opts.signal,
            };
            if (opts.signal?.aborted) {
                reject(new DOMException("The request was aborted.", "AbortError"));
                return;
            }
            this.queue.push(request);
            this.pump();
        });
    }

    terminate() {
        this.cancelCurrent();
        for (const request of this.queue.splice(0)) request.reject(new Error("Engine terminated"));
        this.worker.removeEventListener("message", this.onMessage);
        this.worker.terminate();
    }

    private readonly onMessage = (event: MessageEvent) => {
        const message = event.data as { type?: string; id?: string; cp?: number; mate?: number; depth?: number; move?: string };
        if (message.type === "info" && this.current && message.id === this.current.id) {
            if (typeof message.cp === "number") this.latestCp = message.cp;
            if (typeof message.mate === "number") this.latestMate = message.mate;
            if (typeof message.depth === "number") this.latestDepth = Math.max(this.latestDepth, message.depth);
            return;
        }
        if (message.type !== "bestmove" || !this.current || message.id !== this.current.id) return;
        const request = this.current;
        this.clearRequest();
        request.resolve({
            cp: this.latestCp,
            ...(this.latestMate === undefined ? {} : { mate: this.latestMate }),
            bestMove: message.move || "",
            depth: this.latestDepth,
        });
        this.pump();
    };

    private pump() {
        if (this.current) return;
        const request = this.queue.shift();
        if (!request) return;
        if (request.signal?.aborted) {
            request.reject(new DOMException("The request was aborted.", "AbortError"));
            this.pump();
            return;
        }
        this.current = request;
        this.latestCp = 0;
        this.latestMate = undefined;
        this.latestDepth = 0;
        const onAbort = () => this.cancelCurrent();
        request.signal?.addEventListener("abort", onAbort, { once: true });
        request.cleanupAbort = () => request.signal?.removeEventListener("abort", onAbort);
        this.worker.postMessage(request.hint
            ? { type: "hint", id: request.id, fen: request.fen }
            : { type: "analyze", id: request.id, fen: request.fen, depth: request.depth });
        this.timeout = window.setTimeout(() => {
            if (!this.current || this.current.id !== request.id) return;
            this.clearRequest();
            request.reject(new Error("Stockfish request timed out"));
            this.worker.postMessage({ type: "stop", id: request.id });
            this.pump();
        }, 15000);
    }

    private cancelCurrent() {
        if (!this.current) return;
        const request = this.current;
        this.clearRequest();
        this.worker.postMessage({ type: "stop", id: request.id });
        request.reject(new DOMException("The request was aborted.", "AbortError"));
        this.pump();
    }

    private clearRequest() {
        if (this.timeout !== null) window.clearTimeout(this.timeout);
        this.timeout = null;
        this.current?.cleanupAbort?.();
        this.current = null;
    }
}
