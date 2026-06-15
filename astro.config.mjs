import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

// Webflow Cloud serves this app at the environment mount path (/app).
// https://astro.build/config
export default defineConfig({
  base: "/app",
  output: "server",
  // Webflow Cloud docs: set assetsPrefix to the same mount path as `base`,
  // and disable Astro's CSRF origin check (Webflow proxies requests, so the
  // Origin header won't match the worker's own host).
  build: {
    assetsPrefix: "/app",
  },
  security: {
    checkOrigin: false,
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      alias: import.meta.env.PROD
        ? { "react-dom/server": "react-dom/server.edge" }
        : undefined,
    },
  },
});
