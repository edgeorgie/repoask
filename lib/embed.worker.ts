/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

type Extractor = (input: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

let extractor: Promise<Extractor> | null = null;

function getExtractor(post: (m: unknown) => void): Promise<Extractor> {
  if (!extractor) {
    extractor = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === "progress") post({ type: "model", progress: p.progress ?? 0 });
      },
    }) as unknown as Promise<Extractor>;
  }
  return extractor;
}

self.onmessage = async (e: MessageEvent<{ id: number; texts: string[] }>) => {
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    const ex = await getExtractor(post);
    const out = await ex(e.data.texts, { pooling: "mean", normalize: true });
    const dim = out.dims[1];
    const vectors = e.data.texts.map((_, i) => out.data.slice(i * dim, (i + 1) * dim));
    post({ type: "result", id: e.data.id, vectors });
  } catch (err) {
    post({ type: "error", id: e.data.id, message: err instanceof Error ? err.message : "Embedding failed" });
  }
};
