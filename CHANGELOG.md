# @biconomy/abstractjs

## 0.0.39

### Patch Changes

- Nexus init using custom validator
  - BREAKING: `getMeeFactoryData` helper now renamed to `getDefaultFactoryData`
  - BREAKING: `getMeeNexusAddress` helper now renamed to `getDefaultNexusAddress`
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
