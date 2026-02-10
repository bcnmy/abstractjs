import {
  http,
  type Account,
  type Chain,
  type Hash,
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
import { calldataArgument } from "../../sdk/account/decorators/buildActionPolicy"
import { DEFAULT_MEE_VERSION, testnetMcUSDC } from "../../sdk/constants"
import {
  type AnyData,
  getMEEVersion,
  meeSessionActions,
  toSmartSessionsModule
} from "../../sdk/modules"
import type { GrantPermissionResponse } from "../../sdk/modules/validators/smartSessions/decorators/grantPermission"
import type { MultichainActionData } from "../../sdk/modules/validators/smartSessions/decorators/mee/grantMeePermission"
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
  use7702Auth = false,
  customActions?: MultichainActionData["actions"],
  splitActionsBy?: number
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

  const sessionSigner = privateKeyToAccount(generatePrivateKey())

  const ssValidator = toSmartSessionsModule({
    signer: sessionSigner
  })

  const sessionsMeeClient = meeClient.extend(meeSessionActions)

  const actions =
    customActions && customActions.length > 0
      ? customActions
      : [
          mcNexus.buildAction({
            type: "transfer",
            data: {
              chainIds: [paymentChain.id],
              contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
              policies: [
                { type: "sudo" },
                { type: "usageLimit", limit: 100n },
                {
                  type: "spendingLimits",
                  tokenLimits: [
                    {
                      token: testnetMcTestUSDC.addressOn(paymentChain.id),
                      limit: parseUnits("100", 6)
                    }
                  ]
                },
                {
                  type: "timeframe",
                  validAfter: 0,
                  validUntil: Date.now() + 60 * 60 * 24
                },
                {
                  type: "universal",
                  valueLimitPerUse: parseUnits("100", 6),
                  rules: [
                    {
                      condition: "greaterThan",
                      calldataOffset: calldataArgument(1),
                      comparisonValue: toHex(toBytes("0x", { size: 32 }))
                    }
                  ]
                }
              ]
            }
          }),
          mcNexus.buildAction({
            type: "custom",
            data: {
              chainIds: [paymentChain.id],
              contractAddress: testnetMcUSDC.addressOn(paymentChain.id),
              functionSignature: toFunctionSelector(
                getAbiItem({ abi: erc20Abi, name: "transfer" })
              ),
              policies: [
                { type: "sudo" },
                { type: "usageLimit", limit: 100n },
                {
                  type: "spendingLimits",
                  tokenLimits: [
                    {
                      token: testnetMcUSDC.addressOn(paymentChain.id),
                      limit: parseUnits("100", 6)
                    }
                  ]
                },
                {
                  type: "timeframe",
                  validAfter: 0,
                  validUntil: Date.now() + 60 * 60 * 24
                },
                {
                  type: "universal",
                  valueLimitPerUse: parseUnits("100", 6),
                  rules: [
                    {
                      condition: "greaterThan",
                      calldataOffset: calldataArgument(1),
                      comparisonValue: toHex(toBytes("0x", { size: 32 }))
                    }
                  ]
                }
              ]
            }
          }),
          mcNexus.buildAction({
            type: "custom",
            data: {
              chainIds: [paymentChain.id],
              contractAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
              functionSignature: toFunctionSelector(
                getAbiItem({ abi: erc20Abi, name: "transfer" })
              )
            }
          })
        ].flat()

  const sessionParams = {
    redeemer: sessionSigner.address,
    maxPaymentAmount: parseUnits("2", 6),
    actions
  }

  let sessionDetails: GrantPermissionResponse = []

  // Type glicth, so ignoring this for this case
  const authParams: AnyData = use7702Auth
    ? {
        delegate: true,
        authorizations: []
      }
    : {}

  let hash: Hash | null = null

  if (enableSessionType === "new") {
    const payload = await sessionsMeeClient.prepareForPermissions({
      smartSessionsValidator: ssValidator,
      // Temporarily commented now
      // simulation: {
      //   simulate: true
      // },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id,
        amount: parseUnits("1", 6)
      },
      splitActionsBy,
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

      hash = payload.hash
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

      hash = payload.hash
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
    mcNexus,
    prepareForPermissionsHash: hash
  }
}
