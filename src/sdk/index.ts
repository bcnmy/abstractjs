// Main SDK entry point with comprehensive exports for all modules
// Ensures compatibility across both ESM and CommonJS build targets

// Re-export all modules for broad coverage
export * from "./account"
export * from "./modules"
export * from "./clients"
export * from "./constants"
export * from "./templates"

// Explicit exports for critical functions to ensure proper export chaining
export {
  // Account creation and management functions
  toNexusAccount,
  toMultichainNexusAccount,
  toGasTankAccount
} from "./account"

export {
  // Core module functionality and validators
  toSmartSessionsModule,
  meeSessionActions,
  smartSessionActions,
  smartSessionCalls,
  toValidator,
  toComposableExecutor,
  toComposableFallback,
  toEmptyHook,
  getMEEVersion
} from "./modules"

export {
  // Client creation and management functions
  createMeeClient,
  createBicoBundlerClient,
  createBicoPaymasterClient,
  createHttpClient
} from "./clients"

// Core constants and configuration values
export {
  MEEVersion,
  DEFAULT_MEE_VERSION,
  ENTRY_POINT_ADDRESS,
  ENTRYPOINT_SIMULATIONS_ADDRESS,
  DEFAULT_CONFIGURATIONS_BY_MEE_VERSION
} from "./constants"
