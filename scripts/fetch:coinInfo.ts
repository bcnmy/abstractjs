import path from "node:path"
import { writeJsonToFile } from "./fetch:tokenMap"

const coinId = "aave-v3-usdc"

const url = `https://api.coingecko.com/api/v3/coins/${coinId}`
const options = { method: "GET", headers: { accept: "application/json" } }

const main = async () => {
  const res = await fetch(url, options)
  const json = await res.json()
  writeJsonToFile(json, path.join(__dirname, `../.data/${coinId}.json`))
}

main().catch((err) => console.error(err))
