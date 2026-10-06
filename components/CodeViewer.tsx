"use client";

import { useEffect, useRef } from "react";

interface Props {
  path: string;
  text: string;
  start: number;
  end: number;
  href: string;
}

/** Shows the cited file and scrolls to the exact lines the answer relied on, highlighting them. */
export default function CodeViewer({ path, text, start, end, href }: Props) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    const row = first.current;
    if (!box || !row) return;
    box.scrollTo({ top: Math.max(0, row.offsetTop - 72), behavior: "smooth" });
  }, [path, start, end]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-[#11171c] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] text-white">{path}</p>
          <p className="font-mono text-[11px] text-teal-300/80">lines {start}&ndash;{end}</p>
        </div>
        <a href={href} target="_blank" rel="noreferrer" className="shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:border-teal-300 hover:text-teal-200">
          GitHub &nearr;
        </a>
      </div>
      <div ref={scroller} className="relative flex-1 overflow-auto py-3 font-mono text-[12.5px] leading-[1.7]">
        {lines.map((line, i) => {
          const n = i + 1;
          const on = n >= start && n <= end;
          return (
            <div
              key={n}
              ref={n === start ? first : undefined}
              className={`flex pr-6 transition-colors duration-500 ${on ? "bg-teal-400/15 shadow-[inset_3px_0_0_#2dd4bf]" : ""}`}
            >
              <span className={`w-14 shrink-0 select-none pr-4 text-right ${on ? "text-teal-300" : "text-white/25"}`}>{n}</span>
              <span className={`whitespace-pre ${on ? "text-white" : "text-white/60"}`}>{line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
