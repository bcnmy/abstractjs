import {
  http,
  type Chain,
  type LocalAccount,
  type PrivateKeyAccount,
  isAddress
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import {
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../test/testUtils"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  BICONOMY_ATTESTER_ADDRESS,
  MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS,
  MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
} from "../../constants"
import { BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1 } from "../../constants"
import { toNexusAccount } from "../toNexusAccount"
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

    // // Create a nexus account with version 0.0.41
    const account_v0_0_41 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.41"
    })

    // // Create a nexus account with version 0.0.33
    const account_v0_0_33 = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount,
      oldVersion: "0.0.33"
    })

    // Verify that accounts were created successfully
    const defaultAddress = await defaultAccount.getAddress()
    const v0_2_1Address = await account_v0_2_1.getAddress()
    const v0_2_0Address = await account_v0_2_0.getAddress()
    const v0_1_0Address = await account_v0_1_0.getAddress()
    const v0_0_41Address = await account_v0_0_41.getAddress()
    const v0_0_33Address = await account_v0_0_33.getAddress()

    expect(isAddress(defaultAddress)).toBeTruthy()
    expect(isAddress(v0_2_1Address)).toBeTruthy()
    expect(isAddress(v0_2_0Address)).toBeTruthy()
    expect(isAddress(v0_1_0Address)).toBeTruthy()
    expect(isAddress(v0_0_41Address)).toBeTruthy()
    expect(isAddress(v0_0_33Address)).toBeTruthy()

    // Uncomment these when the factory address is updated...

    // expect(defaultAddress).toBe(v0_2_1Address)
    // expect(defaultAddress).toBe(v0_2_0Address)
    // expect(defaultAddress).not.toBe(v0_1_0Address)
    // expect(defaultAddress).not.toBe(v0_0_41Address)
    // expect(defaultAddress).not.toBe(v0_0_33Address)

    // expect(v0_2_1Address).toBe(v0_2_0Address)
    // expect(v0_2_1Address).not.toBe(v0_1_0Address)
    // expect(v0_2_1Address).not.toBe(v0_0_41Address)
    // expect(v0_2_1Address).not.toBe(v0_0_33Address)

    // Verify that the correct attester addresses were used based on version
    expect(defaultAccount.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_2_1.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_2_0.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_1_0.attesters[1]).toBe(BICONOMY_ATTESTER_ADDRESS)
    expect(account_v0_0_41.attesters[1]).toBe(
      BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1
    )
    expect(account_v0_0_33.attesters[1]).toBe(
      BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1
    )

    expect(defaultAccount.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    )
    expect(account_v0_2_1.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    )
    expect(account_v0_2_0.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    )
    expect(account_v0_1_0.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
    expect(account_v0_0_41.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
    expect(account_v0_0_33.factoryAddress).toBe(
      MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2
    )
  })
})
