"use client";

import { useState } from "react";
import KeyNotes from "@/components/KeyNotes";
import { clearKeys, readKeys, writeKeys } from "@/lib/keystore";
import { PROVIDERS } from "@/lib/llm";
import type { Provider } from "@/lib/llm";

export interface LlmSettings {
  provider: Provider;
  key: string;
  remember?: boolean;
}

const STORE = "repoask.llm";
const KEY = "repoask.llm.key";
const HOSTS: Record<Provider, string> = { anthropic: "api.anthropic.com", openai: "api.openai.com" };

export function loadSettings(): LlmSettings {
  const settings: LlmSettings = { provider: "anthropic", key: "", remember: false };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const stored = JSON.parse(raw) as { provider?: Provider; key?: string };
      if (stored.provider) settings.provider = stored.provider;
      if (stored.key) {
        sessionStorage.setItem(KEY, JSON.stringify({ key: stored.key }));
        localStorage.setItem(STORE, JSON.stringify({ provider: settings.provider }));
      }
    }
    const keys = readKeys<{ key: string }>(KEY, sessionStorage, localStorage);
    settings.key = keys.value?.key ?? "";
    settings.remember = keys.remember;
  } catch {}
  return settings;
}

export default function KeyBox({ value, onChange }: { value: LlmSettings; onChange: (s: LlmSettings) => void }) {
  const [open, setOpen] = useState(false);
  const update = (next: LlmSettings) => {
    onChange(next);
    try {
      localStorage.setItem(STORE, JSON.stringify({ provider: next.provider }));
      if (next.key) writeKeys(KEY, { key: next.key }, Boolean(next.remember), sessionStorage, localStorage);
      else clearKeys(KEY, sessionStorage, localStorage);
    } catch {}
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition hover:-translate-y-0.5 ${
          value.key ? "border-teal-700/30 bg-teal-50 text-teal-800" : "border-ink bg-ink text-white"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${value.key ? "bg-teal-500" : "bg-amber-300"}`} />
        {value.key ? `${PROVIDERS[value.provider].label} key set` : "Add API key"}
      </button>
      {open && (
        <div className="slide-up absolute right-0 z-20 mt-3 w-72 rounded-2xl border border-line bg-white p-4 shadow-2xl">
          <p className="mb-3 text-xs text-ink-soft">Used only to write the final answer.</p>
          <select
            value={value.provider}
            onChange={(e) => update({ ...value, provider: e.target.value as Provider })}
            className="mb-2 w-full rounded-lg border border-line bg-bg px-2 py-2 text-sm"
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
            className="w-full rounded-lg border border-line bg-bg px-2 py-2 text-sm outline-none focus:border-teal-600"
          />
          <div className="mt-3">
            <KeyNotes host={HOSTS[value.provider]} remember={Boolean(value.remember)} hasKey={Boolean(value.key)} onRemember={(remember) => update({ ...value, remember })} onClear={() => update({ ...value, key: "" })} />
          </div>
        </div>
      )}
    </div>
  );
}
