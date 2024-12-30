import { expect, test, describe } from "bun:test";
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  bsc,
  optimism,
  optimismSepolia,
  polygon,
  scroll,
  sepolia,
  zksync,
  zksyncSepoliaTestnet,
} from "viem/chains";
import { createMeeService } from "../mee.service";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  Hash,
  http,
  parseAbi,
  parseUnits,
  publicActions,
  zeroAddress,
} from "viem";
import { toMultichainNexusAccount } from "../account-vendors/nexus/multichain-nexus.account";
import { executeFusionTransaction } from "../fusion";
import { supertransaction } from "../utils/syntax/supertransaction-builder.util";
import { getMultichainContract } from "../utils/contract/getMultichainContract";
import { toMeeCompliantNexusAccount } from "../account-vendors";
import { buildCall, buildMeeUserOp } from "../workflow";
import { resolveFeeToken, signMeeQuote } from "../utils";

const PRIV_KEY = Bun.env.TEST_PRIVATE_KEY! as Hash;

describe("Private key", () => {
  test("Should have private key", () => {
    expect(PRIV_KEY).toBeTruthy();
    expect(PRIV_KEY).toStartWith("0x");
  });
});

describe("Nexus Account", async () => {
  const eoa = privateKeyToAccount(PRIV_KEY);

  const mcNexusTestnet = await toMultichainNexusAccount({
    chains: [baseSepolia, optimismSepolia],
    signer: eoa,
  });

  const mcNexusMainnet = await toMultichainNexusAccount({
    chains: [optimism, base, polygon, arbitrum, avalanche, scroll, bsc],
    signer: eoa,
  });

  test("Mainnets should work", async () => {
    expect(mcNexusMainnet.deployments.length).toEqual(7);
  });

  test("Should initialize Nexus account", async () => {
    expect(mcNexusTestnet.deployments.length).toEqual(2);
  });

  test("Should be same address on base and optimism", async () => {
    expect(mcNexusTestnet.deploymentOn(baseSepolia.id).address).toEqual(
      mcNexusTestnet.deploymentOn(optimismSepolia.id).address
    );
  });

  const nexus = await toMeeCompliantNexusAccount({
    chain: optimism,
    signer: eoa,
    transport: http(),
  });

  test("Should initialize single chain MEE Compliant Nexus Account", async () => {
    expect(nexus.address).toStartWith("0x");
  });

  test("Nexus should sign message", async () => {
    const signed = await nexus.signMessage({
      message: {
        raw: "0xABC",
      },
    });
    expect(signed).toStartWith("0x");
  });
});

describe("MEE Service", async() => {

  const eoa = privateKeyToAccount(PRIV_KEY)

  const mcNexus = await toMultichainNexusAccount({
    chains: [optimism, base],
    signer: eoa
  })
  
  const meeService = createMeeService({
    meeNodeUrl: 'https://mee-node.biconomy.io'
  })

  test('Should init meeService', async() => {
    expect(meeService.execute).toBeTruthy()
  })

  const uOp = buildMeeUserOp({
    calls: [
      { to: zeroAddress, value: 0n, gasLimit: 50_000n }
    ]
  })

  test('Should encode an MEEUserOp', async() => {
    expect(uOp.calls.length).toEqual(1)
  })

  test('Should cast PartialMeeUserOp to MeeUserOp', async() => {
    const casted = uOp.on(optimism.id)
    expect(casted.chainId).toEqual(optimism.id)
  })

  test('Should build call', () => {
    const data = '0xabc'
    const value = 10n
    const gasLimit = 50_000n

    const call = buildCall({
      gasLimit: gasLimit,
      to: zeroAddress,
      value: value,
      data: data
    })
    expect(call.data).toEqual(data)
    expect(call.value).toEqual(value)
    expect(call.to).toEqual(zeroAddress)
    expect(call.gasLimit).toEqual(gasLimit)
  })

  // The E2E tests are not sufficient, nor good. They depend on having funds 
  // on optimism and base and depend on public testnets. A local testing environment 
  // needs to be set up. These tests are sufficient while we're in the experimental 
  // phase of development.
  describe('E2E Flow: Executes a TX on Base, Pays for gas on OP', async () => {

    const quote = await supertransaction()
      .injectAccount(mcNexus)
      .payGasWith('USDC', { on: optimism.id })
      .addInstructions(
        buildMeeUserOp({
          calls: {
            to: zeroAddress,
            gasLimit: 50_000n,
            value: 0n
          },
          chainId: base.id
        }))
      .getQuote(meeService)

    test('Should get quote', async() => {
      expect(quote.hash).toStartWith('0x')
    }, { timeout: 10000 })  

    const reciept = await meeService.execute(
      await signMeeQuote({
        executionMode: 'direct-to-mee',
        quote: quote,
        signer: eoa
      })
    )

    test('Should get reciept', async() => {
      console.log('Hash: ', reciept.hash)
      expect(reciept.hash).toStartWith('0x')
    }, { timeout: 10000 })
  })

})
