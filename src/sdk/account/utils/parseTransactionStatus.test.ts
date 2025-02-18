import type { Chain, LocalAccount, TransactionReceipt, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { type MultichainSmartAccount, toMultichainNexusAccount } from ".."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import type { MeeFilledUserOpDetails } from "../../clients/decorators/mee/getQuote"
import type { UserOpStatus } from "../../clients/decorators/mee/getSupertransactionReceipt"
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
  lowerBoundTimestamp: "1000000",
  upperBoundTimestamp: "1000000",
  maxGasLimit: "1000000",
  maxFeePerGas: "1000000",
  chainId: "1",
  executionData: "0x123",
  executionError: "0x123"
}

const fulfilledReceipt: PromiseSettledResult<TransactionReceipt> = {
  status: "fulfilled",
  value: DUMMY_RECEIPT
}

const rejectedReceipt: PromiseSettledResult<TransactionReceipt> = {
  status: "rejected",
  reason: new Error("Rejected")
}

const successUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "SUCCESS"
}

const pendingUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "PENDING"
}

const errorUserOp: MeeFilledUserOpDetails & UserOpStatus = {
  ...DUMMY_USER_OP,
  executionStatus: "ERROR"
}

describe("utils.parseTransactionStatus", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should return SUCCESS when all userOps succeed and receipts are fulfilled", async () => {
    const userOps = [successUserOp, successUserOp, successUserOp]
    const receipts = [fulfilledReceipt, fulfilledReceipt, fulfilledReceipt]

    const status = await parseTransactionStatus(userOps, receipts)
    expect(status).toBe("SUCCESS")
  })

  test("should return MINING when userOps are no pending and there is a rejected receipt", async () => {
    const userOps = [successUserOp, successUserOp, successUserOp]
    const receipts = [fulfilledReceipt, fulfilledReceipt, rejectedReceipt]

    const status = await parseTransactionStatus(userOps, receipts)
    expect(status).toBe("MINING")
  })

  test("should return SUBMITTED when some ops are pending with rejected receipts", async () => {
    const userOps = [successUserOp, pendingUserOp, successUserOp]
    const receipts = [fulfilledReceipt, rejectedReceipt, fulfilledReceipt]

    const status = await parseTransactionStatus(userOps, receipts)
    expect(status).toBe("SUBMITTED")
  })
})
