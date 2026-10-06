# Plan: repoask

## Overview

The indexer lists the tree with one API call, downloads files from raw.githubusercontent.com, chunks them and embeds in a worker. A question is embedded, matched against chunk vectors, and the top passages are sent to the model.

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

## Decisions

- [ADR 0001: Embeddings run locally in a worker](../adr/0001-embeddings-run-locally-in-a-worker.md)
- [ADR 0002: Bring your own key, browser only](../adr/0002-bring-your-own-key-browser-only.md)

## Quality gates

`npm run verify`: typecheck, lint, spec check, tests and production build.
