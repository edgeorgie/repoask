# Plan: repoask

## Overview

The indexer lists the tree with one API call, downloads files from raw.githubusercontent.com, chunks them and embeds in a worker. A question is embedded, matched against chunk vectors, and the top passages are sent to the model. When a deployment sets `NEXT_PUBLIC_POSTHOG_KEY`, a small facade reports usage shapes (page views, index size and duration, question size buckets) to PostHog through a same-origin proxy; without the key it is absent from the bundle.

## Modules

| Path | Responsibility |
|---|---|
| `lib/repo.ts` | Reference parsing, file selection, GitHub fetching |
| `lib/chunk.ts` | Chunking |
| `lib/indexer.ts` | Download, chunk and embed pipeline with stages |
| `lib/embedder.ts` | Client for the embedding worker |
| `lib/vector.ts` | Cosine retrieval and diversity |
| `lib/rag.ts` | Prompt and citation helpers |
| `components/` | Answer, code viewer, key box |
| `lib/analytics.ts` | Analytics facade: no-op without a key, cookieless PostHog with a fixed event allowlist otherwise, size buckets |
| `components/Analytics.tsx` | Manual `$pageview`; renders nothing without a key |
| `instrumentation-client.ts` | Loads the analytics SDK on idle, only when a key exists |

## Decisions

- [ADR 0001: Embeddings run locally in a worker](../adr/0001-embeddings-run-locally-in-a-worker.md)
- [ADR 0002: Bring your own key, browser only](../adr/0002-bring-your-own-key-browser-only.md)
- [ADR 0003: Product analytics without user data](../adr/0003-product-analytics-without-user-data.md)

## Quality gates

`npm run verify`: typecheck, lint, spec check, tests and production build.
