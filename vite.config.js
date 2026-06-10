import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any path: the interim
  // GitHub Pages URL (…github.io/WFM_pimple_model/) AND the final
  // custom domain (tools.workflowmax.com root), plus iframe embeds.
  base: "./",
  plugins: [react()],
  server: {
    open: true,
  },
});
