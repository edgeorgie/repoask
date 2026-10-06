import type { ReactNode } from "react";
import type { Chunk } from "@/lib/chunk";

function inline(text: string, sources: Chunk[], active: number, onCite: (i: number) => void): ReactNode[] {
  return text.split(/(\[\d+\]|`[^`]+`)/g).map((part, i) => {
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      const idx = Number(cite[1]) - 1;
      if (!sources[idx]) return part;
      return (
        <button
          key={i}
          onClick={() => onCite(idx)}
          title={`${sources[idx].path}:${sources[idx].start}-${sources[idx].end}`}
          className={`mx-0.5 inline-grid h-[1.35rem] min-w-[1.35rem] -translate-y-px place-items-center rounded-md px-1 align-baseline font-mono text-[11px] font-bold transition active:scale-90 ${
            active === idx ? "bg-teal-700 text-white shadow-md shadow-teal-700/30" : "bg-teal-100 text-teal-800 hover:bg-teal-200"
          }`}
        >
          {cite[1]}
        </button>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i} className="rounded bg-ink/[0.07] px-1 py-0.5 font-mono text-[0.86em]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

/** Renders a model answer: fenced code blocks, paragraphs, inline code and citations that drive the code viewer. */
export default function Answer({ text, sources, active, onCite }: { text: string; sources: Chunk[]; active: number; onCite: (i: number) => void }) {
  const blocks = text.split(/```[\w-]*\n?/g);
  return (
    <div className="flex flex-col gap-3 text-[15.5px] leading-relaxed">
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-2xl bg-[#11171c] p-4 font-mono text-[12.5px] leading-relaxed text-white/90">
            {block.replace(/\n$/, "")}
          </pre>
        ) : (
          block
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, j) => <p key={`${i}-${j}`} className="whitespace-pre-wrap">{inline(p.trim(), sources, active, onCite)}</p>)
        ),
      )}
    </div>
  );
}
