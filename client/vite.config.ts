/// <reference types="vite/client" />

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { sentryPlugin7 } from "@swifty.js/sentry/vite";

const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig(({ isPreview, command }) => ({
  plugins: [react(), tailwindcss(), sentryPlugin7({ dsn: "/sentry" })],
  server: {
    headers: crossOriginIsolationHeaders,
    // proxy
  },
  preview: { headers: crossOriginIsolationHeaders },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
