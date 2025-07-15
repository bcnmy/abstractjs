// vitest.d.ts
import "vitest"

declare module "vitest" {
  interface ProvidedContext {
    settings: {
      runPaidTests: boolean
    }
  }
}

export {}
