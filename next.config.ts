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
  // Inlines the analytics key at build time, as "" when unset. Without this an
  // unset variable stays a runtime lookup under Turbopack, so the analytics SDK
  // chunk would still be emitted and the dynamic import could not be dead code.
  env: { NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "" },
  ...(pages
    ? { output: "export", trailingSlash: true, images: { unoptimized: true }, basePath: process.env.PAGES_BASE_PATH ?? "" }
    : {
        async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
        // Same-origin proxy for analytics: tracking blockers filter by domain.
        // Order matters: static and array before the catch-all. No traffic
        // until NEXT_PUBLIC_POSTHOG_KEY is set. The static export has no
        // server to rewrite, so that build names the host directly instead.
        async rewrites() {
          return [
            { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
            { source: "/ingest/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
            { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
          ];
        },
        // PostHog endpoints end in "/" (e.g. /e/); Next's trailing-slash redirect would drop events.
        skipTrailingSlashRedirect: true,
      }),
};

export default nextConfig;
