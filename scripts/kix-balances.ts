import {
  http,
  createPublicClient,
  formatEther,
  getContract,
  parseAbi
} from "viem"
import { polygon, polygonAmoy, polygonMumbai } from "viem/chains"

async function main() {
  const abi = parseAbi([
    "function getBalance(address paymasterId) external view returns (uint256 balance)"
  ])
  const fundingId = "0x6b2ece3a05e329372f647ea7e914e9885625b6fb"
  const polygonMainnetBalance = await getContract({
    abi,
    address: "0x000031dd6d9d3a133e663660b959162870d755d4",
    client: createPublicClient({
      chain: polygon,
      transport: http()
    })
  }).read.getBalance([fundingId])

  // const polygonMumbaiBalance = await getContract({
  //     abi,
  //     address: "0x00000f79b7faf42eebadba19acc07cd08af44789",
  //     client: createPublicClient({
  //         chain: polygonMumbai,
  //         transport: http("https://endpoints.omniatech.io/v1/matic/mumbai/public")
  //     })
  // }).read.getBalance([fundingId]);

  const polygonAmoyBalance = await getContract({
    abi,
    address: "0x000031dd6d9d3a133e663660b959162870d755d4",
    client: createPublicClient({
      chain: polygonAmoy,
      transport: http()
    })
  }).read.getBalance([fundingId])

  console.log(
    "KiX Polygon Mainnet Paymaster balance: ",
    formatEther(BigInt(polygonMainnetBalance as string))
  )
  // console.log("KiX Testing Paymaster balance: ", formatEther(BigInt(polygonMumbaiBalance as string)));
  console.log(
    "KiX Amoy Paymaster balance: ",
    formatEther(BigInt(polygonAmoyBalance as string))
  )
}

main()
