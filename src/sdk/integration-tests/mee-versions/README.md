# MEE Multi-Version Integration Tests

This test suite validates that all supertransaction modes work correctly across different MEE versions, ensuring backwards compatibility and proper StxValidator integration.

## Purpose

Test end-to-end supertransaction creation, signing, and execution for:
- **V2.0.0** - MeeK1Validator with PersonalSign
- **V2.2.1** - MeeK1Validator with TypedData signing
- **V3.0.0** - StxValidator with new permit data packing

## Test Files

- `setupMultiVersion.ts` - Shared utility for creating multi-version test accounts
- `no-stx.integration.test.ts` - Regular userOps without supertransaction envelope
- `simple.integration.test.ts` - Simple mode supertransactions (most common)
- `permit.integration.test.ts` - Permit mode with ERC-2612 token approvals
- `onchain.integration.test.ts` - On-chain mode with pre-approved transactions
- `safe.integration.test.ts` - Safe mode with multisig integration

## Running Tests

```bash
# Run all integration tests
bun run test integration-tests/mee-versions

# Run specific mode
bun run test no-stx.integration.test.ts
bun run test simple.integration.test.ts

# Run for specific version only (edit test file)
# Update setupMultiVersionAccounts({ versions: [MEEVersion.V3_0_0] })
```

## Test Structure

Each test file follows this pattern:

```typescript
import { setupMultiVersionAccounts } from "./setupMultiVersion"

let accountConfigs: AccountConfig[]

beforeAll(async () => {
  const network = await toNetwork("TESTNET_FROM_ENV_VARS")
  accountConfigs = await setupMultiVersionAccounts({
    eoaAccount: network.account!
  })
})

// Tests iterate over all version configs
for (const { name, version, mcNexus, meeClient } of accountConfigs) {
  describe(`${name}`, () => {
    test("should execute transaction", async () => {
      // Test logic
    })
  })
}
```

## Key Validation Points

### V3.0.0 Specific
- ✅ StxValidator address used instead of MeeK1Validator
- ✅ Permit mode uses new data packing (raw signature bytes)
- ✅ All signature modes work (simple, permit, on-chain, safe-sa, no-stx)
- ✅ Backwards compatibility maintained

### All Versions
- ✅ Account creation and funding
- ✅ Quote generation
- ✅ Signature generation with correct format
- ✅ UserOp execution
- ✅ Receipt verification
- ✅ Gas estimation accuracy
- ✅ Multi-chain coordination

## Testnets

- Base Sepolia
- Optimism Sepolia

(Selected as most commonly used in existing tests)
