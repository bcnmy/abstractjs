import {
  http,
  type Chain,
  type LocalAccount,
  type PrivateKeyAccount,
  isAddress
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import { killNetwork } from "../../../test/testUtils"
import type { NetworkConfig } from "../../../test/testUtils"
import { createSmartAccountClient } from "../../clients/createBicoBundlerClient"
import {
  BICONOMY_ATTESTER_ADDRESS,
  K1_VALIDATOR_FACTORY_ADDRESS,
  K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2,
  RHINESTONE_ATTESTER_ADDRESS
} from "../../constants"
import { BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1 } from "../../constants"
import { toNexusAccount } from "../toNexusAccount"
import { addressEquals } from "./Utils"
import {
  isVersionOlder,
  semverCompare,
  versionMeetsRequirement
} from "./getVersion"

describe("utils.getVersion", () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string
  let eoaAccount: LocalAccount

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = network.account as PrivateKeyAccount
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should correctly compare semantic versions", () => {
    // Equal versions
    expect(semverCompare("1.2.3", "1.2.3")).toBe(0)

    // First version is lower
    expect(semverCompare("1.2.3", "1.2.4")).toBeLessThan(0)
    expect(semverCompare("1.2.3", "1.3.0")).toBeLessThan(0)
    expect(semverCompare("1.2.3", "2.0.0")).toBeLessThan(0)

    // First version is higher
    expect(semverCompare("1.2.4", "1.2.3")).toBeGreaterThan(0)
    expect(semverCompare("1.3.0", "1.2.9")).toBeGreaterThan(0)
    expect(semverCompare("2.0.0", "1.9.9")).toBeGreaterThan(0)

    // Different segment counts
    expect(semverCompare("1.2", "1.2.0")).toBe(0)
    expect(semverCompare("1.2.0.0", "1.2.0")).toBe(0)
    expect(semverCompare("1.2", "1.3")).toBeLessThan(0)
    expect(semverCompare("1.3", "1.2.9")).toBeGreaterThan(0)
  })

  test("should correctly check if version meets requirements", () => {
    // Current version exceeds required
    expect(versionMeetsRequirement("1.3.0", "1.2.0")).toBe(true)
    expect(versionMeetsRequirement("2.0.0", "1.9.9")).toBe(true)
    expect(versionMeetsRequirement("1.2.5", "1.2.4")).toBe(true)

    // Current version equals required
    expect(versionMeetsRequirement("1.2.3", "1.2.3")).toBe(true)
    expect(versionMeetsRequirement("1.2.0", "1.2")).toBe(true)

    // Current version below required
    expect(versionMeetsRequirement("1.2.3", "1.3.0")).toBe(false)
    expect(versionMeetsRequirement("1.9.9", "2.0.0")).toBe(false)
    expect(versionMeetsRequirement("0.9.0", "1.0.0")).toBe(false)

    // Different segment counts
    expect(versionMeetsRequirement("1.2", "1.2.0")).toBe(true)
    expect(versionMeetsRequirement("1.2.0", "1.2")).toBe(true)
  })

  test("should correctly check if version is older", () => {
    // Current version is older than reference
    expect(isVersionOlder("1.2.0", "1.3.0")).toBe(true)
    expect(isVersionOlder("1.9.9", "2.0.0")).toBe(true)
    expect(isVersionOlder("1.2.4", "1.2.5")).toBe(true)

    // Current version equals reference
    expect(isVersionOlder("1.2.3", "1.2.3")).toBe(false)
    expect(isVersionOlder("1.2", "1.2.0")).toBe(false)

    // Current version is newer than reference
    expect(isVersionOlder("1.3.0", "1.2.3")).toBe(false)
    expect(isVersionOlder("2.0.0", "1.9.9")).toBe(false)
    expect(isVersionOlder("1.0.0", "0.9.0")).toBe(false)

    // Different segment counts
    expect(isVersionOlder("1.2", "1.2.1")).toBe(true)
    expect(isVersionOlder("1.2.1", "1.2")).toBe(false)
  })

  test("should create nexus accounts with different versions", async () => {
    // Create a nexus account with default version (current)
    const defaultAccount = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount
    })

    const account_v0_2_1 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.2.1"
    })

    // Create a nexus account from the future
    const account_v3 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "3"
    })

    // Create a nexus account with version 0.2.0
    const account_v0_2_0 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.2.0"
    })

    // Create a nexus account with version 0.1.0
    const account_v0_1_0 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.1.0"
    })

    // Create a nexus account with version 0.0.40
    const account_v0_0_40 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.40"
    })

    // Create a nexus account with version 0.0.40
    const account_v0_0_45 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.45"
    })

    // Create a nexus account with version 0.0.32
    const account_v0_0_32 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.32"
    })

    //Create a nexus account with version 0.0.40
    const account_v0_0_1 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.1"
    })

    const accounts = [
      defaultAccount,
      account_v3,
      account_v0_2_1,
      account_v0_2_0,
      account_v0_1_0,
      account_v0_0_45,
      account_v0_0_40,
      account_v0_0_32,
      account_v0_0_1
    ]

    const clients = await Promise.all(
      accounts.map((account) =>
        createSmartAccountClient({
          account,
          transport: http(bundlerUrl)
        })
      )
    )

    const [
      defaultAccountId,
      account_v3Id,
      account_v0_2_1Id,
      account_v0_2_0Id,
      account_v0_1_0Id,
      account_v0_0_45Id,
      account_v0_0_40Id,
      account_v0_0_32Id,
      account_v0_0_1Id
    ] = await Promise.all(clients.map((client) => client.accountId()))

    const EXPECTED_ACCOUNT_IDS = [
      [
        "biconomy.nexus.1.0.2",
        defaultAccountId,
        account_v3Id,
        account_v0_2_1Id,
        account_v0_2_0Id
      ],
      [
        "biconomy.nexus.1.0.0",
        account_v0_1_0Id,
        account_v0_0_45Id,
        account_v0_0_40Id,
        account_v0_0_32Id,
        account_v0_0_1Id
      ]
    ]

    for (const batch of EXPECTED_ACCOUNT_IDS) {
      expect(batch.every((id) => id === batch[0])).toBeTruthy()
    }

    // Verify that accounts were created successfully
    const defaultAddress = await defaultAccount.getAddress()
    const v3Address = await account_v3.getAddress()
    const v0_2_1Address = await account_v0_2_1.getAddress()
    const v0_2_0Address = await account_v0_2_0.getAddress()
    const v0_1_0Address = await account_v0_1_0.getAddress()
    const v0_0_45Address = await account_v0_0_45.getAddress()
    const v0_0_40Address = await account_v0_0_40.getAddress()
    const v0_0_32Address = await account_v0_0_32.getAddress()
    const v0_0_1Address = await account_v0_0_1.getAddress()

    expect(isAddress(defaultAddress)).toBeTruthy()
    expect(isAddress(v3Address)).toBeTruthy()
    expect(isAddress(v0_2_1Address)).toBeTruthy()
    expect(isAddress(v0_2_0Address)).toBeTruthy()
    expect(isAddress(v0_1_0Address)).toBeTruthy()
    expect(isAddress(v0_0_45Address)).toBeTruthy()
    expect(isAddress(v0_0_40Address)).toBeTruthy()
    expect(isAddress(v0_0_32Address)).toBeTruthy()
    expect(isAddress(v0_0_1Address)).toBeTruthy()

    const EXPECTED_SIMILAR_ADDRESSES = [
      [defaultAddress, v3Address, v0_2_1Address, v0_2_0Address],
      [v0_1_0Address],
      [v0_0_1Address, v0_0_32Address],
      [v0_0_45Address, v0_0_40Address]
    ]

    for (const batch of EXPECTED_SIMILAR_ADDRESSES) {
      expect(
        batch.every((address) => addressEquals(address, batch[0]))
      ).toBeTruthy()
    }

    // Verify that the correct attester addresses were used based on version
    expect(defaultAccount.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_2_1.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_2_0.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_1_0.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)

    expect(account_v0_0_40.attesters[1]).toBe(
      BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1
    )
    expect(account_v0_0_32.attesters[0]).toBe(RHINESTONE_ATTESTER_ADDRESS)
    expect(account_v0_0_32.attesters).toHaveLength(1)

    expect(defaultAccount.factoryAddress).toBe(K1_VALIDATOR_FACTORY_ADDRESS)
    expect(account_v0_2_1.factoryAddress).toBe(K1_VALIDATOR_FACTORY_ADDRESS)
    expect(account_v0_2_0.factoryAddress).toBe(K1_VALIDATOR_FACTORY_ADDRESS)
    expect(account_v0_1_0.factoryAddress).toBe(
      K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
    expect(account_v0_0_40.factoryAddress).toBe(
      K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
    expect(account_v0_0_32.factoryAddress).toBe(
      K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
  })
})
