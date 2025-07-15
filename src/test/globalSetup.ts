import { config } from "dotenv"

config()

export const setup = async ({ provide }) => {
  const runPaidTests = process.env.RUN_PAID_TESTS?.toString() === "true"
  provide("settings", { runPaidTests })
}

export const teardown = async () => {}

declare module "vitest" {
  export interface ProvidedContext {
    settings: { runPaidTests: boolean }
  }
}
