import {
    MOCK_SIGNATURE_VALIDATOR,
    TOKEN_WITH_PERMIT
} from "@biconomy/ecosystem"
import { getAddress, getBytes, hexlify } from "ethers"
import {
    http,
    type Address,
    type Chain,
    type Hex,
    type LocalAccount,
    type PublicClient,
    type WalletClient,
    concat,
    concatHex,
    createWalletClient,
    domainSeparator,
    encodeAbiParameters,
    encodePacked,
    getContract,
    hashMessage,
    isAddress,
    isHex,
    keccak256,
    parseAbi,
    parseAbiParameters,
    parseEther,
    toBytes,
    toHex
} from "viem"
import type { UserOperation } from "viem/account-abstraction"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { MockSignatureValidatorAbi } from "../test/__contracts/abi/MockSignatureValidatorAbi"
import { toNetwork } from "../test/testSetup"
import {
    fundAndDeployClients,
    getTestAccount,
    killNetwork,
    toTestClient
} from "../test/testUtils"
import type { MasterClient, NetworkConfig } from "../test/testUtils"
import {
    type NexusClient,
    createSmartAccountClient
} from "../sdk/clients/createBicoBundlerClient"
import { K1_VALIDATOR_ADDRESS } from "../sdk/constants"
import { TokenWithPermitAbi } from "../sdk/constants/abi/TokenWithPermitAbi"
import { type NexusAccount, toNexusAccount } from "../sdk/account/toNexusAccount"
import {
    addressEquals,
    getAccountDomainStructFields,
    getAccountMeta
} from "../sdk/account/utils"
import {
    NEXUS_DOMAIN_TYPEHASH,
    PARENT_TYPEHASH,
    eip1271MagicValue
} from "../sdk/account/utils/Constants"
import type { BytesLike } from "../sdk/account/utils/Types"

describe("nexus.account", async () => {
    let network: NetworkConfig
    let chain: Chain
    let bundlerUrl: string

    // Test utils
    let testClient: MasterClient
    let eoaAccount: LocalAccount
    let userTwo: LocalAccount
    let nexusAccountAddress: Address
    let nexusClient: NexusClient
    let nexusAccount: NexusAccount
    let walletClient: WalletClient

    beforeAll(async () => {
        network = await toNetwork()

        chain = network.chain
        bundlerUrl = network.bundlerUrl
        eoaAccount = getTestAccount(0)
        userTwo = getTestAccount(1)

        testClient = toTestClient(chain, getTestAccount(5))

        walletClient = createWalletClient({
            account: eoaAccount,
            chain,
            transport: http()
        })

        nexusAccount = await toNexusAccount({
            chain,
            signer: eoaAccount,
            transport: http()
        })

        nexusClient = createSmartAccountClient({
            mock: true,
            account: nexusAccount,
            transport: http(bundlerUrl)
        })

        nexusAccount = nexusClient.account
        nexusAccountAddress = await nexusClient.account.getCounterFactualAddress()
        await fundAndDeployClients(testClient, [nexusClient])
    })
    afterAll(async () => {
        await killNetwork([network?.rpcPort, network?.bundlerPort])
    })

})
