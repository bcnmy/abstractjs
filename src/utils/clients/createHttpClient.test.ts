import { isHex, type Address, type Chain, type LocalAccount } from "viem"
import { base } from "viem/chains"
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest"
import { initNetwork, type NetworkConfig } from "../../../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account-vendors"
import { type HttpClient, createHttpClient } from "./createHttpClient"

const runPaidTests = inject("runPaidTests")

describe("createHttpClient", async () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let httpClient: HttpClient

  beforeAll(async () => {
    network = await initNetwork("ANVIL")
    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })
  })
  afterAll(async () => await network.anvilInstance?.stop())

  test("should instantiate a client", async () => {
    httpClient = createHttpClient("http://google.com")

    expect(httpClient).toBeDefined()
    expect(httpClient.request).toBeDefined()
    expect(Object.keys(httpClient)).toContain("request")
    expect(Object.keys(httpClient)).not.toContain("account")
    expect(Object.keys(httpClient)).not.toContain("getQuote")
  })
})
