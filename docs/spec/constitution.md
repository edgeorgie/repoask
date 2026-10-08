# Constitution: repoask

Principles that outrank any single requirement.

## Product

- Answer questions with citations the user can open at the exact lines.
- Index in the browser so no repository content is uploaded.
- Work without a key for retrieval; use a key only for the written answer.

Non-goals:

- Private repositories.
- Incremental re-indexing.
- Server-side storage.

## Engineering standards

- TypeScript in strict mode. Types at every boundary: parsed model output, network responses and storage reads are validated, not trusted.
- Pure logic lives in `lib/` and is tested without a browser. UI components stay thin.
- Comments only for non-obvious intent. No emojis, no debug logging, no dead code.
- Dependencies are added only with a reason recorded in an ADR or the plan.
- Privacy by default: secrets and user content stay in the browser unless a requirement says otherwise.
- Accessibility: keyboard reachable controls, visible focus, reduced motion respected.

## Definition of done

1. The requirement exists in `spec.md` with acceptance criteria.
2. `npm run verify` passes.
3. Behavior was exercised, not only compiled. Evidence is recorded in `traceability.md`.
4. Uncertainty and unverified paths are stated in the spec, not hidden.
