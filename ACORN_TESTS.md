# Acorn Node Tests

To run the node tests, you need to have a local Acorn node running, at port 3000. Node should at least support Base Sepolia.

Before running the tests, you need to:

1. Install dependencies:

```bash
$ bun install --frozen-lockfile
```

2. set the following environment variables in your `.env` file:

```
PRIVATE_KEY=<your private key>
PRIVATE_KEY_TWO=<same as PRIVATE_KEY>
TESTNET_CHAIN_ID=84532
MAINNET_CHAIN_ID=84532
ALCHEMY_API_KEY=<your alchemy api key>
ACORN_NODE_URL=http://localhost:3000
```
Private key here is the owner of the test smart account. It will also be used to fund the test smart account with test ETH and test USDC.

2. run the following command to fund your test smart account:

```bash
$ bun run fund:nexus
```
This command will try sending 0.001 ETH and 1 USDC to your test smart account, on baseSepolia. If you don't have enought balance on your private key, you can get some USDC from circle faucet [here](https://faucet.circle.com/).

3. run the following command to run the MEE node tests:

```bash
$ bun run test:watch -t=mee
```
