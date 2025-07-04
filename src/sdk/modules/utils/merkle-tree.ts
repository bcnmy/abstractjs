import { SimpleMerkleTree } from "@openzeppelin/merkle-tree"
import { type Hash } from "viem"

export function createMerkleTree(leafHashes: Hash[]) {
  return SimpleMerkleTree.of(leafHashes, { sortLeaves: true })
}
