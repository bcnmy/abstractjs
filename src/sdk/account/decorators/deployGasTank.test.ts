import {
  http,
  type Chain,
  type LocalAccount,
  createWalletClient,
  erc20Abi,
  parseUnits,
  publicActions
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { waitForTransactionReceipt } from "viem/actions"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../test/testUtils"
import {
  DEFAULT_PATHFINDER_API_KEY,
  DEFAULT_PATHFINDER_URL
} from "../../clients/createMeeClient"
import { testnetMcUSDC } from "../../constants"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.getGasTankBalance", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let gasTankEoaAccount: LocalAccount
  let chain: Chain

  let gasTankAccount: GasTankAccount

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    const gasTankPk = generatePrivateKey()

    gasTankEoaAccount = privateKeyToAccount(gasTankPk)

    gasTankAccount = await toGasTankAccount({
      chainConfiguration: {
        transport: http(network.rpcUrl),
        chain,
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      },
      privateKey: gasTankPk,
      options: {
        mee: {
          url: DEFAULT_PATHFINDER_URL,
          apiKey: DEFAULT_PATHFINDER_API_KEY
        }
      }
    })
  })

  test.runIf(runPaidTests)("Deploy gas tank", async () => {
    const { address: gasTankAddress } = await gasTankAccount.getAddress()
    const deployed = await gasTankAccount.isDeployed()

    expect(deployed).to.eq(false)

    const wallet = createWalletClient({
      chain,
      account: eoaAccount,
      transport: http(network.rpcUrl)
    }).extend(publicActions)

    // Funds the gas tank EOA account. So the gas tank account can be deployed with deposit
    const hash = await wallet.writeContract({
      address: testnetMcUSDC.addressOn(chain.id),
      abi: erc20Abi,
      functionName: "transfer",
      args: [gasTankEoaAccount.address, parseUnits("0.3", 6)]
    })

    await waitForTransactionReceipt(wallet, {
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const { isDeployed, address } = await gasTankAccount.deploy({
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: parseUnits("0.1", 6)
    })

    expect(isDeployed).to.eq(true)
    expect(address).to.eq(gasTankAddress)

    const balance = await getBalance(
      wallet,
      gasTankAddress,
      testnetMcUSDC.addressOn(chain.id)
    )

    expect(balance).to.eq(parseUnits("0.1", 6))
  })
})
