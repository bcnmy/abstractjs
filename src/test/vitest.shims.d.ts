declare module "vitest" {
  export interface ProvidedContext {
    settings: {
      runPaidTests: boolean
    }
  }
}

// mark this file as a module so augmentation works correctly
export {}
