import { chunkFile, embedText } from "./chunk";
import type { Chunk } from "./chunk";
import type { Embeddable } from "./embedder-types";
import { fetchFileText, fetchRepoFiles } from "./repo";
import type { RepoRef } from "./repo";

export type Stage =
  | { kind: "listing" }
  | { kind: "model"; percent: number }
  | { kind: "downloading"; done: number; total: number }
  | { kind: "embedding"; done: number; total: number };

export interface RepoIndex {
  ref: RepoRef;
  branch: string;
  chunks: Chunk[];
  vectors: Float32Array[];
  fileCount: number;
  texts: Record<string, string>;
  truncated: boolean;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function indexRepo(ref: RepoRef, embedder: Embeddable, onStage: (s: Stage) => void): Promise<RepoIndex> {
  onStage({ kind: "listing" });
  const { branch, files, truncated } = await fetchRepoFiles(ref);
  if (files.length === 0) throw new Error("No indexable text files were found in this repository.");

  let done = 0;
  onStage({ kind: "downloading", done, total: files.length });
  const texts = await mapLimit(files, 8, async (f) => {
    try {
      return await fetchFileText(ref, branch, f.path);
    } catch {
      return "";
    } finally {
      onStage({ kind: "downloading", done: ++done, total: files.length });
    }
  });

  const chunks = files.flatMap((f, i) => chunkFile(f.path, texts[i]));
  if (chunks.length === 0) throw new Error("The files were empty or could not be downloaded.");

  embedder.onModelProgress = (percent) => onStage({ kind: "model", percent });
  const vectors: Float32Array[] = [];
  const BATCH = 16;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map(embedText);
    vectors.push(...(await embedder.embed(batch)));
    onStage({ kind: "embedding", done: Math.min(i + BATCH, chunks.length), total: chunks.length });
  }
  const textMap: Record<string, string> = {};
  files.forEach((f, i) => {
    textMap[f.path] = texts[i];
  });
  return { ref, branch, chunks, vectors, fileCount: files.length, texts: textMap, truncated };
}
