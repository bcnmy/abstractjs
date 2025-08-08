import {
  Implementation,
  type MetaMaskSmartAccount,
  toMetaMaskSmartAccount
} from "@metamask/delegation-toolkit"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type Transport,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  parseEther,
  parseUnits,
  zeroAddress
} from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { waitForTransactionReceipt } from "viem/actions"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  DEFAULT_GAS_LIMIT,
  type FeeTokenInfo,
  type Instruction,
  type Trigger,
  executeSignedQuote,
  getFusionQuote,
  waitForSupertransactionReceipt
} from "."
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { getBalance } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import type { NexusAccount } from "../../../account/toNexusAccount"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account/utils/getMultichainContract"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion, toMeeK1Module } from "../../../modules"
import {
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules/utils/composabilityCalls"
import {
  DEFAULT_PATHFINDER_API_KEY,
  DEFAULT_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import getMmDtkQuote from "./getMmDtkQuote"
import { signMMDtkQuote } from "./signMmDtkQuote"

// @ts-ignore
const { runPaidTests } = inject("settings")

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
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: transports[0],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: transports[1],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
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

  test("should trigger have a default gas limit as 75K gas", async () => {
    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }

    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress,
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [transfer],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect(fusionQuote.trigger.gasLimit).toBe(DEFAULT_GAS_LIMIT)

    expect(fusionQuote.quote.paymentInfo.callGasLimit).toBe(
      DEFAULT_GAS_LIMIT.toString()
    )

    const gasLimit = transfer[0].calls.reduce((acc, call) => {
      const gas = call?.gasLimit || LARGE_DEFAULT_GAS_LIMIT
      return gas + acc
    }, 0n)

    expect(fusionQuote.quote.userOps[1]).toBeDefined()
    expect(fusionQuote.quote.userOps[1].userOp.callGasLimit).to.eq(
      (DEFAULT_GAS_LIMIT + gasLimit).toString()
    )
  })

  test("should trigger have a custom gas limit", async () => {
    const customGasLimit = 100_000n

    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n,
      gasLimit: customGasLimit
    }

    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress,
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [transfer],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect(fusionQuote.trigger.gasLimit).toBe(customGasLimit)

    expect(fusionQuote.quote.paymentInfo.callGasLimit).toBe(
      customGasLimit.toString()
    )

    const gasLimit = transfer[0].calls.reduce((acc, call) => {
      const gas = call?.gasLimit || LARGE_DEFAULT_GAS_LIMIT
      return gas + acc
    }, 0n)

    expect(fusionQuote.quote.userOps[1]).toBeDefined()
    expect(fusionQuote.quote.userOps[1].userOp.callGasLimit).to.eq(
      (customGasLimit + gasLimit).toString()
    )
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
      useMaxAvailableFunds: true
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

  test.runIf(runPaidTests)("should execute a signed quote", async () => {
    const cicdAddress = "0xD5Fe79C09CDF3D279cD87B5CAdC77517D65274ca"
    const chainId = paymentChain.id
    const amount = 11n

    const trigger: Trigger = {
      chainId,
      tokenAddress,
      amount
    }

    // install new mee validator on the mcNexus
    /// ==============  SINCE THE MEE K1 MODULE WITH MMDTK SUPPORT IS NOT SUPPORTED YET AS A DEFAULT MODULE, =========
    // ===============  WE NEED TO INSTALL AND ACTIVATE IT MANUALLY  ==============
    const meeK1ModuleWithMMDTKSupportAddress =
      "0x4076c12AB82dD23Eb7b1755d3454E89CEEA46c47"
    const meeK1ModuleWithMMDTKSupportCode = await pubClient.getCode({
      address: meeK1ModuleWithMMDTKSupportAddress,
      blockTag: "latest"
    })
    const isDeployed = meeK1ModuleWithMMDTKSupportCode !== "0x"
    if (!isDeployed) {
      throw new Error(
        `MeeK1ModuleWithMMDTKSupport is not deployed at ${meeK1ModuleWithMMDTKSupportAddress}`
      )
    }

    const meeK1ModuleWithMMDTKSupport = toMeeK1Module({
      signer: eoaAccount,
      module: meeK1ModuleWithMMDTKSupportAddress,
      signatureType: "mm-dtk"
    })

    const mcNexusWithMMDTKSupport = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: transports[0],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: transports[1],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ],
      validators: [meeK1ModuleWithMMDTKSupport]
    })

    const mcNexusAddress = mcNexusWithMMDTKSupport.addressOn(
      paymentChain.id,
      true
    )

    const activeValidator = (
      mcNexusWithMMDTKSupport.deploymentOn(
        paymentChain.id,
        true
      ) as NexusAccount
    ).getModule()
    if (activeValidator.address !== meeK1ModuleWithMMDTKSupport.address) {
      console.log("activeValidator", activeValidator)
      console.log("setting new validator")
      ;(
        mcNexusWithMMDTKSupport.deploymentOn(
          paymentChain.id,
          true
        ) as NexusAccount
      ).setModule(meeK1ModuleWithMMDTKSupport)
    }

    // ========= deploy the mmDtkAccount =========
    if (!(await mmDtkAccount.isDeployed())) {
      console.log("mmDtkAccount is not deployed")
      console.log("deploying mmDtkAccount")

      // fund the mmDtkAccount
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain: paymentChain,
        transport: transports[0]
      })

      const fundMmDtkAccountHash = await walletClient.sendTransaction({
        to: mmDtkAccount.address,
        value: parseEther("0.001")
      })

      await waitForTransactionReceipt(pubClient, { hash: fundMmDtkAccountHash })

      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/10/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        )
      })
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice()

      const bundlerClient = createBundlerClient({
        client: pubClient,
        transport: http(
          `https://public.pimlico.io/v2/10/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        )
      })

      const userOperationHash = await bundlerClient.sendUserOperation({
        account: mmDtkAccount,
        calls: [
          {
            to: "0x1234567890123456789012345678901234567890",
            value: parseUnits("1", 0)
          }
        ],
        ...fee
      })

      const { receipt: mmDtkAccountReceipt } =
        await bundlerClient.waitForUserOperationReceipt({
          hash: userOperationHash
        })
    }
    // ==================

    const transferInstruction = await mcNexusWithMMDTKSupport.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: cicdAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)]
        })
      }
    })

    // TODO: remove this once all the nodes are upgraded to have MM DTK support on the node level
    const meeClientWithMMDTKSupport = await createMeeClient({
      account: mcNexusWithMMDTKSupport,
      apiKey: DEFAULT_PATHFINDER_API_KEY,
      url: DEFAULT_PATHFINDER_URL
    })

    const fusionQuote = await getMmDtkQuote(meeClientWithMMDTKSupport, {
      trigger,
      instructions: [transferInstruction],
      feeToken,
      delegatorSmartAccount: mmDtkAccount,
      moduleAddress: meeK1ModuleWithMMDTKSupportAddress
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    const signedQuote = await signMMDtkQuote(meeClientWithMMDTKSupport, {
      fusionQuote,
      delegatorSmartAccount: mmDtkAccount
    })

    const cicdAddressBalanceBefore = await getBalance(
      pubClient,
      cicdAddress,
      tokenAddress
    )

    const { hash } = await executeSignedQuote(meeClient, { signedQuote })
    const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    const cicdAddressBalanceAfter = await getBalance(
      pubClient,
      cicdAddress,
      tokenAddress
    )

    expect(cicdAddressBalanceAfter).toBe(cicdAddressBalanceBefore + amount)
  })
})
