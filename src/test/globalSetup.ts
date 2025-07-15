import { config } from "dotenv"

config()

export const setup = async ({ provide }) => {
  const runPaidTests = process.env.RUN_PAID_TESTS?.toString() === "true"
  const runLifecycleTests =
    process.env.RUN_LIFECYCLE_TESTS?.toString() === "true"

  provide("settings", { runPaidTests, runLifecycleTests })
}

export const teardown = async () => {}

declare module "vitest" {
  export interface ProvidedContext {
    settings: { runPaidTests: boolean; runLifecycleTests: boolean }
  }
}
