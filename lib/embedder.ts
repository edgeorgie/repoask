import type { Embeddable } from "./embedder-types";

type Pending = { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void };

/** Thin client for the embedding worker. Embedding runs locally in the browser, no API key and no server. */
export class Embedder implements Embeddable {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  onModelProgress?: (percent: number) => void;

  constructor() {
    this.worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id?: number; progress?: number; vectors?: Float32Array[]; message?: string };
      if (m.type === "model") this.onModelProgress?.(m.progress ?? 0);
      else if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.type === "result" && m.vectors) p?.resolve(m.vectors);
        else p?.reject(new Error(m.message ?? "Embedding failed"));
      }
    };
  }

  embed(texts: string[]): Promise<Float32Array[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, texts });
    });
  }

  dispose() {
    this.worker.terminate();
  }
}
