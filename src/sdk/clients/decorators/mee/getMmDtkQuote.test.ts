import {
  Implementation,
  type MetaMaskSmartAccount,
  toMetaMaskSmartAccount
} from "@metamask/delegation-toolkit"
import {
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type Transport,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  parseUnits,
  zeroAddress
} from "viem"
import { readContract } from "viem/actions"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type FeeTokenInfo,
  type Instruction,
  type Trigger,
  executeSignedQuote,
  getFusionQuote,
  getPermitQuote,
  signPermitQuote,
  waitForSupertransactionReceipt
} from "."
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { getBalance } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import {
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules/utils/composabilityCalls"
import {
  DEFAULT_MEE_NODE_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import getMmDtkQuote from "./getMmDtkQuote"
import { signMMDtkQuote } from "./signMmDtkQuote"

describe("mee.getMmDtkQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]
  let mmDtkAccount: MetaMaskSmartAccount<Implementation.Hybrid>
  let decimals: number
  let pubClient: PublicClient

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    pubClient = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    decimals = await pubClient.readContract({
      address: feeToken.address,
      abi: erc20Abi,
      functionName: "decimals"
    })

    mmDtkAccount = await toMetaMaskSmartAccount({
      client: pubClient,
      implementation: Implementation.Hybrid,
      deployParams: [eoaAccount.address, [], [], []],
      deploySalt: "0x", // ==> 0x81b6A728E32aB3210A45d26c0c1530d8940Feb31
      signatory: { account: eoaAccount }
    })

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: process.env.PERSONAL_MEE_API_KEY
    })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)

    //
    // === Fund the mmDtkAccount if it has no balance ===
    //
    const mmDtkAccountBalance = await getBalance(
      pubClient,
      mmDtkAccount.address,
      tokenAddress
    )

    if (mmDtkAccountBalance < parseUnits("0.1", decimals)) {
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain: paymentChain,
        transport: transports[0]
      })
      await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [mmDtkAccount.address, parseUnits("0.112345", decimals)]
      })
    }
  })

  test("should resolve instructions", async () => {
    const trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      },
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      }
    ]

    expect(instructions).toBeDefined()
    expect(instructions.length).toEqual(2)

    const quote = await getMmDtkQuote(meeClient, {
      trigger,
      instructions,
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const fusionQuote = await getMmDtkQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            amount: 1n,
            mcToken: mcUSDC,
            toChain: targetChain
          }
        }),
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    expect(fusionQuote.quote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect([3, 4].includes(fusionQuote.quote.userOps.length)).toBe(true) // 3 or 4 depending on if bridging is needed
  })

  test("should reserve gas fees when using max available amount", async () => {
    const totalBalance = await getBalance(
      pubClient,
      mmDtkAccount.address,
      tokenAddress
    )

    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      useMaxAvailableAmount: true
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(paymentChain.id, true),
          tokenAddress
        }),
        chainId: paymentChain.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(totalBalance)

    // Verify that the amount is usable (not negative)
    expect(fusionQuote.trigger.amount).toBeGreaterThan(0n)
  })

  // TODO: unskip this once
  // This test uses all available usdc on the eoa on mainnet, so should be skipped
  test("should demo behaviour of max available amount", async () => {
    const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const chainId = paymentChain.id
    const mcNexusAddress = mcNexus.addressOn(paymentChain.id, true)
    const trigger: Trigger = {
      chainId,
      tokenAddress,
      useMaxAvailableAmount: true
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: vitalik,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)]
        })
      }
    })

    const fusionQuote = await getMmDtkQuote(meeClient, {
      trigger,
      instructions: [transferInstruction], // inx 1 => transferFrom (Runtime) + Dev userOps
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    const signedQuote = await signMMDtkQuote(meeClient, {
      fusionQuote,
      delegatorSmartAccount: mmDtkAccount
    })
    console.log("signedQuote", signedQuote)
    /*
    const { hash } = await executeSignedQuote(meeClient, { signedQuote })

    const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    */
  })

  test("should add gas fees to amount when not using max available amount", async () => {
    const amount = parseUnits("0.0295", decimals) // some fraction of the unit of token
    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount
      // max not set, should default to false
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(paymentChain.id, true),
          tokenAddress
        }),
        chainId: paymentChain.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // The final amount should be the initial amount plus gas fees
    expect(fusionQuote.trigger.amount).toBe(
      amount + BigInt(fusionQuote.quote.paymentInfo.tokenWeiAmount)
    )
  })
})
