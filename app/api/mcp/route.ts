/**
 * Agent-facing entrypoint: MCP (Model Context Protocol) over Streamable HTTP.
 * Exposes the exact same engine the human UI (app/page.tsx) uses — see
 * lib/mcp-server.ts (tool registration) and lib/engine.server.ts (indexing +
 * retrieval, built on lib/indexer.ts/lib/chunk.ts/lib/vector.ts/lib/rag.ts,
 * the identical modules app/page.tsx calls client-side).
 *
 * Uses the SDK's WebStandardStreamableHTTPServerTransport, which speaks Web
 * Standard Request/Response directly — the natural fit for a Next.js App
 * Router route handler (no Node IncomingMessage/ServerResponse adapter
 * needed, unlike repoask-mcp's Vercel function wrapper which targets the
 * classic Node http API).
 *
 * Runs STATELESS (sessionIdGenerator: undefined): a fresh McpServer +
 * transport per request. This is the documented pattern for serverless hosts
 * (Vercel functions aren't guaranteed to reuse the same warm instance across
 * requests), matching the approach already proven in the sibling
 * repoask-mcp project.
 *
 * Must run on the Node.js runtime (not Edge): @huggingface/transformers needs
 * Node APIs (onnxruntime-node) to run the embedding model.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRepoaskServer } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return Response.json({
    name: "repoask",
    transport: "streamable-http",
    mcpEndpoint: "/api/mcp",
    status: "ok",
  });
}

export async function POST(req: Request) {
  const server = createRepoaskServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Plain JSON response instead of an SSE stream: simpler and sufficient
    // for stateless request/response tool calls, and avoids any ambiguity
    // around long-lived streams on a serverless function.
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (err) {
    console.error("MCP request error:", err);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
      { status: 500 },
    );
  } finally {
    await transport.close();
    await server.close();
  }
}
