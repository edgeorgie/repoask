"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsEnabled, track } from "@/lib/analytics";

/**
 * Captures a `$pageview` on first load and on every client-side route
 * change. Manual rather than posthog-js's history patch, which double-fires
 * on App Router navigations. The URL comes from `location` rather than from
 * `usePathname()` because the GitHub Pages build serves under a basePath
 * that the hook strips; the hooks only decide when to re-run.
 */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = window.location.href;
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    track("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/** Renders nothing; the whole tree is skipped without a key. */
export function Analytics() {
  if (!analyticsEnabled) return null;
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
