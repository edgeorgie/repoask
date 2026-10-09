/**
 * MCP (Model Context Protocol) server factory for repoask. Registers the
 * same tool names/shapes as the sibling project
 * (github.com/edgeorgie/repoask-mcp) for consistency across repoask's two
 * sibling products — index_repo, ask_repo, list_indexed_repos — but calls
 * INTO lib/engine.server.ts, which reuses repoask's own
 * indexer/chunk/vector/rag logic (lib/indexer.ts etc.), not repoask-mcp's
 * separate TF-IDF engine. These are deliberately different engines behind a
 * matching tool contract, per the task: two independent products, same
 * agent-facing shape.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { doAskRepo, doIndexRepo, doListIndexedRepos } from "./engine.server";

export function createRepoaskServer(): McpServer {
  const server = new McpServer({
    name: "repoask",
    version: "0.1.0",
  });

  server.registerTool(
    "index_repo",
    {
      title: "Index a public GitHub repository",
      description:
        "Fetches a public GitHub repository's text files (source, docs, config — skips binaries, " +
        "lockfiles, node_modules/dist/build/vendor), splits them into overlapping line-range chunks " +
        "(same chunker repoask's browser UI uses), and embeds them with the local MiniLM model " +
        "(Xenova/all-MiniLM-L6-v2, no external embedding API, no paid key required) entirely on the " +
        "server. Must be called once before ask_repo for a given owner/repo. Re-calling re-indexes from " +
        "the current default branch (or a specific ref if given). Large repos are capped at 120 files / " +
        "80KB per file to keep indexing fast and free.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub organization or user, e.g. 'octocat'"),
        repo: z.string().min(1).describe("Repository name, e.g. 'Hello-World'"),
        ref: z
          .string()
          .optional()
          .describe("Optional branch, tag, or commit SHA. Defaults to the repo's default branch."),
      },
      outputSchema: {
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        fileCount: z.number().int(),
        chunkCount: z.number().int(),
        truncated: z.boolean().describe("True if GitHub's tree API truncated the file listing (very large repo)."),
        indexedAt: z.string().describe("ISO-8601 timestamp of indexing."),
      },
    },
    async ({ owner, repo, ref }) => {
      const result = await doIndexRepo(owner, repo, ref);
      return {
        content: [
          {
            type: "text",
            text:
              `Indexed ${owner}/${repo}@${result.branch}: ${result.fileCount} files -> ${result.chunkCount} chunks. ` +
              (result.truncated ? "(GitHub truncated the file tree; only a subset of the repo was seen.) " : "") +
              `Call ask_repo({ owner: "${owner}", repo: "${repo}", question: ... }) next.`,
          },
        ],
        structuredContent: { ...result },
      };
    },
  );

  server.registerTool(
    "ask_repo",
    {
      title: "Ask a question about an indexed GitHub repository",
      description:
        "Answers a natural-language question about a GitHub repository that was previously indexed with " +
        "index_repo (auto-indexes on first use if not yet indexed). Retrieves the most relevant chunks via " +
        "the same local MiniLM-embedding cosine search repoask's browser UI uses and returns them as " +
        "citations with exact path + start/end line numbers. If ANTHROPIC_API_KEY or OPENAI_API_KEY is set " +
        "in the server environment, also returns a synthesized prose answer with inline [n] citation " +
        "markers referencing the citations array. If no LLM key is configured, 'answer' is a deterministic " +
        "citation dump (no generation) and 'answerMode' is 'deterministic' — callers should treat the " +
        "citations array as the ground truth either way.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub organization or user."),
        repo: z.string().min(1).describe("Repository name."),
        question: z.string().min(3).describe("Natural-language question about the repo's code or docs."),
        topK: z.number().int().min(1).max(20).optional().describe("Number of citations to return. Default 6."),
      },
      outputSchema: {
        owner: z.string(),
        repo: z.string(),
        question: z.string(),
        answer: z.string(),
        answerMode: z.enum(["llm", "deterministic"]),
        model: z.string().optional(),
        citations: z.array(
          z.object({
            rank: z.number().int(),
            path: z.string(),
            startLine: z.number().int(),
            endLine: z.number().int(),
            score: z.number(),
            excerpt: z.string(),
          }),
        ),
      },
    },
    async ({ owner, repo, question, topK }) => {
      const result = await doAskRepo(owner, repo, question, topK ?? 6);
      return {
        content: [{ type: "text", text: result.answer }],
        structuredContent: { ...result },
      };
    },
  );

  server.registerTool(
    "list_indexed_repos",
    {
      title: "List repositories currently indexed in this server's memory",
      description:
        "Returns the owner/repo keys currently held in this server process's in-memory index cache. " +
        "Useful for debugging or to check whether index_repo needs to be called before ask_repo.",
      inputSchema: {},
      outputSchema: {
        repos: z.array(z.string()),
      },
    },
    async () => {
      const repos = doListIndexedRepos();
      return {
        content: [{ type: "text", text: repos.length ? repos.join(", ") : "(no repos indexed yet in this process)" }],
        structuredContent: { repos },
      };
    },
  );

  return server;
}
