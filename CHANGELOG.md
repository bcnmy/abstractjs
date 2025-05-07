# @biconomy/abstractjs

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
