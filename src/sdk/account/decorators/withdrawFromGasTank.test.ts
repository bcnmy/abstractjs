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
import { toNetwork } from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import { type NetworkConfig, getBalance } from "../../../test/testUtils"
import {
  DEFAULT_PATHFINDER_API_KEY,
  DEFAULT_PATHFINDER_URL
} from "../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { runtimeERC20BalanceOf } from "../../modules"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

// @ts-ignore
const { runLifecycleTests } = inject("settings")

describe.runIf(runLifecycleTests)("mee.withdrawFromGasTank", () => {
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
        chain: chain,
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

  // wallet balance is getting reflected with huge delay. Skipping this for now
  test
    .runIf(runLifecycleTests)
    .skip("Withdraw funds from gas tank", async () => {
      const token = testnetMcTestUSDCP.addressOn(chain.id)
      const { address: gasTankAddress } = await gasTankAccount.getAddress()
      const deployed = await gasTankAccount.isDeployed()

      expect(deployed).to.eq(false)

      const wallet = createWalletClient({
        chain,
        account: eoaAccount,
        transport: http(network.rpcUrl)
      }).extend(publicActions)

      // Funds the gas tank EOA account. So the gas tank account can be deployed with deposit
      const fundHash = await wallet.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "transfer",
        args: [gasTankEoaAccount.address, parseUnits("0.3", 6)]
      })

      await waitForTransactionReceipt(wallet, {
        hash: fundHash,
        confirmations: 15
      })

      const { isDeployed, address } = await gasTankAccount.deploy({
        tokenAddress: token,
        amount: parseUnits("0.1", 6),
        confirmations: 15
      })

      expect(isDeployed).to.eq(true)
      expect(address).to.eq(gasTankAddress)

      const balanceBefore = await getBalance(wallet, gasTankAddress, token)

      expect(balanceBefore).to.eq(parseUnits("0.1", 6))

      await gasTankAccount.withdraw({
        tokenAddress: token,
        recipient: eoaAccount.address,
        amount: runtimeERC20BalanceOf({
          targetAddress: gasTankAddress,
          tokenAddress: token
        }),
        confirmations: 15
      })

      const balanceAfter = await getBalance(wallet, gasTankAddress, token)

      expect(balanceAfter).to.eq(0n)
    })
})
