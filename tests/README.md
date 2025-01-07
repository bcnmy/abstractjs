# Testing Framework

This testing framework is set up for blockchain interaction testing using Vitest, with specific support for paid transaction testing on a network configured from environment variables (CHAIN_ID).

## Setup

## Network Options

The framework supports two network modes:

### 1. NETWORK_FROM_ENV
Uses a real network configuration from environment variables:
- Requires `TEST_PRIVATE_KEY` and `CHAIN_ID` in your `.env` file
- Connects to actual blockchain networks
- Suitable for integration testing against live networks
- Transactions will cost real gas fees

```env
TEST_PRIVATE_KEY=<your-private-key>
CHAIN_ID=<chain-id>
RUN_PAID_TESTS=true|false
```

### 2. ANVIL
Uses a local Anvil instance for testing:
- Runs on a forked version of Base Sepolia
- Automatically funds test accounts (and nexus account) with ETH and USDC
- Free transactions (no real gas costs)
- Ideal for development and CI/CD pipelines
- No environment variables needed

## Key Components

- `config.ts`: Handles network initialization, account setup, and balance verification
- `globalSetup.ts`: Manages test environment configuration, including a flag for paid tests
- `setup.ts`: Provides extended test utilities with pre-configured network settings

## Usage

1. Set up environment variables:
   ```env
   TEST_PRIVATE_KEY=<your-private-key>
   RUN_PAID_TESTS=true|false
   ```

2. Use the extended test utility in your test files:
```typescript
import { inject } from "vitest"
import { initNetwork } from "./config"

const runPaidTests = inject("runPaidTests") // This is injected from the globalSetup.ts file and set using environment variable

describe.runIf(runPaidTests)("your test suite", async() => { // use runPaidTests to conditionally run mainnet tests
    let eoa: LocalAccount
    let publicClient: PublicClient

    beforeAll(async () => {
        const network = await initNetwork("NETWORK_FROM_ENV") // or "ANVIL" for unit tests
        eoa = network.eoa // Both Eoa and NexusAccount are now guaranteed to be funded
        publicClient = network.publicClient
    })

    test("should test something", async () => {
    // Use eoa, publicClient and nexusAccount to interact with the network
    })
})
```

## Safety Features

- Balance checks ensure accounts have sufficient funds before testing
- Environment-based control prevents accidental execution of paid tests
- Automatic validation of private keys and network configuration
