import {
  http,
  type LocalAccount,
  erc20Abi,
  erc721Abi,
  getAbiItem,
  toFunctionSelector,
  zeroAddress,
  stringify
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

describe("mee.buildAction", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount

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
    const [transferAction] = mcNexus.buildAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    expect(transferAction).toBeDefined()
    expect(transferAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(transferAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferAction.chainId).to.eq(network.chain.id)
    expect(transferAction.actions[0].actionPolicies.length).to.eq(1)
    expect(transferAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build transfer action with custom policies", async () => {
    const [transferAction] = mcNexus.buildAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        policies: [{ type: "sudo" }, { type: "usageLimit", limit: 10n }]
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    expect(transferAction).toBeDefined()
    expect(transferAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(transferAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferAction.chainId).to.eq(network.chain.id)
    expect(transferAction.actions[0].actionPolicies.length).to.eq(2)
    expect(transferAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
    expect(transferAction.actions[0].actionPolicies[1].policy).to.eq(
      USAGE_LIMIT_POLICY_ADDRESS
    )
  })

  it("Build transferFrom action with default unrestricted policy", async () => {
    const [transferFromAction] = mcNexus.buildAction({
      type: "transferFrom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transferFrom" })
    )

    expect(transferFromAction).toBeDefined()
    expect(transferFromAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(transferFromAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferFromAction.chainId).to.eq(network.chain.id)
    expect(transferFromAction.actions[0].actionPolicies.length).to.eq(1)
    expect(transferFromAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build transferFrom action with custom policies", async () => {
    const [transferFromAction] = mcNexus.buildAction({
      type: "transferFrom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        policies: [
          { type: "sudo" },
          {
            type: "spendingLimits",
            tokenLimits: [{ token: zeroAddress, limit: 1n }]
          }
        ]
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transferFrom" })
    )

    expect(transferFromAction).toBeDefined()
    expect(transferFromAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(transferFromAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(transferFromAction.chainId).to.eq(network.chain.id)
    expect(transferFromAction.actions[0].actionPolicies.length).to.eq(2)
    expect(transferFromAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
    expect(transferFromAction.actions[0].actionPolicies[1].policy).to.eq(
      SPENDING_LIMITS_POLICY_ADDRESS
    )
  })

  it("Build approve action with default unrestricted policy", async () => {
    const [approveAction] = mcNexus.buildAction({
      type: "approve",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress
      }
    })

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "approve" })
    )

    expect(approveAction).toBeDefined()
    expect(approveAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(approveAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(approveAction.chainId).to.eq(network.chain.id)
    expect(approveAction.actions[0].actionPolicies.length).to.eq(1)
    expect(approveAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build approve action with custom policies", async () => {
    const [approveAction] = mcNexus.buildAction({
      type: "approve",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        policies: [
          { type: "sudo" },
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
    expect(approveAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(approveAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(approveAction.chainId).to.eq(network.chain.id)
    expect(approveAction.actions[0].actionPolicies.length).to.eq(2)
    expect(approveAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
    expect(approveAction.actions[0].actionPolicies[1].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
  })

  it("Build custom action with custom policies", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const [customAction] = mcNexus.buildAction({
      type: "custom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        functionSignature: functionSignature
      }
    })

    expect(customAction).toBeDefined()
    expect(customAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(customAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(customAction.chainId).to.eq(network.chain.id)
    expect(customAction.actions[0].actionPolicies.length).to.eq(1)
    expect(customAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
  })

  it("Build custom action with custom policies", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const [customAction] = mcNexus.buildAction({
      type: "custom",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        functionSignature: functionSignature,
        policies: [
          { type: "sudo" },
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
    expect(customAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(customAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(customAction.chainId).to.eq(network.chain.id)
    expect(customAction.actions[0].actionPolicies.length).to.eq(2)
    expect(customAction.actions[0].actionPolicies[0].policy).to.eq(
      SUDO_POLICY_ADDRESS
    )
    expect(customAction.actions[0].actionPolicies[1].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
  })

  it("Build multichain custom actions", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc721Abi, name: "safeTransferFrom" })
    )

    const customActions = mcNexus.buildAction({
      type: "custom",
      data: {
        chainIds: [1, 10],
        contractAddress: zeroAddress,
        functionSignature: functionSignature,
        policies: [
          { type: "sudo" },
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
  })

  it("Build erc20SpendingLimit action with recipient and limitPerAction constraints", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    const [customAction] = mcNexus.buildAction({
      type: "erc20SpendingLimit",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        recipientAddress: zeroAddress,
        limitPerAction: 1n
      }
    })

    expect(customAction).toBeDefined()
    expect(customAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(customAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(customAction.chainId).to.eq(network.chain.id)
    expect(customAction.actions[0].actionPolicies.length).to.eq(2)
    expect(customAction.actions[0].actionPolicies[0].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
    expect(customAction.actions[0].actionPolicies[1].policy).to.eq(
      SPENDING_LIMITS_POLICY_ADDRESS
    )
  })

  it("Build erc20SpendingLimit action with maxLimit constraint", async () => {
    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    const [erc20SpendingLimitAction] = mcNexus.buildAction({
      type: "erc20SpendingLimit",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        maxLimit: 1n
      }
    })

    expect(erc20SpendingLimitAction).toBeDefined()
    expect(erc20SpendingLimitAction.actions[0].actionTarget).to.eq(zeroAddress)
    expect(erc20SpendingLimitAction.actions[0].actionTargetSelector).to.eq(
      functionSignature
    )
    expect(erc20SpendingLimitAction.chainId).to.eq(network.chain.id)
    expect(erc20SpendingLimitAction.actions[0].actionPolicies.length).to.eq(1)
    expect(erc20SpendingLimitAction.actions[0].actionPolicies[0].policy).to.eq(
      UNIVERSAL_ACTION_POLICY_ADDRESS
    )
  })

  it("Calldata argument with zero value should fail", () => {
    expect(() => calldataArgument(0)).to.throw(
      "Invalid calldata argument value"
    )
  })

  it("Build batch actions ", async () => {
    const [actionOne] = mcNexus.buildAction({
      type: "erc20SpendingLimit",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        maxLimit: 1n
      }
    })

    const [actionTwo] = mcNexus.buildAction({
      type: "erc20SpendingLimit",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        maxLimit: 1n
      }
    })

    const batchedActions = mcNexus.buildAction({
      type: "batch",
      data: {
        actions: [actionOne, actionTwo]
      }
    })

    expect(batchedActions.length).to.be.eq(1)
  })

  it("Build batch actions should fail if one action is attempted for batching", async () => {
    const [actionOne] = mcNexus.buildAction({
      type: "erc20SpendingLimit",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        maxLimit: 1n
      }
    })

    expect(() =>
      mcNexus.buildAction({
        type: "batch",
        data: {
          actions: [actionOne]
        }
      })
    ).to.throw("A Batch must contain at least 2 actions")
  })

  it("Should resolves action policies equivalently for pre-built and builder policy types", async () => {
    const sudoPolicy = mcNexus.buildActionPolicy({ type: "sudo" })
    const usagePolicy = mcNexus.buildActionPolicy({
      type: "usageLimit",
      limit: 5n
    })

    const [transferActionWithExternalPolicyBuild] = mcNexus.buildAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        policies: [sudoPolicy, usagePolicy]
      }
    })

    const [transferActionWithInternalPolicyBuild] = mcNexus.buildAction({
      type: "transfer",
      data: {
        chainIds: [network.chain.id],
        contractAddress: zeroAddress,
        policies: [
          {
            type: "sudo"
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
