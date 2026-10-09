import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Static export for GitHub Pages is opt-in; the default build targets a Node host such as Vercel.
const pages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  // Keep onnxruntime-node / @huggingface/transformers as real Node
  // require()s instead of letting Vercel's bundler trace and inline them —
  // onnxruntime-node ships a native .node binary that isn't a JS module and
  // breaks when bundled (ERR: "Cannot find module 'onnxruntime-node'" at
  // runtime). This only affects app/api/mcp/route.ts (the only server code
  // importing lib/embedder.server.ts); the browser bundle is untouched.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  outputFileTracingIncludes: {
    // onnxruntime-node's native binding is loaded via createRequire(), which
    // Next's file tracer doesn't follow statically — it has to be included
    // explicitly or the deployed function is missing the module entirely.
    // Key is the route *path* ("/api/mcp"), not the source file name
    // ("app/api/mcp/route") — the latter silently matches nothing.
    "/api/mcp": [
      "./node_modules/onnxruntime-node/**",
      "./node_modules/onnxruntime-common/**",
    ],
  },
  ...(pages
    ? { output: "export", trailingSlash: true, images: { unoptimized: true }, basePath: process.env.PAGES_BASE_PATH ?? "" }
    : { async headers() { return [{ source: "/:path*", headers: securityHeaders }]; } }),
};

export default nextConfig;
