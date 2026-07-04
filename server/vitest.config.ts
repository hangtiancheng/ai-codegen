import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["dist/**", "coverage/**", "src/index.ts"],
      provider: "v8",
      reporter: ["text", "html", "json"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
