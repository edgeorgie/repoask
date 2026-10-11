import assert from "node:assert/strict";
import { test } from "node:test";

// The /ingest proxy is a SERVER-side route, so no client-side gate can close
// it: registered unconditionally, a deployment forwards any body posted to
// /ingest/* to PostHog's public ingestion API whether or not a key is set and
// whatever the bundle contains. That is an open relay attributed to this
// origin. Asserting on the SOURCE of next.config.ts cannot prove a route is
// absent, so these tests import the real config and call its own rewrites().
// A clean bundle (FR-8, first criterion) says nothing about the proxy: the two
// halves are independent.

type Rewrite = { source: string; destination: string };
type Config = { output?: string; rewrites?: () => Promise<Rewrite[]> };

let loads = 0;

async function loadConfig(env: { key?: string; target?: string }): Promise<Config> {
  const names = ["NEXT_PUBLIC_POSTHOG_KEY", "DEPLOY_TARGET"] as const;
  const previous = names.map((n) => process.env[n]);
  const values = [env.key, env.target];
  names.forEach((n, i) => {
    if (values[i] === undefined) delete process.env[n];
    else process.env[n] = values[i];
  });
  try {
    // The gate is evaluated when the module loads, so each environment needs a
    // fresh copy of it; a unique query string defeats the module cache.
    const mod = await import(`../next.config.ts?load=${++loads}`);
    return mod.default as Config;
  } finally {
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n];
      else process.env[n] = previous[i];
    });
  }
}

async function rewritesWith(env: { key?: string; target?: string }): Promise<Rewrite[]> {
  const config = await loadConfig(env);
  assert.equal(typeof config.rewrites, "function");
  return config.rewrites!();
}

test("no rewrite is registered when no key is set", async () => {
  assert.deepEqual(await rewritesWith({}), []);
});

test("an empty key is treated as unset", async () => {
  assert.deepEqual(await rewritesWith({ key: "" }), []);
});

test("with a key the proxy forwards to PostHog only, catch-all last", async () => {
  const rewrites = await rewritesWith({ key: "phc_test_key" });
  assert.deepEqual(
    rewrites.map((r) => r.source),
    ["/ingest/static/:path*", "/ingest/array/:path*", "/ingest/:path*"],
  );
  // A wrong destination would make the relay worse than the ungated one. The
  // catch-all is last or /ingest/static/* would be swallowed and the SDK assets
  // would 404.
  for (const r of rewrites) {
    assert.match(new URL(r.destination).hostname, /\.i\.posthog\.com$/);
  }
});

test("the static export registers no rewrites even with a key", async () => {
  const config = await loadConfig({ key: "phc_test_key", target: "pages" });
  assert.equal(config.output, "export");
  assert.equal(config.rewrites, undefined);
});
