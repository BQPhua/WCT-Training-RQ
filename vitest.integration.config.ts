import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

const testEnv = config({ path: ".env.test", override: true }).parsed ?? {};

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    env: testEnv,
    fileParallelism: false,
    globalSetup: ["tests/integration/global-setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
