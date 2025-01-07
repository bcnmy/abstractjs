import { config } from "dotenv"

config()

// @ts-ignore
export const setup = async ({ provide }) => {
  provide("runPaidTests", process.env.RUN_PAID_TESTS?.toString() === "true")
}

export const teardown = async () => {
  await Promise.all([])
}

declare module "vitest" {
  export interface ProvidedContext {
    runPaidTests: boolean
  }
}
