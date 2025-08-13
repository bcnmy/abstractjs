import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../../test/testSetup"
import {
  type NetworkConfig,
  getRandomAccountIndex
} from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account"
import {
  MEEVersion,
  NexusBootstrapAbi,
  testnetMcUSDC
} from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { createBicoBundlerClient } from "../../createBicoBundlerClient"
import { createMeeClient } from "../../createMeeClient"

describe("mee.upgradeSmartAccount", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let chain: Chain
  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  const executeTx = async (mcNexus: MultichainSmartAccount) => {
    const meeClient = await createMeeClient({
      account: mcNexus
    })

    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        chainId: chain.id,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 1n
              }
            ],
            chainId: chain.id
          }
        })
      ],
      feeToken: {
        address: testnetMcUSDC.addressOn(chain.id),
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote
    })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt.transactionStatus).toEqual("MINED_SUCCESS")
  }

  const createNexus1_0_0 = async (accountIndex: bigint) => {
    const mcNexus1_0_0 = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(MEEVersion.V1_0_0)
        }
      ],
      index: accountIndex
    })

    await executeTx(mcNexus1_0_0)

    return mcNexus1_0_0
  }

  // TODO: Will implement the nexus upgrades with super transaction later
  // const upgrade = async (mcNexus: MultichainSmartAccount, chainId: number) => {
  //   const meeClient = await createMeeClient({
  //     account: mcNexus,
  //   });

  //   const overridenOldVersionAddress = mcNexus.addressOn(chainId, true);

  //   const { version, getInitData } = mcNexus.deploymentOn(chainId, true);

  //   const newNexusImplementationAddress = version.implementationAddress;
  //   const initData = getInitData();

  //   const upgradeData = encodeFunctionData({
  //     abi: [
  //       {
  //         name: "upgradeToAndCall",
  //         type: "function",
  //         stateMutability: "payable",
  //         inputs: [
  //           {
  //             type: "address",
  //             name: "newImplementation",
  //           },
  //           {
  //             type: "bytes",
  //             name: "data",
  //           },
  //         ],
  //         outputs: [],
  //       },
  //     ],
  //     functionName: "upgradeToAndCall",
  //     args: [newNexusImplementationAddress, initData],
  //   });

  //   const fusionQuote = await meeClient.getFusionQuote({
  //     trigger: {
  //       chainId: chain.id,
  //       tokenAddress: testnetMcUSDC.addressOn(chain.id),
  //       amount: 1n,
  //     },
  //     instructions: [
  //       mcNexus.build({
  //         type: "default",
  //         data: {
  //           calls: [
  //             {
  //               to: overridenOldVersionAddress,
  //               value: BigInt(0),
  //               data: upgradeData,
  //             },
  //           ],
  //           chainId: chain.id,
  //         },
  //       }),
  //     ],
  //     feeToken: {
  //       address: testnetMcUSDC.addressOn(chain.id),
  //       chainId: chain.id,
  //     },
  //   });

  //   const { hash } = await meeClient.executeFusionQuote({
  //     fusionQuote,
  //   });

  //   const receipt = await meeClient.waitForSupertransactionReceipt({
  //     hash,
  //     confirmations: TEST_BLOCK_CONFIRMATIONS,
  //   });

  //   expect(receipt.transactionStatus).toEqual("MINED_SUCCESS");
  // };

  test("upgrade MEE version 1.0.0 to MEE version 2.0.0 with same validator and no bootstraping", async () => {
    const accountIndex = BigInt(getRandomAccountIndex(1000, 1000000000))
    const mcNexus1_0_0 = await createNexus1_0_0(accountIndex)
    const { address: mcNexus1_0_0Address, version: mcNexus1_0_0Version } =
      mcNexus1_0_0.deploymentOn(chain.id, true)

    const mcNexus2_0_0 = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(MEEVersion.V2_0_0)
        }
      ],
      index: accountIndex,
      // Old nexus address is overriden here
      accountAddress: mcNexus1_0_0Address
    })

    const { getNonceWithKey, version: mcNexus2_0_0Version } =
      mcNexus2_0_0.deploymentOn(chain.id, true)

    const { nonce } = await getNonceWithKey(mcNexus1_0_0Address, {
      moduleAddress: mcNexus1_0_0Version.validatorAddress
    })

    const bundlerClient = createBicoBundlerClient({
      account: mcNexus2_0_0.deploymentOn(chain.id, true),
      transport: http(process.env.BUNDLER_URL)
    })

    // Upgrade the account to the latest implementation
    // The validator for MEE 1.0.0 and MEE 2.0.0 is same. So no need to initialize the nexus account again
    const hash = await bundlerClient.upgradeSmartAccount({
      nonce
    })

    // Wait for the upgrade transaction to be processed
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })

    expect(receipt.success).to.eq("true")
    const accountId = await bundlerClient.accountId()

    expect(accountId).to.eq(mcNexus2_0_0Version.accountId)

    await executeTx(mcNexus2_0_0)
  })

  test("upgrade MEE version 1.0.0 to MEE version 2.1.0 with different validator and bootstraping", async () => {
    const accountIndex = BigInt(getRandomAccountIndex(1000, 1000000000))
    const mcNexus1_0_0 = await createNexus1_0_0(accountIndex)
    const { address: mcNexus1_0_0Address, version: mcNexus1_0_0Version } =
      mcNexus1_0_0.deploymentOn(chain.id, true)

    const mcNexus2_1_0 = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      index: accountIndex,
      // Old nexus address is overriden here
      accountAddress: mcNexus1_0_0Address
    })

    const { getNonceWithKey, version: mcNexus2_1_0Version } =
      mcNexus2_1_0.deploymentOn(chain.id, true)

    const { nonce } = await getNonceWithKey(mcNexus1_0_0Address, {
      moduleAddress: mcNexus1_0_0Version.validatorAddress
    })

    const bundlerClient = createBicoBundlerClient({
      account: mcNexus2_1_0.deploymentOn(chain.id, true),
      transport: http(process.env.BUNDLER_URL)
    })

    const data = encodeAbiParameters(
      [
        { name: "bootstrap", type: "address" },
        { name: "initData", type: "bytes" }
      ],
      [
        mcNexus2_1_0Version.bootStrapAddress,
        encodeFunctionData({
          abi: NexusBootstrapAbi,
          functionName: "initNexusWithDefaultValidator",
          args: [eoaAccount.address]
        })
      ]
    )

    const initData = encodeFunctionData({
      abi: parseAbi(["function initializeAccount(bytes initData)"]),
      functionName: "initializeAccount",
      args: [data]
    })

    // Upgrade the account to the latest implementation
    // The validator for MEE 1.0.0 and MEE 2.1.0 is different. So we need to initialize the nexus account again
    // so new validator will get the owner assigned
    const hash = await bundlerClient.upgradeSmartAccount({
      nonce,
      initData
    })

    // Wait for the upgrade transaction to be processed
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })

    expect(receipt.success).to.eq("true")
    const accountId = await bundlerClient.accountId()

    expect(accountId).to.eq(mcNexus2_1_0Version.accountId)

    await executeTx(mcNexus2_1_0)
  })
})
