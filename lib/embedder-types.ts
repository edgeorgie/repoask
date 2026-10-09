/**
 * Shared contract between the browser embedder (lib/embedder.ts, backed by a
 * Web Worker) and the server embedder (lib/embedder.server.ts, backed by the
 * same model running inline in the Node process). lib/indexer.ts depends only
 * on this interface, so the exact same indexing pipeline runs on both the
 * client (human UI) and the server (MCP tools) without forking any logic.
 */
export interface Embeddable {
  embed(texts: string[]): Promise<Float32Array[]>;
  onModelProgress?: (percent: number) => void;
}
