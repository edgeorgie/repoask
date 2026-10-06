# Specification: repoask

Ask a public GitHub repository questions and get answers that point at the exact lines.

## Provenance

This project was built with AI assistance. The behavior was implemented and verified first, in the pull requests listed in `tasks.md`. This specification was written afterwards from the verified behavior (reverse specification, 2026-10-06). From this point every change follows the workflow in `AGENTS.md`: specification first, then plan, tasks, implementation and verification.

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

## Open risks

- GitHub allows 60 unauthenticated API calls per hour per IP; each index uses two.
- Small embedding models retrieve less precisely than large ones.
