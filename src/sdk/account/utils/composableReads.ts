import { erc7579Reads } from "../../clients/decorators/erc7579"
import { ownableReads } from "../../modules/validators/ownable/decorators"

export const GLOBAL_COMPOSABLE_READS = {
  ...erc7579Reads,
  ...ownableReads
} as const

export type SupportedRead = keyof typeof GLOBAL_COMPOSABLE_READS
