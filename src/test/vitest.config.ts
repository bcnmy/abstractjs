import { join } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      all: false,
      provider: "istanbul",
      reporter: process.env.CI
        ? ["json-summary", "json"]
        : ["text", "json", "html"],
      exclude: [
        "**/errors/utils.ts",
        "**/_cjs/**",
        "**/_esm/**",
        "**/_types/**",
        "**/test/**"
      ],
      thresholds: {
        lines: 75,
        functions: 50,
        branches: 50,
        statements: 75
      }
    },
    include: ["./src/test/**/*.test.ts", "./src/sdk/**/*.test.ts"],
    globalSetup: join(__dirname, "globalSetup.ts"),
    environment: "node",
    testTimeout: 500_000,
    hookTimeout: 250_000,
    fileParallelism: false,
    retry: 2
  }
})
