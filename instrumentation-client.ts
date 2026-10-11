// Client-side instrumentation (Next.js `instrumentation-client` convention).
//
// Deliberately tiny: the analytics SDK is only imported (dynamically) when a
// public key is configured, so visitors of a deployment without analytics
// never download it. Loading waits for an idle moment so it never competes
// with hydration or the embedding worker. See lib/analytics.ts.
import { analyticsEnabled, loadAnalytics } from "@/lib/analytics";

if (analyticsEnabled) {
  const start = () => void loadAnalytics();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 1500);
  }
}
