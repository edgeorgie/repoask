# Evaluation

A self-assessment against a reviewer's rubric. It states gaps plainly so a reviewer, a person or an agent, can verify or challenge each line.

| Criterion | Status | Notes |
|---|---|---|
| Onboarding | Pass | README has a one-command run, usage steps and configuration. |
| Reproducible build | Pass | Lockfile, Node 22 engine field, and one gate: `npm run verify`. |
| Automated tests | Partial | Unit tests cover the pure logic (5 of 6 requirements have tests). No browser end-to-end tests; UI behavior was verified manually and recorded in the traceability matrix. |
| Continuous integration | Gap | A workflow runs `npm run verify` but is not active until the repository token has the workflow permission. The gate runs locally. |
| Specification and traceability | Pass | Spec, plan, tasks, ADRs and a matrix enforced by `npm run spec:check`. |
| Documentation structure | Pass | Index, architecture with diagrams, glossary and design system. |
| Agent readiness | Pass | AGENTS.md, llms.txt, machine-readable requirements and a deterministic gate. There is no MCP server or OpenAPI document because the app is client-side. |
| LLM integration safety | Partial | Repository text is untrusted input to the model (indirect prompt injection is possible). The model has no tools, is told to answer only from the numbered sources, and its output is rendered as text. |
| Privacy and data flow | Pass | Every data path and its storage is tabulated in the README. |
| Accessibility | Partial | Citation chips are buttons with titles; the code viewer is scrollable but not announced as a region. Not audited with automated tooling. |
| Performance | Partial | Indexing a 100 file repository takes about a minute, dominated by embedding. Not measured with Lighthouse. |
| Security | Partial | The key lives in localStorage. Baseline security headers are set (nosniff, frame denial, referrer and permissions policies). No Content Security Policy is configured. |
| Deployment | Gap | Not deployed yet. A Vercel deploy button is in the README. |
| Licensing | Pass | MIT. Third-party: Transformers.js (Apache-2.0). |

## Verify it yourself

```bash
npm install
npm run verify
```

Requirements marked "Implemented, not verified end to end" in [spec.md](spec/spec.md) depend on a real external service or credential that was not exercised.
