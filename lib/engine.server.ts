/**
 * Server-side engine for the MCP tools (and, if ever needed, server REST
 * routes). Reuses the EXACT SAME indexRepo/chunk/vector/rag logic the human
 * browser UI uses (lib/indexer.ts, lib/chunk.ts, lib/vector.ts, lib/rag.ts) —
 * nothing here is a parallel re-implementation of retrieval. The only piece
 * that differs between the human and agent paths is *where the embedding
 * model runs*: lib/embedder.ts (Web Worker, browser) vs.
 * lib/embedder.server.ts (inline, Node) — both load the identical
 * Xenova/all-MiniLM-L6-v2 model, so embeddings/scores are not approximated.
 *
 * Answer synthesis here reads ANTHROPIC_API_KEY / OPENAI_API_KEY from the
 * server process's environment (there is no browser to hold a user-entered
 * key for an agent caller) and falls back to a deterministic citation dump
 * when neither is set — the same "retrieval always works, prose is optional"
 * contract as the human UI's lib/llm.ts, just sourced from env instead of
 * localStorage.
 */
import type { Chunk } from "./chunk";
import { ServerEmbedder } from "./embedder.server";
import { indexRepo } from "./indexer";
import type { RepoIndex } from "./indexer";
import { PROVIDERS } from "./llm";
import type { Provider } from "./llm";
import { parseRepoUrl } from "./repo";
import type { RepoRef } from "./repo";
import { SYSTEM_PROMPT, buildPrompt } from "./rag";
import { diversify, topK } from "./vector";

// In-memory cache, keyed by "owner/repo" (lowercased). Lives for the life of
// the warm serverless instance — same cold-start caveat repoask-mcp documents
// for its own store.ts; index_repo should be called again after a cold start.
const cache = new Map<string, RepoIndex>();
let sharedEmbedder: ServerEmbedder | null = null;

function keyOf(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function getEmbedder(): ServerEmbedder {
  sharedEmbedder ??= new ServerEmbedder();
  return sharedEmbedder;
}

export function resolveRepoRef(input: string): RepoRef | null {
  return parseRepoUrl(input);
}

export interface IndexRepoResult {
  owner: string;
  repo: string;
  branch: string;
  fileCount: number;
  chunkCount: number;
  truncated: boolean;
  indexedAt: string;
}

export async function doIndexRepo(owner: string, repo: string, ref?: string): Promise<IndexRepoResult> {
  const index = await indexRepo({ owner, repo, ref }, getEmbedder(), () => {});
  cache.set(keyOf(owner, repo), index);
  return {
    owner,
    repo,
    branch: index.branch,
    fileCount: index.fileCount,
    chunkCount: index.chunks.length,
    truncated: index.truncated,
    indexedAt: new Date().toISOString(),
  };
}

export interface Citation {
  rank: number;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  excerpt: string;
}

export interface AskRepoResult {
  owner: string;
  repo: string;
  question: string;
  answer: string;
  answerMode: "llm" | "deterministic";
  model?: string;
  citations: Citation[];
}

function citationsFor(index: RepoIndex, hits: { index: number; score: number }[]): Citation[] {
  return hits.map((h, i) => {
    const c: Chunk = index.chunks[h.index];
    return {
      rank: i + 1,
      path: c.path,
      startLine: c.start,
      endLine: c.end,
      score: Math.round(h.score * 1000) / 1000,
      excerpt: c.text,
    };
  });
}

function deterministicAnswer(chunks: Citation[]): string {
  if (chunks.length === 0) return "No sufficiently similar chunks were found in the index for this question.";
  const lines = chunks.map(
    (c) => `[${c.rank}] ${c.path} (lines ${c.startLine}-${c.endLine}):\n${c.excerpt.split("\n").slice(0, 8).join("\n")}`,
  );
  return (
    "No LLM key configured (ANTHROPIC_API_KEY / OPENAI_API_KEY) — returning the top-matching source excerpts " +
    "directly with their citations. Read the cited file+line ranges to answer the question yourself, " +
    "or set an LLM key on the server for prose synthesis.\n\n" +
    lines.join("\n\n---\n\n")
  );
}

async function synthesizeServer(
  question: string,
  repoLabel: string,
  chunks: Chunk[],
): Promise<{ answer: string; provider: Provider; model: string } | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) return null;
  const provider: Provider = anthropicKey ? "anthropic" : "openai";
  const model = PROVIDERS[provider].model;
  const prompt = buildPrompt(question, repoLabel, chunks);
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 900, system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return { answer: data.content.find((b) => b.type === "text")?.text ?? "", provider, model };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return { answer: data.choices[0]?.message?.content ?? "", provider, model };
}

export async function doAskRepo(owner: string, repo: string, question: string, topKCount = 6): Promise<AskRepoResult> {
  const key = keyOf(owner, repo);
  let index = cache.get(key);
  if (!index) {
    index = await indexRepo({ owner, repo }, getEmbedder(), () => {});
    cache.set(key, index);
  }
  const [qv] = await getEmbedder().embed([question]);
  const hits = diversify(topK(qv, index.vectors, Math.max(topKCount * 3, 12)), (i) => index!.chunks[i].path, 3).slice(
    0,
    topKCount,
  );
  const citations = citationsFor(index, hits);
  const repoLabel = `${owner}/${repo}`;
  const chunksForPrompt: Chunk[] = citations.map((c) => ({ path: c.path, start: c.startLine, end: c.endLine, text: c.excerpt }));

  let answer: string;
  let answerMode: "llm" | "deterministic";
  let model: string | undefined;
  try {
    const synth = await synthesizeServer(question, repoLabel, chunksForPrompt);
    if (synth) {
      answer = synth.answer;
      answerMode = "llm";
      model = synth.model;
    } else {
      answer = deterministicAnswer(citations);
      answerMode = "deterministic";
    }
  } catch (err) {
    answer = `LLM synthesis failed (${(err as Error).message}); falling back to citations.\n\n${deterministicAnswer(citations)}`;
    answerMode = "deterministic";
  }

  return { owner, repo, question, answer, answerMode, model, citations };
}

export function doListIndexedRepos(): string[] {
  return [...cache.keys()];
}
