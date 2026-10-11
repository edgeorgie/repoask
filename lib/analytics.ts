/**
 * Thin analytics facade (PostHog), the same shape as the owner's other apps.
 *
 * - No key: `track()` is a no-op and posthog-js is never downloaded, so a
 *   deployment that does not opt in ships no analytics code at all.
 * - With a key: the SDK is imported dynamically after hydration, off the
 *   critical path; events queued before it loads are flushed.
 * - Cookieless: no cookies, no storage, no consent banner. PostHog derives a
 *   daily anonymous id server-side; `identify()` is never called.
 * - Transport goes through this origin (`/ingest`, see next.config.ts) on a
 *   Node host, so tracking blockers that filter by domain do not drop it. The
 *   static export has no server to proxy through, so that build names the
 *   PostHog host in NEXT_PUBLIC_POSTHOG_HOST instead.
 * - Every event carries `app` and `surface` so one PostHog project can hold
 *   every app. User content never leaves the browser through this module: no
 *   question text, no code, no answer, no key. Only buckets, counts,
 *   durations and the public name of a repository (ADR 0003, FR-8).
 */
import type { PostHog } from "posthog-js";

type Props = Record<string, string | number | boolean | null | undefined>;

// next.config.ts inlines the key at build time ("" when unset), so without a
// key the dynamic import below is dead code and the SDK chunk is not emitted.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const APP = "repoask";

export const analyticsEnabled = Boolean(KEY);

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: { event: string; props?: Props }[] = [];

export function loadAnalytics(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (loading) return loading;
  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        // Read here, not at module level, so a no-key build leaves no trace of it.
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
        ui_host: "https://us.posthog.com",
        defaults: "2026-08-30",
        cookieless_mode: "always",
        person_profiles: "never",
        autocapture: false,
        capture_pageview: false, // manual and App-Router-aware (components/Analytics.tsx)
        // Error messages can name repository files; paths are not sent.
        capture_exceptions: false,
        disable_session_recording: true,
        respect_dnt: true,
      });
      posthog.register({ app: APP, surface: "web" });
      client = posthog;
      for (const q of queue.splice(0)) posthog.capture(q.event, q.props);
      return posthog;
    })
    .catch(() => null);
  return loading;
}

/** Fire-and-forget event. Safe to call anywhere, in any environment. */
export function track(event: string, props?: Props): void {
  if (!analyticsEnabled) return;
  if (client) {
    client.capture(event, props);
    return;
  }
  queue.push({ event, props });
  void loadAnalytics();
}

/** Coarse size of a free-text input, so no length can fingerprint a visitor. */
export function lengthBucket(length: number): "<40" | "40-120" | "120-300" | "300+" {
  if (length < 40) return "<40";
  if (length < 120) return "40-120";
  if (length < 300) return "120-300";
  return "300+";
}

/** Coarse size of an index: enough to see whether people index small or large repositories. */
export function chunkBucket(count: number): "<100" | "100-300" | "300-1000" | "1000+" {
  if (count < 100) return "<100";
  if (count < 300) return "100-300";
  if (count < 1000) return "300-1000";
  return "1000+";
}
