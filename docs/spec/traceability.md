# Traceability: repoask

Every requirement maps to implementation files and to tests or manual evidence. `npm run spec:check` enforces that each requirement has an implementation, that files exist, and that there is a test or a manual note.

| Requirement | Implementation | Tests | Evidence | Status |
|---|---|---|---|---|
| FR-1 | `lib/repo.ts` | `tests/rag.test.ts` | PR 1: parsing tests. | Verified |
| FR-2 | `lib/repo.ts` | `tests/rag.test.ts` | PR 1: selection and ranking test. | Verified |
| FR-3 | `lib/chunk.ts` | `tests/rag.test.ts` | PR 1: chunk boundary tests. | Verified |
| FR-4 | `lib/embed.worker.ts`, `lib/embedder.ts`, `lib/indexer.ts`, `lib/vector.ts` | `tests/rag.test.ts` | PR 1: ranking and diversity tests; real run on sindresorhus/ky indexed 93 files into 475 chunks and returned the test files for a testing question. | Verified |
| FR-5 | `lib/rag.ts`, `lib/llm.ts`, `app/page.tsx` | `tests/rag.test.ts` | PR 1: prompt and citation tests. Written answer verified with a scripted model reply, not a real provider. | Implemented, not verified end to end |
| FR-6 | `components/CodeViewer.tsx`, `components/Answer.tsx`, `app/page.tsx` | manual | manual: PR 2, in Chrome citation 1 opened readme.md and citation 2 switched to test/type-guards.ts with its lines highlighted. | Verified |

"Verified" means the behavior was exercised. "Implemented, not verified end to end" means the code exists and its parts are tested, but a real external service or credential was not available.
