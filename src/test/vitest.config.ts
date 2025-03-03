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
        lines: 80,
        functions: 50,
        branches: 60,
        statements: 80
      }
    },
    include: ["./src/test/**/*.test.ts", "./src/sdk/**/*.test.ts"],
    globalSetup: join(__dirname, "globalSetup.ts"),
    environment: "node",
    testTimeout: 200_000,
    hookTimeout: 60_000
  }
})
