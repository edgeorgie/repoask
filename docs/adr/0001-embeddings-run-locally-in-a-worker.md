# ADR 0001: Embeddings run locally in a worker

Status: accepted

## Context

Embedding through an API costs money and uploads code.

## Decision

Use Transformers.js with a small quantized MiniLM model in a Web Worker.

## Consequences

Retrieval is free and private; first run downloads about 23 MB.
