import {
  http,
  type Account,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type Transport,
  type WalletClient,
  erc20Abi,
  getAbiItem,
  parseUnits,
  toBytes,
  toFunctionSelector,
  toHex
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { toMultichainNexusAccount } from "../../sdk/account"
import {
  DEFAULT_MEE_VERSION,
  getSpendingLimitsPolicy,
  getSudoPolicy,
  getTimeFramePolicy,
  getUniversalActionPolicy,
  getUsageLimitPolicy,
  testnetMcUSDC
} from "../../sdk/constants"
import {
  type AnyData,
  type ParamRule,
  getMEEVersion,
  meeSessionActions,
  toSmartSessionsModule
} from "../../sdk/modules"
import type { GrantPermissionResponse } from "../../sdk/modules/validators/smartSessions/decorators/grantPermission"
import { TESTNET_RPC_URLS } from "../testSetup"
import { testnetMcTestUSDC, testnetMcTestUSDCP } from "../testTokens"
import { generateNewTestnetMcNexusAccountAndMeeClient } from "./generate-mc-nexus"

export const prepareForTestnetSmartSessions = async (
  paymentChain: Chain,
  targetChain: Chain,
  paymentChainPublicClient: PublicClient,
  paymentChainWalletClient: WalletClient<Transport, Chain, Account>,
  eoaAccount: LocalAccount,
  enableSessionType: "legacy" | "new" = "new",
  use7702Auth = false
) => {
  // New orchestrator account
  const { mcNexus, meeClient } =
    await generateNewTestnetMcNexusAccountAndMeeClient(
      paymentChain,
      targetChain,
      paymentChainPublicClient,
      paymentChainWalletClient,
      eoaAccount,
      {
        fundEoa: true,
        tokenType: "permit",
        amount: parseUnits("2", 6),
        ...(use7702Auth ? { walletMode: "7702" } : {})
      }
    )

  const paramRule: ParamRule = {
    condition: 1, // EQUAL
    isLimited: false,
    offset: 0n,
    ref: toHex(toBytes("0x", { size: 32 })),
    usage: { limit: BigInt(0), used: BigInt(0) }
  }

  const universalActionPolicy = getUniversalActionPolicy({
    paramRules: {
      length: 1n,
      // Weird rhinestone typescript type which forces to have 16 of this like this
      rules: [
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule,
        paramRule
      ]
    },
    valueLimitPerUse: parseUnits("100", 6)
  })

  const sessionSigner = privateKeyToAccount(generatePrivateKey())

  const ssValidator = toSmartSessionsModule({
    signer: sessionSigner
  })

  const sessionsMeeClient = meeClient.extend(meeSessionActions)

  const sessionParams = {
    redeemer: sessionSigner.address,
    maxPaymentAmount: parseUnits("2", 6),
    actions: [
      {
        chainId: paymentChain.id,
        actionTarget: testnetMcTestUSDC.addressOn(paymentChain.id),
        actionTargetSelector: toFunctionSelector(
          getAbiItem({ abi: erc20Abi, name: "transfer" })
        ),
        actionPolicies: [
          getSudoPolicy(),
          getUsageLimitPolicy({ limit: parseUnits("100", 6) }),
          getSpendingLimitsPolicy([
            {
              token: testnetMcTestUSDC.addressOn(paymentChain.id),
              limit: parseUnits("100", 6)
            }
          ]),
          universalActionPolicy,
          getTimeFramePolicy({
            validAfter: 0,
            validUntil: Date.now() + 60 * 60 * 24
          })
        ]
      },
      {
        chainId: paymentChain.id,
        actionTarget: testnetMcUSDC.addressOn(paymentChain.id),
        actionTargetSelector: toFunctionSelector(
          getAbiItem({ abi: erc20Abi, name: "transfer" })
        ),
        actionPolicies: [
          getSudoPolicy(),
          getUsageLimitPolicy({ limit: parseUnits("100", 6) }),
          getSpendingLimitsPolicy([
            {
              token: testnetMcUSDC.addressOn(paymentChain.id),
              limit: parseUnits("100", 6)
            }
          ]),
          universalActionPolicy,
          getTimeFramePolicy({
            validAfter: 0,
            validUntil: Date.now() + 60 * 60 * 24
          })
        ]
      },
      {
        chainId: paymentChain.id,
        actionTarget: testnetMcTestUSDCP.addressOn(paymentChain.id),
        actionTargetSelector: toFunctionSelector(
          getAbiItem({ abi: erc20Abi, name: "transfer" })
        ),
        actionPolicies: [
          getSudoPolicy(),
          getUsageLimitPolicy({ limit: parseUnits("100", 6) }),
          getSpendingLimitsPolicy([
            {
              token: testnetMcTestUSDCP.addressOn(paymentChain.id),
              limit: parseUnits("100", 6)
            }
          ]),
          universalActionPolicy,
          getTimeFramePolicy({
            validAfter: 0,
            validUntil: Date.now() + 60 * 60 * 24
          })
        ]
      }
    ]
  }

  let sessionDetails: GrantPermissionResponse = []

  // Type glicth, so ignoring this for this case
  const authParams: AnyData = use7702Auth
    ? {
        delegate: true,
        authorizations: []
      }
    : {}

  if (enableSessionType === "new") {
    const payload = await sessionsMeeClient.prepareForPermissions({
      smartSessionsValidator: ssValidator,
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id,
        amount: parseUnits("1", 6)
      },
      ...sessionParams,
      ...authParams
    })

    if (payload?.hash) {
      const { explorerLinks } = await meeClient.waitForSupertransactionReceipt({
        hash: payload.hash
      })
      console.log("Prepare permissions and enable session: ", {
        explorerLinks
      })
    }

    if (!payload?.sessionDetails) {
      throw new Error("Session details is missing")
    }

    sessionDetails = payload.sessionDetails
  } else {
    const payload = await sessionsMeeClient.prepareForPermissions({
      smartSessionsValidator: ssValidator,
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id,
        amount: parseUnits("1", 6)
      },
      ...authParams
    })

    if (payload?.hash) {
      const { explorerLinks } = await meeClient.waitForSupertransactionReceipt({
        hash: payload.hash
      })
      console.log("Prepare permissions and enable session: ", {
        explorerLinks
      })
    }

    sessionDetails = await sessionsMeeClient.grantPermissionTypedDataSign({
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      ...sessionParams
    })
  }

  const userOwnedOrchestratorWithSessionSigner = await toMultichainNexusAccount(
    {
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: http(TESTNET_RPC_URLS[paymentChain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(paymentChain.id)!
        }
      ],
      signer: sessionSigner
    }
  )

  return {
    sessionAccount: userOwnedOrchestratorWithSessionSigner,
    sessionDetails,
    mcNexus
  }
}
