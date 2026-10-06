# ADR 0002: Bring your own key, browser only

Status: accepted

## Context

No server means no secret storage.

## Decision

Keys live in localStorage and calls go directly to the provider.

## Consequences

Users supply their own key; the app holds none.
