# Specification: repoask

Ask a public GitHub repository questions and get answers that point at the exact lines.

## Baseline

This specification describes the behavior verified for the 0.1.0 baseline (2026-10-06) and is the source of truth from here on. Every change starts in this document and follows the workflow in `AGENTS.md`.

## Users

Developers exploring an unfamiliar codebase.

## Goals

- Answer questions with citations the user can open at the exact lines.
- Index in the browser so no repository content is uploaded.
- Work without a key for retrieval; use a key only for the written answer.

## Non-goals

- Private repositories.
- Incremental re-indexing.
- Server-side storage.

## Requirements

### FR-1 Parse repository references

Status: Verified.

- Given owner/name or a GitHub URL (optionally with a branch), then the owner, repo and ref are extracted; other hosts are rejected.

### FR-2 Select indexable files

Status: Verified.

- Given a repository tree, then lockfiles, vendored and generated files, binaries and oversized files are excluded and README and docs rank first, capped at 120 files.

### FR-3 Chunking

Status: Verified.

- Given a file, then overlapping line windows keep original line numbers and Markdown breaks on headings.

### FR-4 Local embeddings and retrieval

Status: Verified.

- Given indexed chunks and a question, then the most similar chunks are returned with at most two per file.

### FR-5 Cited answers

Status: Implemented, not verified end to end.

- Given retrieved sources and a key, then the model is instructed to answer only from them and cite as [n]; citations map to sources.
- Given no key, then retrieval results are still shown.

### FR-6 Code viewer synced to citations

Status: Verified.

- Given an answer with citations, when the user picks one, then the viewer opens that file, scrolls to the lines and highlights them.

### FR-7 Provider key kept in the session by default

Status: Implemented, not verified end to end.

- Given a provider key, then it is kept in sessionStorage for the tab by default, kept on the device only when the user ticks "Remember on this device", and removable with "Clear key"; the provider choice persists.

### FR-8 Product analytics without user data

Status: Implemented, not verified end to end.

- Given no `NEXT_PUBLIC_POSTHOG_KEY` at build time, then no script loaded on page view contains the analytics SDK, no analytics request is made and nothing is logged.
- Given a key, then the app captures only `$pageview` (on load and on route change), `index_built` (`chunk_bucket`, `duration_ms`) when an index finishes, and `repo_asked` (`repo` as the public owner/name, `question_length_bucket`) when a question is submitted; every event carries `app: "repoask"` and `surface: "web"`.
- Given any event, then it carries no question text, repository content, answer, prompt, provider key, name, email or file path; sizes travel as coarse buckets.
- Given a Node host and a key, then analytics requests go to this origin under `/ingest` and are proxied to PostHog's ingestion hosts only; given the static export, then they go to the host named in `NEXT_PUBLIC_POSTHOG_HOST`.
- Given no key, then the `/ingest` route is not registered: a request to `/ingest/*` on a Node host returns 404 and is not forwarded anywhere. A rewrite is a server-side route that exists whether or not a client calls it, so an ungated one would relay any request body to PostHog's public ingestion API from this origin.
- Given a browser that sends Do Not Track, then nothing is captured.

Non-goals: cookies or browser storage for analytics, identifying a visitor across days, session replay, autocapture, consent banners.

## Open risks

- GitHub allows 60 unauthenticated API calls per hour per IP; each index uses two.
- Small embedding models retrieve less precisely than large ones.
