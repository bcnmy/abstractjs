import { test } from "vitest"
import { type NetworkConfig, initNetwork } from "./config"

export const networkTest = test.extend<{
  config: NetworkConfig
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Needed in vitest :/
  config: async ({}, use) => {
    use(await initNetwork("NETWORK_FROM_ENV"))
  }
})
