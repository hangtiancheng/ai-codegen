/// <reference types="vite/client" />
// /// <reference types="vitest/globals" />

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: splitVendorChunks,
      },
    },
  },
  // test: {
  //   environment: "jsdom",
  //   globals: false,
  //   setupFiles: ["./tests/setup-tests.ts"],
  // },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

function splitVendorChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }
  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("react-router") ||
    id.includes("/scheduler/")
  ) {
    return "vendor-react";
  }
  if (id.includes("@tanstack")) {
    return "vendor-tanstack";
  }
  if (id.includes("marked") || id.includes("dompurify")) {
    return "vendor-markdown";
  }
  if (id.includes("lucide-react")) {
    return "vendor-icons";
  }
  if (id.includes("gsap") || id.includes("animate.css")) {
    return "vendor-motion";
  }
  return "vendor-core";
}
