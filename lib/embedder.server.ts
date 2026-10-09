import { pipeline, env } from "@huggingface/transformers";
import type { Embeddable } from "./embedder-types";

// Runs in Node (API routes / the MCP server), never imported by browser bundles
// (Next.js keeps server-only files out of the client graph as long as nothing
// under app/ or components/ imports it directly — only api/* routes do).
env.allowLocalModels = false;
// Vercel's serverless runtime ships the function bundle (node_modules
// included) as a read-only filesystem under /var/task — only /tmp is
// writable. transformers.js defaults its download cache to a path inside
// node_modules, which works locally but throws ENOENT on first mkdir in
// production. Point it at /tmp instead (ephemeral per instance, which is
// fine — it just means the model re-downloads on a cold start, same as any
// other serverless cold-start cost).
env.cacheDir = "/tmp/transformers-cache";

type Extractor = (
  input: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

function getExtractor(onProgress?: (percent: number) => void): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === "progress") onProgress?.(p.progress ?? 0);
      },
    }) as unknown as Promise<Extractor>;
  }
  return extractorPromise;
}

/**
 * Server-side counterpart to lib/embedder.ts (the browser Web Worker client).
 * Runs the EXACT SAME model (Xenova/all-MiniLM-L6-v2, q8, mean-pooled,
 * L2-normalized) inline in the Node process instead of in a Web Worker —
 * there is no browser/DOM Worker API on the server, so the worker wrapper
 * can't be reused directly, but the model, weights, pooling and
 * normalization are identical. This is the one real behavioral difference
 * between the human (browser) and agent (MCP) paths: the browser path
 * downloads/caches the model lazily per visitor; the server path loads it
 * once per warm process and reuses it for every request. Embeddings produced
 * by both are numerically equivalent (same model, same inputs) — scores and
 * citations are not approximated or substituted.
 */
export class ServerEmbedder implements Embeddable {
  onModelProgress?: (percent: number) => void;

  async embed(texts: string[]): Promise<Float32Array[]> {
    const extractor = await getExtractor((p) => this.onModelProgress?.(p));
    const out = await extractor(texts, { pooling: "mean", normalize: true });
    const dim = out.dims[1];
    return texts.map((_, i) => out.data.slice(i * dim, (i + 1) * dim) as Float32Array);
  }
}
