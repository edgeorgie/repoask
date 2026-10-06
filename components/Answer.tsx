import type { ReactNode } from "react";
import type { Chunk } from "@/lib/chunk";

function inline(text: string, sources: Chunk[], link: (c: Chunk) => string): ReactNode[] {
  return text.split(/(\[\d+\]|`[^`]+`)/g).map((part, i) => {
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      const c = sources[Number(cite[1]) - 1];
      if (!c) return part;
      return (
        <a
          key={i}
          href={link(c)}
          target="_blank"
          rel="noreferrer"
          title={`${c.path}:${c.start}-${c.end}`}
          className="mx-0.5 rounded-md bg-violet-500/20 px-1.5 py-0.5 align-baseline font-mono text-[11px] text-violet-200 no-underline hover:bg-violet-500/35"
        >
          {cite[1]}
        </a>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

/** Renders a model answer: fenced code blocks, paragraphs, inline code and clickable [n] citations. */
export default function Answer({ text, sources, link }: { text: string; sources: Chunk[]; link: (c: Chunk) => string }) {
  const blocks = text.split(/```[\w-]*\n?/g);
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-200">
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed">
            {block.replace(/\n$/, "")}
          </pre>
        ) : (
          block
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, j) => <p key={`${i}-${j}`} className="whitespace-pre-wrap">{inline(p.trim(), sources, link)}</p>)
        ),
      )}
    </div>
  );
}
