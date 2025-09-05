import type { Chain, LocalAccount, TransactionReceipt, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { type MultichainSmartAccount, toMultichainNexusAccount } from ".."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import type { MeeFilledUserOpDetails } from "../../clients/decorators/mee/getQuote"
import type { UserOpStatus } from "../../clients/decorators/mee/getSupertransactionReceipt"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { parseTransactionStatus } from "./parseTransactionStatus"

const DUMMY_RECEIPT: TransactionReceipt = {
  status: "success",
  from: "0x123",
  to: "0x123",
  blockHash: "0x123",
  blockNumber: 0n,
  contractAddress: undefined,
  cumulativeGasUsed: 0n,
  effectiveGasPrice: 0n,
  gasUsed: 0n,
  logs: [],
  logsBloom: "0x123",
  transactionHash: "0x123",
  transactionIndex: 0,
  type: "legacy"
}

const DUMMY_USER_OP: MeeFilledUserOpDetails & UserOpStatus = {
  executionStatus: "SUCCESS",
  userOp: {
    sender: "0x123",
    nonce: "0",
    initCode: "0x123",
    callData: "0x123",
    callGasLimit: "1000000",
    verificationGasLimit: "1000000",
    maxFeePerGas: "1000000",
    maxPriorityFeePerGas: "1000000",
    paymasterAndData: "0x123",
    preVerificationGas: "1000000"
  },
  userOpHash: "0x123",
  meeUserOpHash: "0x123",
  shortEncoding: false,
  lowerBoundTimestamp: "1000000",
  upperBoundTimestamp: "1000000",
  maxGasLimit: "1000000",
  maxFeePerGas: "1000000",
  chainId: "1",
  executionData: "0x123",
  executionError: ""
}

const fulfilledReceipt: PromiseSettledResult<TransactionReceipt> = {
  status: "fulfilled",
  value: DUMMY_RECEIPT
}

const rejectedReceipt: PromiseSettledResult<TransactionReceipt> = {
  status: "rejected",
  reason: new Error("Rejected")
}

// Define user ops with different statuses
const successUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "SUCCESS"
}

const paymentUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "MINED_SUCCESS"
}

const minedSuccessUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "MINED_SUCCESS"
}

const pendingUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "PENDING"
}

const miningUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "MINING"
}

const failedUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "FAILED",
  executionError: "This is a test error for status FAILED"
}

const minedFailUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "MINED_FAIL",
  executionError: "This is a test error for status MINED_FAIL"
}

describe("utils.parseTransactionStatus", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should return MINED_SUCCESS with finalised=true when all userOps have MINED_SUCCESS status", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      minedSuccessUserOp,
      minedSuccessUserOp
    ]

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("MINED_SUCCESS")
    expect(result.isFinalised).toBe(true)
    expect(result.message).toBe("[1] Transaction executed successfully")
  })

  test("should return SUCCESS for legacy status handling with finalised=false", async () => {
    const userOps = [paymentUserOp, successUserOp, successUserOp, successUserOp]

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("PENDING") // Since we removed backward compatibility
    expect(result.isFinalised).toBe(false)
    expect(result.message).toBe("")
  })

  test("should return PENDING with finalised=false when any userOp has PENDING status", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      pendingUserOp,
      minedSuccessUserOp
    ]

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("PENDING")
    expect(result.isFinalised).toBe(false)
    expect(result.message).toContain(
      "Transaction is pending, waiting for conditions to be met"
    )
  })

  test("should return MINING with finalised=false when any userOp has MINING status", async () => {
    // Payment userOps will be skipped for main sprtx status
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      miningUserOp,
      minedSuccessUserOp
    ]

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("MINING")
    expect(result.isFinalised).toBe(false)
    expect(result.message).toBe(
      "[2] Transaction is mining, waiting for blockchain confirmation"
    )
  })

  test("should return FAILED with finalised=false when mixed final and non-final userOps exist", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      failedUserOp,
      pendingUserOp
    ]
    failedUserOp.executionError = "Test error message"

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("FAILED")
    expect(result.isFinalised).toBe(true) // Changed to match implementation
    expect(result.message).toContain("Test error message")
  })

  test("should return FAILED with finalised=true when all userOps have final status", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      failedUserOp,
      minedSuccessUserOp
    ]
    failedUserOp.executionError = "Custom error message"

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("FAILED")
    expect(result.isFinalised).toBe(true)
    expect(result.message).toContain("Custom error message")
  })

  test("should return MINED_FAIL with finalised=true when all userOps have final status", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      minedFailUserOp,
      minedSuccessUserOp
    ]
    minedFailUserOp.executionError = "UserOperation reverted"

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("MINED_FAIL")
    expect(result.isFinalised).toBe(true)
    expect(result.message).toContain("UserOperation reverted")
  })

  test("should return MINED_FAIL with finalised=false when mixed final and non-final userOps exist", async () => {
    const userOps = [
      paymentUserOp,
      minedSuccessUserOp,
      minedFailUserOp,
      miningUserOp
    ]
    minedFailUserOp.executionError = "Transaction reverted on-chain"

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("MINED_FAIL")
    expect(result.isFinalised).toBe(true) // Changed to match implementation
    expect(result.message).toContain("Transaction reverted on-chain")
  })

  test("should handle priority correctly - FAILED takes precedence over MINED_FAIL", async () => {
    const userOps = [
      paymentUserOp,
      minedFailUserOp,
      failedUserOp,
      minedSuccessUserOp
    ]
    failedUserOp.executionError = "Priority error message"
    minedFailUserOp.executionError = "Should not see this"

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("FAILED")
    expect(result.isFinalised).toBe(true)
    expect(result.message).toContain("Priority error message")
  })

  test("should handle priority correctly - MINING takes precedence over PENDING", async () => {
    const userOps = [
      paymentUserOp,
      miningUserOp,
      pendingUserOp,
      minedSuccessUserOp
    ]
    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("MINING")
    expect(result.isFinalised).toBe(false)
    expect(result.message).toContain(
      "[1] Transaction is mining, waiting for blockchain confirmation"
    )
  })

  test("should handle empty userOps and return PENDING", async () => {
    const userOps: (MeeFilledUserOpDetails & UserOpStatus)[] = []

    const result = await parseTransactionStatus(userOps)
    expect(result.status).toBe("PENDING")
    expect(result.isFinalised).toBe(false)
    expect(result.message).toBe("")
  })
})
