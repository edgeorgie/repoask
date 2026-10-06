"use client";

import { useEffect, useRef, useState } from "react";
import Answer from "@/components/Answer";
import CodeViewer from "@/components/CodeViewer";
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
const STEPS = ["Read the tree", "Download files", "Embed locally"];

function stageInfo(s: Stage | null): { step: number; label: string; pct: number } {
  if (!s) return { step: 0, label: "Starting", pct: 2 };
  if (s.kind === "listing") return { step: 0, label: "Reading the repository tree", pct: 5 };
  if (s.kind === "downloading") return { step: 1, label: `Downloading files ${s.done}/${s.total}`, pct: 5 + (s.done / s.total) * 25 };
  if (s.kind === "model") return { step: 2, label: `Loading the embedding model ${Math.round(s.percent)}%`, pct: 30 };
  return { step: 2, label: `Embedding passages ${s.done}/${s.total}`, pct: 30 + (s.done / s.total) * 70 };
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
  const [active, setActive] = useState<{ msg: number; src: number } | null>(null);
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
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Indexing failed");
    } finally {
      setIndexing(false);
    }
  };

  const ghLink = (c: Chunk) =>
    index ? `https://github.com/${index.ref.owner}/${index.ref.repo}/blob/${index.branch}/${c.path}#L${c.start}-L${c.end}` : "#";

  const ask = async (q: string) => {
    if (!index || !embedder.current || !q.trim()) return;
    setQuestion("");
    setAsking(true);
    const base = messages.length;
    setMessages((m) => [...m, { role: "user", text: q, sources: [] }]);
    const reply = (text: string, sources: Chunk[]) => {
      setMessages((m) => [...m, { role: "assistant", text, sources }]);
      if (sources.length > 0) setActive({ msg: base + 1, src: 0 });
    };
    try {
      const [qv] = await embedder.current.embed([q]);
      const hits = diversify(topK(qv, index.vectors, 10), (i) => index.chunks[i].path, 2).slice(0, 6);
      const sources = hits.map((h) => index.chunks[h.index]);
      if (sources.length === 0) throw new Error("Nothing relevant was found in the indexed files.");
      if (!settings.key) {
        reply("Add your API key (top right) to get a written answer. Retrieval already worked: these are the most relevant passages, open them on the right.", sources);
        return;
      }
      const text = await complete(settings.provider, settings.key, SYSTEM_PROMPT, buildPrompt(q, `${index.ref.owner}/${index.ref.repo}`, sources));
      reply(text, sources);
    } catch (e) {
      reply(e instanceof Error ? e.message : "Something went wrong", []);
    } finally {
      setAsking(false);
    }
  };

  const info = stageInfo(stage);
  const activeSource = active ? messages[active.msg]?.sources[active.src] : undefined;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-6 pb-10 pt-6 sm:px-10">
        <header className="flex items-center justify-between">
          <button onClick={() => { setIndex(null); setMessages([]); setActive(null); }} className="display flex items-center gap-2 text-xl">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm text-teal-300">?</span>
            repoask
          </button>
          <div className="flex items-center gap-3">
            {index && (
              <span className="hidden rounded-full border border-line bg-white px-4 py-2 font-mono text-xs sm:block">
                {index.ref.owner}/{index.ref.repo} &middot; {index.fileCount} files &middot; {index.chunks.length} passages
              </span>
            )}
            <KeyBox value={settings} onChange={setSettings} />
          </div>
        </header>

        {!index && !indexing && (
          <section className="slide-up my-auto py-16">
            <h1 className="display max-w-4xl text-5xl leading-[0.95] sm:text-7xl lg:text-[6.5rem]">
              Ask a repo.
              <br />
              <span className="text-teal-deep">See the lines.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg text-ink-soft">Answers come with receipts: every claim points at the exact code, and the viewer scrolls straight to it. Indexing happens in your browser, so nothing is uploaded.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(input);
              }}
              className="mt-10 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 pl-5 shadow-[0_20px_60px_-20px_rgba(11,107,98,0.35)] ring-1 ring-line transition focus-within:ring-2 focus-within:ring-teal-600"
            >
              <span className="font-mono text-sm text-ink-soft">github.com/</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="owner/name"
                className="min-w-0 flex-1 bg-transparent py-3 font-mono text-lg outline-none placeholder:text-ink-soft/40"
                aria-label="Repository"
                autoFocus
              />
              <button className="rounded-xl bg-teal-deep px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink active:scale-95">Index it</button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              try
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setInput(ex);
                    start(ex);
                  }}
                  className="rounded-full bg-white px-3.5 py-1.5 font-mono text-[13px] ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-teal-50 hover:ring-teal-600/40"
                >
                  {ex}
                </button>
              ))}
            </div>
            {error && <p className="mt-5 max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          </section>
        )}

        {indexing && (
          <section className="slide-up my-auto max-w-xl py-16">
            <h2 className="display text-4xl">Reading the repo...</h2>
            <ol className="mt-8 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 text-[15px] transition ${i <= info.step ? "text-ink" : "text-ink-soft/50"}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${i < info.step ? "bg-teal-deep text-white" : i === info.step ? "bg-ink text-white" : "bg-ink/10"}`}>
                    {i < info.step ? "✓" : i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-8 h-3 overflow-hidden rounded-full bg-ink/10">
              <div className="ribbon h-full rounded-full bg-teal-deep transition-all duration-300" style={{ width: `${info.pct}%` }} />
            </div>
            <p className="mt-3 font-mono text-sm text-ink-soft">{info.label}</p>
            <p className="mt-6 text-xs text-ink-soft">The first run downloads a small embedding model (about 23 MB) and caches it.</p>
          </section>
        )}

        {index && !indexing && (
          <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[minmax(0,36rem)_1fr]">
            <section className="flex min-h-[60vh] flex-col">
              <div className="flex flex-1 flex-col gap-5">
                {messages.length === 0 && (
                  <div className="slide-up py-6">
                    <h2 className="display text-3xl">What do you want to know?</h2>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} onClick={() => ask(s)} className="rounded-full bg-white px-4 py-2 text-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-teal-50 hover:ring-teal-600/40">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="slide-up ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-3 text-[15px] text-white">{m.text}</div>
                  ) : (
                    <div key={i} className="slide-up rounded-2xl rounded-bl-sm bg-white p-5 ring-1 ring-line">
                      <Answer text={m.text} sources={m.sources} active={active?.msg === i ? active.src : -1} onCite={(s) => setActive({ msg: i, src: s })} />
                      {m.sources.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                          {m.sources.map((c, n) => (
                            <button
                              key={n}
                              onClick={() => setActive({ msg: i, src: n })}
                              className={`cite-in rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition hover:-translate-y-0.5 ${
                                active?.msg === i && active.src === n ? "bg-teal-deep text-white" : "bg-bg text-ink-soft ring-1 ring-line hover:text-ink"
                              }`}
                              style={{ animationDelay: `${n * 60}ms` }}
                            >
                              [{n + 1}] {c.path.split("/").pop()}:{c.start}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                )}
                {asking && (
                  <div className="flex gap-1.5 px-2 py-3">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-deep" style={{ animationDelay: `${d * 120}ms` }} />
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
                className="sticky bottom-4 mt-4 flex gap-2 rounded-2xl bg-white p-2 pl-4 shadow-[0_20px_50px_-15px_rgba(14,26,26,0.35)] ring-1 ring-line focus-within:ring-2 focus-within:ring-teal-600"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about this repo"
                  disabled={asking}
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-soft/50"
                  aria-label="Question"
                />
                <button disabled={asking || !question.trim()} className="rounded-xl bg-teal-deep px-5 py-3 text-sm font-bold text-white transition hover:bg-ink active:scale-95 disabled:opacity-50">
                  Ask
                </button>
              </form>
            </section>

            <aside className="min-h-[420px] lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
              {activeSource && index.texts[activeSource.path] !== undefined ? (
                <CodeViewer path={activeSource.path} text={index.texts[activeSource.path]} start={activeSource.start} end={activeSource.end} href={ghLink(activeSource)} />
              ) : (
                <div className="grid h-full place-items-center rounded-[1.5rem] border-2 border-dashed border-ink/15 p-8 text-center">
                  <div>
                    <p className="display text-2xl">The code shows up here</p>
                    <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">Ask a question. Pick any citation and the file opens at the exact lines it relied on.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
