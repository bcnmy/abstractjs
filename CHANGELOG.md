# @biconomy/abstractjs

## 1.1.6

### Patch Changes

- Changes included:

  1. Removed param v from the MEEAuthorization interface. So v is not mandatory anymore
  2. verificationGasLimit field will be applied for all the instructions and not just payment instruction
  3. Payment userOps will be excluded from the supertransaction status checks

## 1.1.5

### Patch Changes

- Added custom gas refund address param for the entrypoint refunds

## 1.1.4

### Patch Changes

- Features/improvements included:

  1. Native token cleanup support with fixed amounts
  2. Modular SDK - Decoupled some dependencies on batcher and builder functions to ease the SDK usage in backend environments
  3. Default cleanup userOps constraints are removed to speed up the cleanup execution
  4. Improved CommonJS and ESM build support
  5. Improved the getQuoteType util to reduce the number of RPC calls to detect the quote type
  6. Added a Nexus MEE version check bypass flag which avoid checking all the contract deployment status to improve latency in backend environments
  7. Added a utils to getGasTank for sponsorship

  Breaking changes:

  1. Intent builder interface has changed a bit. Token field expects both mcToken and unified balance now

  ```
  mcNexus.build({
    type: "intent",
    data: {
      depositor: mcNexus.addressOn(paymentChain.id, true),
      recipient: mcNexus.addressOn(targetChain.id, true),
      amount: 1n,
      token: {
        mcToken: mcUSDC,
        unifiedBalance: await mcNexus.getUnifiedERC20Balance(mcUSDC)
      },
      toChainId: targetChain.id
    }
  })
  ```

  2. `getPaymentToken` method has been renamed into `getSupportedFeeToken` now

## 1.1.3

### Patch Changes

- Improved the permit token on-chain details fetch with batched multicall for better performance

## 1.1.2

### Patch Changes

- Added fallback version for permit flow

## 1.1.1

### Patch Changes

- Features included:

  1. Multichain 7702 authorization support.
  2. Permit fusion mode improvements to cover more permit based tokens
  3. SDK test case revamp
  4. More across spoke pools are integration for composable across wrapper

## 1.1.0

### Minor Changes

- Features included:

  1. MEE versioning - Version aware SDK which enables developers to use four different MEE versions based on their needs. Currently the SDK support MEE versions 1.0.0, 1.1.0, 2.0.0 and 2.1.0. Check documentation for more info on this
  2. Modular Signing utils for preparing the signable payload and prepare executable signed quote. This enables the abstractjs to be used in backend
  3. Across intent wrapper - A composable across wrapper which enables composable bridge swaps with the help of MEE composability stack

  Breaking changes:

  1. MEE version needs to be added explicitly for all the nexus or multichain nexus instances. Field such as chains, transports are removed and grouped with a object called chainConfigurations. This object defines the chain, transport and version for nexus account and MEE stack. Check the docs for more info

## 1.0.22

### Patch Changes

- Fixed the verification gas limit issue for metamask delegation toolkit fusion mode

## 1.0.21

### Patch Changes

- fixed the metamask delegation toolkit import issues

## 1.0.20

### Patch Changes

- Fixed the metamask delegation tool kit peer dependency issue

## 1.0.19

### Patch Changes

- Features released:

  1. Eth forwarder - It enables native token to be transferred via trigger
  2. Custom trigger call - It enables the developer to define custom call in trigger instead of just token triggers
  3. Metamask DTK - Experimental metamask delegation flow is supported
  4. Custom Recipient for token triggers - It enables developers to add a custom recipient address for token transfers in trigger
  5. Custom Recipient for Eth Forwarder - It enables developers to add a custom recipient address for native currency transfers in trigger
  6. Max available Eth Forwarder transfer - It enables developers to transfer maximum available native tokens excluding gas fee via trigger
  7. Custom fee payer - This enables anyone to provide custom fee payer address which will take care of fee payment via pre approved allowance
  8. Code and test suite improvements

## 1.0.18

### Patch Changes

- Features included:

  1. Self hosted sponsorship support where the developers can utilize third party sponsorship services to sponsor the super transactions
  2. toGasTankAccount support addded. This helps self hosted sponsorship developers to manage gas tanks easily
  3. Eth Forwarder - A fusion flow for native tokens. This enables anyone to trigger Native tokens to their SCA accounts
  4. One click template builder is added. This lets the developer to easily build cross chain actions easily to have a one click experience

## 1.0.17

### Patch Changes

- Features includes:

  1. Multichain smart session support is added
  2. Nexus 102 support is added
  3. New mee node changes have been adjusted

## 1.0.16

### Patch Changes

- Improved error handling and added a utility function chainToAddressMap

## 1.0.15

### Patch Changes

- Added support for custom gas limit for payment and cleanup userops and increased the cleanup execution window

## 1.0.14

### Patch Changes

- Added support for MEE biconomy hosted sponsorship and enhanced the max fund usage in trigger (include fee -> useMaxAvailableFunds)

## 1.0.13

### Patch Changes

- remove log

## 1.0.12

### Patch Changes

- add explorer catch

## 1.0.11

### Patch Changes

- auths

## 1.0.10

### Patch Changes

- Fix gasLimit bug

## 1.0.9

### Patch Changes

- Fusion gasLimit

## 1.0.8

### Patch Changes

- Change maxAvailableAmount -> includeFee

## 1.0.7

### Patch Changes

- Fix wallet client bug with browsers

## 1.0.6

### Patch Changes

- Fix for includeFee
- signTransaction signer fix

## 1.0.5

### Patch Changes

- Cleanups
- Improved gas efficiency
- 7702 replay support

## 1.0.4

### Patch Changes

- Added a includeFee to trigger

## 1.0.3

### Patch Changes

- 7702 support

## 1.0.2

### Patch Changes

- Raw call data

## 1.0.1

### Patch Changes

- - Added callData helper for composability
  - Improved error reporting during tests
  - Fix 6492 signature verification

## 1.0.0

### Minor Changes

#### Breaking Changes

- Added composability module by default resulting in a change of address for all users of latest SDK
- Renamed `getDefaultFactoryData` to `getFactoryData` for more generic module support
- Renamed `getDefaultNexusAddress` to `getlNexusAccount` to reflect universal module initialization
- Updated module initialization structure to support any validator type extending BaseModule
- Changed module configuration format to require explicit type declarations

#### Features

- Added universal module initialization support for Nexus accounts
- Same account for both mee and 4337 flows
- Introduced flexible module configuration system allowing extended properties
- Added support for custom bootstrap addresses during account initialization
- Implemented smart session helpers for improved session management
- Added new utility functions `toInitData` and `toInstallData` for standardized module formatting
- Added composability module for multi-transaction batching in a single userOp
- Added support for Nexus v1.2.0 with improved composability features
- Added custom gas limits for composability calls
- Added EIP-6492 compatibility for account signatures
- Integrated userOp status reporting and receipt tracking

#### Improvements

- Enable mode for smart sessions by default
- Streamlined factory data and counterfactual address calculations
- Enhanced type safety for module configurations
- Improved error handling for module initialization
- Reduced bundle size through code optimization (-5.45% ESM, -7.42% CJS)
- Added comprehensive test coverage for new module initialization flows
- Improved status reporting for userOps
- Fixed initCode computation for accurate counterfactual address generation
- Enhanced batch builder with better composability checks

## 0.3.0

### Minor Changes

- Change attester address for Mee users. Results in change in MEE users' addresses

## 0.2.1

### Patch Changes

- Added an additional configuration to version config to cater for accounts < 0.0.34
- Added an upgradeSmartAccount decorator to the smart account client
- Added a new test for the upgradeSmartAccount decorator

## 0.2.0

### Minor Changes

- Update K1_VALIDATOR_FACTORY_ADDRESS address, resulting in changed default addresses for users

## 0.1.1

### Patch Changes

- Added GasBuffer option to increase gasValues returned from the bundler prior to sending the userOp

## 0.1.0

### Minor Changes

- Update BICONOMY_ATTESTER address, resulting in changed default addresses for users

## 0.0.41

### Patch Changes

- Improved batching logic
- Added mcWeth
- Fixed getAccountMeta helper
- Fixed EIP712Sign logic after EIP 7779 changes
- Added tests for installing & uninstalling smart sessions

## 0.0.40

### Patch Changes

- Fixed mee signer issues with metamask
- Added export for UniswapSwapRouterAbi
- Introduced optimistic mode parameter for across relayer
- Made interfacing with multichain contracts consitent while building instructions
- Added getSupertransactionReceipt helper
- Added buildBatch instruction helper

## 0.0.39

### Patch Changes

- Nexus init using custom validator
  - BREAKING: `getMeeFactoryData` helper now renamed to `getDefaultFactoryData`
  - BREAKING: `getMeeNexusAddress` helper now renamed to `getNexusAddress`
- Moved useTestBundler datapoint to the bundler client instead of the account & renamed to 'mock'.
- Use pimlico gasEstimates if string 'pimlico' is in the bundlerUrl
- Added confirmations: 2 to waitForUserOperationReceipt in signOnChainQuote helper to avoid race condition
- Changed threshold :bigint to :number in getOwnableValidator helper

## 0.0.38

### Patch Changes

- Added Fusion support
  - BREAKING: `createSmartAccountClient` now requires an explicit account instance instead of account parameters
  - BREAKING: Removed `executeSignedFusionQuote` helper
  - BREAKING: `toMultichainNexusAccount` now requires an explicit `transports` parameter, to encourate the use of paid RPCs
  - Made `createSmartAccountClient` an alias of `createBicoBundlerClient`
  - Added / modified MEE client methods:
    - getFusionQuote
    - executeFusionQuote
    - signFusionQuote
  - Additional transaction types:
    - Transfer
    - TransferFrom
    - Approve
    - Withdrawal

## 0.0.37

### Patch Changes

- MeeNode info validation
- Ownables fix for moduleInitArgs

## 0.0.36

### Patch Changes

- Fix the rhinestone module-sdk version

## 0.0.35

### Patch Changes

- Updated default attester addresses

## 0.0.34

### Patch Changes

- Add waitForConfirmedUserOperationReceipt and getUserOperationStatus decorators

## 0.0.33

### Patch Changes

- Fix paymaster + smartSessions

## 0.0.32

### Patch Changes

- 0.0.32

## 0.0.31

### Patch Changes

- move repo origin

## 0.0.30

### Patch Changes

- sdk to @biconomy/abstractjs rename

## 0.0.29

### Patch Changes

- AbstractJS rebrand
- meeNode support
- mock

## 0.0.28

### Patch Changes

- Sudo fallback for empty rules

## 0.0.27

### Patch Changes

- useRegistry false attestation fix

## 0.0.26

### Patch Changes

- Remove signature from prepareUserOperation flow

## 0.0.25

### Patch Changes

- Upgrade smart session and rhinestone sdk version

## 0.0.24

### Patch Changes

- Remove tenderlyUrl from env vars

## 0.0.23

### Patch Changes

- Remove isTesting helper from testing framework

## 0.0.22

### Patch Changes

- Smart sessions enable mode

## 0.0.21

### Patch Changes

- Add support for token paymaster with helper functions

## 0.0.20

### Patch Changes

- Counterfactual address helper export

## 0.0.18

### Patch Changes

- fix window.ethereum

## 0.0.17

### Patch Changes

- Add mock attestor only for testnets

## 0.0.16

### Patch Changes

- Add mock attestor and option to include attestors during createAccount

## 0.0.15

### Patch Changes

- Migrate to Nexus: b4d6ff463bc41dc232292c385bdb76814ca8689c

## 0.0.14

### Patch Changes

- Add rhintestones attestation address during createAccount

## 0.0.13

### Patch Changes

- Fix getAddress()

## 0.0.12

### Patch Changes

- Policy support

## 0.0.11

### Patch Changes

- Fix WalletClient signer

## 0.0.10

### Patch Changes

- Added Distributed Session Keys w/ Ownable & Session examples

## 0.0.9

### Patch Changes

- Added DAN helpers, keyGen + sigGen

## 0.0.8

### Patch Changes

- Paymaster script fix

## 0.0.7

### Patch Changes

- Include missing deps

## 0.0.5

### Patch Changes

- Alter sessions terminology

## 0.0.4

### Patch Changes

- renamed validator modules

## 0.0.3

### Patch Changes

- modules dx improvements

## 0.0.0
