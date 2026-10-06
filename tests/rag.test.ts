import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRepoUrl, selectFiles } from "../lib/repo.ts";
import { chunkFile, embedText } from "../lib/chunk.ts";
import { diversify, dot, topK } from "../lib/vector.ts";
import { buildPrompt, citedIndexes } from "../lib/rag.ts";

test("parses repo urls and short names", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/vercel/next.js"), { owner: "vercel", repo: "next.js", ref: undefined });
  assert.deepEqual(parseRepoUrl("vercel/ai"), { owner: "vercel", repo: "ai" });
  assert.equal(parseRepoUrl("https://github.com/o/r/tree/dev/x")?.ref, "dev/x");
  assert.equal(parseRepoUrl("https://example.com/o/r"), null);
  assert.equal(parseRepoUrl("nope"), null);
});

test("selectFiles filters noise and ranks readme and docs first", () => {
  const tree = [
    { path: "package-lock.json", type: "blob", size: 100 },
    { path: "node_modules/a/index.js", type: "blob", size: 100 },
    { path: "src/deep/x/y/z.ts", type: "blob", size: 100 },
    { path: "README.md", type: "blob", size: 100 },
    { path: "logo.png", type: "blob", size: 100 },
    { path: "src/a.ts", type: "blob", size: 100 },
    { path: "big.ts", type: "blob", size: 900_000 },
    { path: "src", type: "tree" },
  ];
  const paths = selectFiles(tree).map((f) => f.path);
  assert.deepEqual(paths, ["README.md", "src/a.ts", "src/deep/x/y/z.ts"]);
});

test("chunkFile overlaps windows and keeps line numbers", () => {
  const text = Array.from({ length: 100 }, (_, i) => `line number ${i + 1} of the file`).join("\n");
  const chunks = chunkFile("a.ts", text, 40, 5);
  assert.equal(chunks[0].start, 1);
  assert.equal(chunks[0].end, 40);
  assert.equal(chunks[1].start, 36);
  assert.equal(chunks[chunks.length - 1].end, 100);
  assert.ok(embedText(chunks[0]).startsWith("a.ts\n"));
});

test("markdown chunks break at headings", () => {
  const lines = Array.from({ length: 60 }, (_, i) => (i === 30 ? "## Section" : `text line ${i} with words`));
  const chunks = chunkFile("README.md", lines.join("\n"), 40, 3);
  assert.equal(chunks[0].end, 30);
});

test("topK ranks by similarity and diversify caps per file", () => {
  const q = new Float32Array([1, 0]);
  const vs = [new Float32Array([1, 0]), new Float32Array([0.9, 0.1]), new Float32Array([0, 1]), new Float32Array([0.8, 0.2])];
  const top = topK(q, vs, 4, 0.5);
  assert.deepEqual(top.map((s) => s.index), [0, 1, 3]);
  assert.equal(dot(q, vs[0]), 1);
  const paths = ["a", "a", "b", "a"];
  assert.deepEqual(diversify(top, (i) => paths[i], 2).map((s) => s.index), [0, 1]);
});

test("prompt numbers sources and citations are extracted", () => {
  const chunks = [{ path: "a.ts", start: 1, end: 5, text: "x" }, { path: "b.ts", start: 3, end: 9, text: "y" }];
  const p = buildPrompt("What?", "o/r", chunks);
  assert.ok(p.includes("[2] b.ts (lines 3-9)"));
  assert.deepEqual(citedIndexes("See [1] and [2][2], not [7].", 2), [0, 1]);
});
