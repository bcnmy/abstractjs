[![Biconomy](https://img.shields.io/badge/Made_with_%F0%9F%8D%8A_by-Biconomy-ff4e17?style=flat)](https://biconomy.io)
[![Build](https://github.com/bcnmy/abstractjs/actions/workflows/build.yml/badge.svg)](https://github.com/bcnmy/abstractjs/actions)
[![License MIT](https://img.shields.io/badge/License-MIT-blue?&style=flat)](./LICENSE) 
[![codecov](https://codecov.io/github/bcnmy/abstractjs/graph/badge.svg?token=DTdIR5aBDA)](https://codecov.io/github/bcnmy/abstractjs) 
[![install size](https://packagephobia.com/badge?p=@biconomy/abstractjs)](https://packagephobia.com/result?p=@biconomy/abstractjs)

# abstractjs 🚀

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/bcnmy/abstractjs)

The Biconomy SDK is your all-in-one toolkit for building decentralized applications (dApps) with **ERC4337 Account Abstraction** and **Smart Accounts**. It is designed for seamless user experiences and offers non-custodial solutions for user onboarding, sending transactions (userOps), gas sponsorship and much more.

## 📚 Table of Contents

- [SDK 🚀](#sdk-)

  - [📚 Table of Contents](#-table-of-contents)
  - [🛠️ Quickstart](#-quickstart)
    - [Installation](#installation)
    - [Testing](#testing)
  - [📄 Documentation and Resources](#-documentation-and-resources)
  - [💼 Examples](#-examples)
  - [License](#license)
  - [Connect with Biconomy 🍊](#connect-with-biconomy-)

## 🛠️ Quickstart

### Installation

1. **Add the package:**
```bash
bun add @biconomy/abstractjs viem @rhinestone/module-sdk
```

2. **Basic Usage:**
```typescript
import { toMultichainNexusAccount, mcUSDC } from "@biconomy/abstractjs";
import { base, optimism } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { http } from "viem";
const eoaAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)
const mcNexus = await toMultichainNexusAccount({
  chains: [base, optimism],
  transports: [http(), http()],
  signer: eoaAccount
})
const meeClient = await createMeeClient({ account: mcNexus })

const quote = await meeClient.getQuote({
  instructions: [{
    calls: [{ to: "0x...", value: 1n, gasLimit: 100000n }],
    chainId: base.id
  }],
  feeToken: {
    address: mcUSDC.addressOn(base.id),
    chainId: base.id
  }
})

// Execute the quote and get back a transaction hash
// This sends the transaction to the network
const { hash } = await meeClient.executeQuote({ quote })
```

### Testing

**Prerequisites:**
- [Node.js](https://nodejs.org/en/download/package-manager) *(v22 or higher)*
- [Bun](https://bun.sh/) package manager
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Yarn](https://www.npmjs.com/package/yarn) *(must be 1.1.x, not 3.x)*. This is necessary because the nexus contracts repo relies on yarn.

**Setup:**
```bash
bun install --frozen-lockfile
```

**Funding test accounts:**

```bash
# Fund test nexus accounts with native tokens and USDC, using a funded PRIVATE_KEY master account
bun run fund:nexus
```

**Running Tests:**
```bash
# Run all tests
bun run test

# Run tests in watch mode for a specific subset of tests (by test description)
bun run test:watch -t=mee
```

For detailed information about the testing framework, network configurations, and debugging guidelines, please refer to our [Testing Documentation](./src/test/README.md).

## 📄 Documentation and Resources

For a comprehensive understanding of our project and to contribute effectively, please refer to the following resources:

- [**Biconomy Documentation**](https://docs.biconomy.io)
- [**Biconomy Dashboard**](https://dashboard.biconomy.io)
- [**API Documentation**](https://bcnmy.github.io/abstractjs)
- [**Contributing Guidelines**](./CONTRIBUTING.md): Learn how to contribute to our project, from code contributions to documentation improvements.
- [**Code of Conduct**](./CODE_OF_CONDUCT.md): Our commitment to fostering an open and welcoming environment.
- [**Security Policy**](./SECURITY.md): Guidelines for reporting security vulnerabilities.
- [**Changelog**](./CHANGELOG.md): Stay updated with the changes and versions

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details

## Connect with Biconomy 🍊

[![Website](https://img.shields.io/badge/🍊-Website-ff4e17?style=for-the-badge&logoColor=white)](https://biconomy.io) [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/biconomy) [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/biconomy) [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/biconomy) [![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/biconomy) [![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/channel/UC0CtA-Dw9yg-ENgav_VYjRw) [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/bcnmy/)