import { TIME_FRAME_POLICY_ADDRESS } from "@biconomy/ecosystem"
import {
  http,
  type LocalAccount,
  erc20Abi,
  erc721Abi,
  getAbiItem,
  stringify,
  toFunctionSelector
} from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  DEFAULT_MEE_VERSION,
  SPENDING_LIMITS_POLICY_ADDRESS,
  SUDO_POLICY_ADDRESS,
  UNIVERSAL_ACTION_POLICY_ADDRESS,
  USAGE_LIMIT_POLICY_ADDRESS
} from "../../constants"
import { getMEEVersion } from "../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { calldataArgument } from "./buildActionPolicy"

describe("mee.buildSessionAction", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  const mockAddress = "0xffffffffffffffffffffffffffffffffffffffff"

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: network.chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })
  })

  it("Build transfer action with default unrestricted policy", async () => {
    const [transferAction] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    expect(transferAction).toBeDefined()
    expect(transferAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferAction.chainId).to.eq(network.chain.id)
    expect(transferAction.actions[0].actionPolicies.length).to.eq(1)
    expect(transferAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build transfer action with user defined policies", async () => {
    const [transferAction] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          { type: "usageLimit", limit: 10n }
        ]
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    expect(transferAction).toBeDefined()
    expect(transferAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferAction.chainId).to.eq(network.chain.id)
    expect(transferAction.actions[0].actionPolicies.length).to.eq(2)
    expect(transferAction.actions[0].actionPolicies[0].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
    expect(transferAction.actions[0].actionPolicies[1].policy).to.eq(
      USAGE_LIMIT_POLICY_ADDRESS
    )
  })

  it("Build transfer action with abstracted policies", async () => {
    const [transferAction] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        recipientAddress: mockAddress,
        maxAmountLimit: 1n,
        amountLimitPerAction: 1n,
        usageLimit: 1n,
        validAfter: Date.now(),
        validUntil: Date.now() + 100
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    expect(transferAction).toBeDefined()
    expect(transferAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferAction.chainId).to.eq(network.chain.id)
    expect(transferAction.actions[0].actionPolicies.length).to.eq(3)
    expect(transferAction.actions[0].actionPolicies[0].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
    expect(transferAction.actions[0].actionPolicies[1].policy).to.eq(
      USAGE_LIMIT_POLICY_ADDRESS
    )
    expect(transferAction.actions[0].actionPolicies[2].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
  })

  it("Build transferFrom action with default unrestricted policy", async () => {
    const [transferFromAction] = mcNexus.buildSessionAction({
      type: "transferFrom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transferFrom" })
    )

    expect(transferFromAction).toBeDefined()
    expect(transferFromAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferFromAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferFromAction.chainId).to.eq(network.chain.id)
    expect(transferFromAction.actions[0].actionPolicies.length).to.eq(1)
    expect(transferFromAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build transferFrom action with user defined policies", async () => {
    const [transferFromAction] = mcNexus.buildSessionAction({
      type: "transferFrom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          {
            type: "spendingLimits",
            tokenLimits: [{ limit: 1n }]
          }
        ]
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transferFrom" })
    )

    expect(transferFromAction).toBeDefined()
    expect(transferFromAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferFromAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferFromAction.chainId).to.eq(network.chain.id)
    expect(transferFromAction.actions[0].actionPolicies.length).to.eq(2)
    expect(transferFromAction.actions[0].actionPolicies[0].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
    expect(transferFromAction.actions[0].actionPolicies[1].policy).to.eq(
      SPENDING_LIMITS_POLICY_ADDRESS
    )
  })

  it("Build transferFrom action with abstracted policies", async () => {
    const [transferFromAction] = mcNexus.buildSessionAction({
      type: "transferFrom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        recipientAddress: mockAddress,
        maxAmountLimit: 1n,
        amountLimitPerAction: 1n,
        usageLimit: 1n,
        validAfter: Date.now(),
        validUntil: Date.now() + 100
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transferFrom" })
    )

    expect(transferFromAction).toBeDefined()
    expect(transferFromAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(transferFromAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferFromAction.chainId).to.eq(network.chain.id)
    expect(transferFromAction.actions[0].actionPolicies.length).to.eq(3)
    expect(transferFromAction.actions[0].actionPolicies[0].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
    expect(transferFromAction.actions[0].actionPolicies[1].policy).to.eq(
      USAGE_LIMIT_POLICY_ADDRESS
    )
    expect(transferFromAction.actions[0].actionPolicies[2].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
  })

  it("Build approve action with default unrestricted policy", async () => {
    const [approveAction] = mcNexus.buildSessionAction({
      type: "approve",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "approve" })
    )

    expect(approveAction).toBeDefined()
    expect(approveAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(approveAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(approveAction.chainId).to.eq(network.chain.id)
    expect(approveAction.actions[0].actionPolicies.length).to.eq(1)
    expect(approveAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build approve action with user defined policies", async () => {
    const [approveAction] = mcNexus.buildSessionAction({
      type: "approve",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          {
            type: "universal",
            rules: [
              {
                calldataOffset: calldataArgument(1),
                condition: "equal",
                comparisonValue: 0n
              }
            ]
          }
        ]
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "approve" })
    )

    expect(approveAction).toBeDefined()
    expect(approveAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(approveAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(approveAction.chainId).to.eq(network.chain.id)
    expect(approveAction.actions[0].actionPolicies.length).to.eq(2)
    expect(approveAction.actions[0].actionPolicies[0].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
    expect(approveAction.actions[0].actionPolicies[1].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
  })

  it("Build approve action with abstracted policies", async () => {
    const [approveAction] = mcNexus.buildSessionAction({
      type: "approve",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        recipientAddress: mockAddress,
        maxAmountLimit: 1n,
        amountLimitPerAction: 1n,
        usageLimit: 1n,
        validAfter: Date.now(),
        validUntil: Date.now() + 100
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "approve" })
    )

    expect(approveAction).toBeDefined()
    expect(approveAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(approveAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(approveAction.chainId).to.eq(network.chain.id)
    expect(approveAction.actions[0].actionPolicies.length).to.eq(3)
    expect(approveAction.actions[0].actionPolicies[0].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
    expect(approveAction.actions[0].actionPolicies[1].policy).to.eq(
      USAGE_LIMIT_POLICY_ADDRESS
    )
    expect(approveAction.actions[0].actionPolicies[2].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
  })

  it("Build custom action with default sudo policy", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const [customAction] = mcNexus.buildSessionAction({
      type: "custom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        functionSignature: functionSignature
      }
    })

    expect(customAction).toBeDefined()
    expect(customAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(customAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(customAction.chainId).to.eq(network.chain.id)
    expect(customAction.actions[0].actionPolicies.length).to.eq(1)
    expect(customAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build custom action with user defined policies", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const [customAction] = mcNexus.buildSessionAction({
      type: "custom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        functionSignature: functionSignature,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          {
            type: "universal",
            rules: [
              {
                calldataOffset: calldataArgument(1),
                condition: "greaterThan",
                comparisonValue: 0n
              }
            ]
          }
        ]
      }
    })

    expect(customAction).toBeDefined()
    expect(customAction.actions[0].actionTarget).to.eq(mockAddress)
    expect(customAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(customAction.chainId).to.eq(network.chain.id)
    expect(customAction.actions[0].actionPolicies.length).to.eq(2)
    expect(customAction.actions[0].actionPolicies[0].policy).to.eq(
      TIME_FRAME_POLICY_ADDRESS
    )
    expect(customAction.actions[0].actionPolicies[1].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
  })

  it("Build multichain custom actions", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const customActions = mcNexus.buildSessionAction({
      type: "custom",
      data: {
        chainIds: [1, 10],
        contractAddress: mockAddress,
        functionSignature: functionSignature,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          {
            type: "universal",
            rules: [
              {
                calldataOffset: calldataArgument(1),
                condition: "greaterThan",
                comparisonValue: 0n
              }
            ]
          }
        ]
      }
    })

    expect(customActions.length).to.eq(2)
    expect(customActions[0].chainId).to.eq(1)
    expect(customActions[1].chainId).to.eq(10)
  })

  it("Calldata argument with zero value should fail", () => {
    expect(() => calldataArgument(0)).to.throw(
      "Invalid calldata argument value"
    )
  })

  it("Build batch actions ", async () => {
    const [actionOne] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    const [actionTwo] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    const batchedActions = mcNexus.buildSessionAction({
      type: "batch",
      data: {
        actions: [actionOne, actionTwo]
      }
    })

    expect(batchedActions.length).to.be.eq(1)
  })

  it("Build batch actions should fail if one action is attempted for batching", async () => {
    const [actionOne] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress
      }
    })

    expect(() =>
      mcNexus.buildSessionAction({
        type: "batch",
        data: {
          actions: [actionOne]
        }
      })
    ).to.throw("A Batch must contain at least 2 actions")
  })

  it("Should resolves action policies equivalently for pre-built and builder policy types", async () => {
    const timeframePolicy = mcNexus.buildActionPolicy({
      type: "timeframe",
      validAfter: Date.now(),
      validUntil: Date.now() + 3600
    })
    const usagePolicy = mcNexus.buildActionPolicy({
      type: "usageLimit",
      limit: 5n
    })

    const [transferActionWithExternalPolicyBuild] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        policies: [timeframePolicy, usagePolicy]
      }
    })

    const [transferActionWithInternalPolicyBuild] = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: mockAddress,
        policies: [
          {
            type: "timeframe",
            validAfter: Date.now(),
            validUntil: Date.now() + 3600
          },
          {
            type: "usageLimit",
            limit: 5n
          }
        ]
      }
    })

    expect(stringify(transferActionWithExternalPolicyBuild)).to.eq(
      stringify(transferActionWithInternalPolicyBuild)
    )
  })
})
