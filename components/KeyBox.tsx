"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/llm";
import type { Provider } from "@/lib/llm";

export interface LlmSettings {
  provider: Provider;
  key: string;
}

const STORE = "repoask.llm";

export function loadSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as LlmSettings;
  } catch {}
  return { provider: "anthropic", key: "" };
}

export default function KeyBox({ value, onChange }: { value: LlmSettings; onChange: (s: LlmSettings) => void }) {
  const [open, setOpen] = useState(false);
  const update = (next: LlmSettings) => {
    onChange(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
          value.key ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-amber-400/40 bg-amber-400/10 text-amber-200"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${value.key ? "bg-emerald-400" : "bg-amber-400"}`} />
        {value.key ? `${PROVIDERS[value.provider].label} key set` : "Add your API key"}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-white/10 bg-[#10131c] p-4 shadow-2xl">
          <p className="mb-3 text-xs text-zinc-400">
            Used only for the final answer. It stays in this browser and calls go straight to the provider.
          </p>
          <select
            value={value.provider}
            onChange={(e) => update({ ...value, provider: e.target.value as Provider })}
            className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input
            type="password"
            value={value.key}
            onChange={(e) => update({ ...value, key: e.target.value })}
            placeholder="API key"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-violet-400/60"
          />
        </div>
      )}
    </div>
  );
}
