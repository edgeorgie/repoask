# repoask

Ask any public GitHub repo a question and get an answer that cites the exact lines. Indexing runs entirely in your browser with a local embedding model, so there is no server and nothing to sign up for.

## How it works

1. Reads the repository tree with one GitHub API call and downloads the relevant text files.
2. Splits files into overlapping chunks (Markdown breaks on headings).
3. Embeds the chunks locally in a Web Worker with [Transformers.js](https://github.com/huggingface/transformers.js) (`all-MiniLM-L6-v2`, quantized, about 23 MB, cached after the first run).
4. For each question, finds the most similar chunks by cosine similarity, keeps at most two per file, and asks an LLM to answer using only those sources.
5. Answers carry clickable `[n]` citations that open the exact lines on GitHub.

Retrieval is free and local. Only the final answer needs a model: bring your own Anthropic or OpenAI key. The key stays in your browser and requests go straight to the provider.

## Limits

- Public repositories only, up to 120 text files of 80 KB each (README and docs first).
- GitHub allows 60 unauthenticated API calls per hour per IP; each index uses two.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm test` runs the chunking, retrieval and prompt tests
- `npm run build` creates a production build

## License

MIT
