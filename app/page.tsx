"use client";

import { useEffect, useRef, useState } from "react";
import Answer from "@/components/Answer";
import KeyBox, { loadSettings } from "@/components/KeyBox";
import type { LlmSettings } from "@/components/KeyBox";
import type { Chunk } from "@/lib/chunk";
import { Embedder } from "@/lib/embedder";
import { indexRepo } from "@/lib/indexer";
import type { RepoIndex, Stage } from "@/lib/indexer";
import { complete } from "@/lib/llm";
import { SYSTEM_PROMPT, buildPrompt } from "@/lib/rag";
import { parseRepoUrl } from "@/lib/repo";
import { diversify, topK } from "@/lib/vector";

interface Message {
  role: "user" | "assistant";
  text: string;
  sources: Chunk[];
}

const EXAMPLES = ["sindresorhus/ky", "pmndrs/zustand", "colinhacks/zod"];
const SUGGESTIONS = ["What does this project do?", "How do I get started?", "Where is the main entry point?", "How is it tested?"];

function stageInfo(s: Stage | null): { label: string; pct: number } {
  if (!s) return { label: "Starting", pct: 0 };
  if (s.kind === "listing") return { label: "Reading the repository tree", pct: 4 };
  if (s.kind === "downloading") return { label: `Downloading files ${s.done}/${s.total}`, pct: 4 + (s.done / s.total) * 26 };
  if (s.kind === "model") return { label: `Loading the embedding model ${Math.round(s.percent)}%`, pct: 30 };
  return { label: `Embedding chunks ${s.done}/${s.total}`, pct: 30 + (s.done / s.total) * 70 };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<LlmSettings>({ provider: "anthropic", key: "" });
  const [stage, setStage] = useState<Stage | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [index, setIndex] = useState<RepoIndex | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const embedder = useRef<Embedder | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.resolve().then(() => setSettings(loadSettings()));
    return () => embedder.current?.dispose();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking]);

  const start = async (value: string) => {
    const ref = parseRepoUrl(value);
    if (!ref) {
      setError("Enter a GitHub repository like owner/name or paste its URL.");
      return;
    }
    setError("");
    setIndexing(true);
    setStage(null);
    try {
      embedder.current ??= new Embedder();
      setIndex(await indexRepo(ref, embedder.current, setStage));
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Indexing failed");
    } finally {
      setIndexing(false);
    }
  };

  const link = (c: Chunk) =>
    index ? `https://github.com/${index.ref.owner}/${index.ref.repo}/blob/${index.branch}/${c.path}#L${c.start}-L${c.end}` : "#";

  const ask = async (q: string) => {
    if (!index || !embedder.current || !q.trim()) return;
    setQuestion("");
    setAsking(true);
    setMessages((m) => [...m, { role: "user", text: q, sources: [] }]);
    try {
      const [qv] = await embedder.current.embed([q]);
      const hits = diversify(topK(qv, index.vectors, 10), (i) => index.chunks[i].path, 2).slice(0, 6);
      const sources = hits.map((h) => index.chunks[h.index]);
      if (sources.length === 0) throw new Error("Nothing relevant was found in the indexed files.");
      if (!settings.key) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Add your API key (top right) to get a written answer. Retrieval already worked: these are the most relevant sources.", sources },
        ]);
        return;
      }
      const text = await complete(settings.provider, settings.key, SYSTEM_PROMPT, buildPrompt(q, `${index.ref.owner}/${index.ref.repo}`, sources));
      setMessages((m) => [...m, { role: "assistant", text, sources }]);
    } catch (e) {
      const sources = [] as Chunk[];
      setMessages((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong", sources }]);
    } finally {
      setAsking(false);
    }
  };

  const info = stageInfo(stage);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070b] text-zinc-100">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-60 h-[420px] w-[420px] rounded-full bg-cyan-500/15 blur-[120px]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-cyan-400 text-lg font-black text-black">?</div>
            <span className="text-lg font-bold tracking-tight">repoask</span>
          </div>
          <KeyBox value={settings} onChange={setSettings} />
        </header>

        {!index && !indexing && (
          <section className="my-auto flex flex-col items-center gap-6 py-16 text-center">
            <h1 className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-5xl font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl">
              Ask any repo<br />anything.
            </h1>
            <p className="max-w-md text-zinc-400">
              Indexing runs in your browser with a local embedding model. No server, no signup. Answers cite the exact lines.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(input);
              }}
              className="flex w-full max-w-lg gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2 shadow-2xl shadow-black/40 backdrop-blur"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="owner/name or GitHub URL"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-zinc-500"
                autoFocus
              />
              <button className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 active:scale-95">
                Index
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setInput(ex);
                    start(ex);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-zinc-300 transition hover:border-white/30 hover:bg-white/10"
                >
                  {ex}
                </button>
              ))}
            </div>
            {error && <p className="max-w-md text-sm text-red-400">{error}</p>}
          </section>
        )}

        {indexing && (
          <section className="my-auto flex flex-col items-center gap-5 py-16">
            <div className="h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-fuchsia-400" />
            <p className="text-sm text-zinc-300">{info.label}</p>
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-300" style={{ width: `${info.pct}%` }} />
            </div>
            <p className="max-w-xs text-center text-xs text-zinc-500">
              The first run downloads a small embedding model (about 23 MB) and caches it.
            </p>
          </section>
        )}

        {index && !indexing && (
          <section className="flex flex-1 flex-col gap-4 py-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
              <div>
                <p className="font-mono text-sm font-semibold">{index.ref.owner}/{index.ref.repo}</p>
                <p className="text-xs text-zinc-400">
                  {index.fileCount} files · {index.chunks.length} chunks · branch {index.branch}
                  {index.truncated ? " · partial tree" : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  setIndex(null);
                  setMessages([]);
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
              >
                Another repo
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              {messages.length === 0 && (
                <div className="my-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-400/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-fuchsia-500/80 to-violet-500/80 px-4 py-2.5 text-sm text-white shadow-lg">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className="max-w-full rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                    <Answer text={m.text} sources={m.sources} link={link} />
                    {m.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                        {m.sources.map((c, n) => (
                          <a
                            key={n}
                            href={link(c)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] text-zinc-400 hover:border-violet-400/50 hover:text-zinc-200"
                          >
                            [{n + 1}] {c.path}:{c.start}-{c.end}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              {asking && (
                <div className="flex gap-1.5 px-2 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-300" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </div>
              )}
              <div ref={bottom} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
              className="sticky bottom-4 flex gap-2 rounded-2xl border border-white/10 bg-[#0d1017]/90 p-2 shadow-2xl shadow-black/50 backdrop-blur"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this repo"
                disabled={asking}
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-zinc-500"
              />
              <button
                disabled={asking || !question.trim()}
                className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                Ask
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
