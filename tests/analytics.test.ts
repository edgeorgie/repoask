import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkBucket, lengthBucket, loadAnalytics, track } from "../lib/analytics.ts";

test("question lengths are reported as coarse buckets", () => {
  assert.equal(lengthBucket(0), "<40");
  assert.equal(lengthBucket(39), "<40");
  assert.equal(lengthBucket(40), "40-120");
  assert.equal(lengthBucket(119), "40-120");
  assert.equal(lengthBucket(120), "120-300");
  assert.equal(lengthBucket(299), "120-300");
  assert.equal(lengthBucket(300), "300+");
});

test("index sizes are reported as coarse buckets", () => {
  assert.equal(chunkBucket(0), "<100");
  assert.equal(chunkBucket(99), "<100");
  assert.equal(chunkBucket(100), "100-300");
  assert.equal(chunkBucket(299), "100-300");
  assert.equal(chunkBucket(300), "300-1000");
  assert.equal(chunkBucket(999), "300-1000");
  assert.equal(chunkBucket(1000), "1000+");
});

test("outside a browser the SDK is never loaded and track does nothing", async () => {
  assert.equal(await loadAnalytics(), null);
  track("repo_asked", { repo: "o/r", question_length_bucket: "<40" });
  assert.equal(await loadAnalytics(), null);
});
