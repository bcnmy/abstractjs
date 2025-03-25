import { config } from "dotenv"

config()

// @ts-ignore
export const setup = async ({ provide }) => {
  //globalConfig = await initAnvilNetwork()
  const runPaidTests = process.env.RUN_PAID_TESTS?.toString() === "true"
  //const { bundlerInstance, instance, ...serializeableConfig } = globalConfig
  provide("settings", { runPaidTests })
}

export const teardown = async () => {
  await Promise.all([
    //globalConfig.instance.stop(),
    //globalConfig.bundlerInstance.stop()
  ])
}

declare module "vitest" {
  export interface ProvidedContext {
    settings: { runPaidTests: boolean }
  }
}
