# ADR 0003: Product analytics without user data

Status: accepted

## Context

The owner wants to know whether repoask is used and how (page views, how large the indexed repositories are, how often questions are asked), across all of their public projects, in one PostHog project. This repository's rule is that keys and user content stay in the browser, and the README promises that no repository content is uploaded. Analytics must not weaken either promise, must not need a cookie banner, and must cost nothing for deployments that do not opt in.

## Decision

Use posthog-js behind a small facade (`lib/analytics.ts`) with a fixed allowlist of events: `$pageview`, `index_built` (`chunk_bucket`, `duration_ms`) and `repo_asked` (`repo`, `question_length_bucket`). Every event also carries `app: "repoask"` and `surface: "web"`.

- Off by default. Without `NEXT_PUBLIC_POSTHOG_KEY` at build time the SDK is never imported, so it is absent from every script the page loads and no request is made. The token is public by design (it only lets a browser send events), so no server path for secrets is added.
- No user data. Question text, repository files, answers, prompts, the provider key, names, emails and file paths are never sent. Free-text sizes travel as buckets (`<40`, `40-120`, `120-300`, `300+`) and index sizes as buckets of passages. The only identifier is the public `owner/name` of a repository the user chose to index.
- Cookieless. `cookieless_mode: "always"` and `person_profiles: "never"`: no cookies, no storage, no `identify()`. PostHog derives a daily anonymous id on its servers, so no consent banner is needed and a visitor cannot be followed across days.
- Explicit only. `autocapture: false` (autocapture scrapes element text), exception capture off (error messages can name repository files), session recording off, `capture_pageview: false` with one manual `$pageview` that survives App Router navigations, `respect_dnt: true`.
- Same-origin transport. On a Node host, `next.config.ts` rewrites `/ingest/*` to PostHog so tracking blockers that filter by domain do not drop events. The static export has no server, so that build names the PostHog host in `NEXT_PUBLIC_POSTHOG_HOST`.

## Consequences

- Dashboards can compare apps because every app uses the same grammar: `object_verb` events, `snake_case` properties, `app` and `surface` on every event.
- No cross-day identity, so funnels spanning days are not possible; this product does not need them.
- The PostHog project must have cookieless mode enabled or it ignores these events. Dropping client IPs is a PostHog project setting ("Discard client IP data"); the SDK's `ip` option is deprecated and has no effect, so it is not set.
- SDK-level captures such as web vitals follow the PostHog project's settings; none of them carry user content.
- Adding an event means changing the allowlist in `docs/spec/spec.md` (FR-8) and in this record first.
