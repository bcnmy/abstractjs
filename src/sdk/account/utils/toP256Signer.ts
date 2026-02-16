import { p256 } from "@noble/curves/nist.js"
import {
  type Hex,
  type LocalAccount,
  type SignableMessage,
  concatHex,
  hashMessage,
  hashTypedData,
  hexToBytes,
  keccak256,
  toHex
} from "viem"
import { toAccount } from "viem/accounts"

export type P256Signer = LocalAccount<"p256">

/**
 * Checks if a signer is a P256 signer.
 * @param signer - The signer to check
 * @returns True if the signer is a P256 signer
 */
export const isP256Signer = (
  signer: { source?: string } | undefined
): boolean => signer?.source === "p256"

/**
 * Creates a P256 (secp256r1) signer that implements viem's LocalAccount interface.
 *
 * The signer produces raw P256 ECDSA signatures (r || s, 64 bytes) suitable for
 * on-chain verification by P256StatelessValidator.
 *
 * The publicKey field contains the uncompressed P256 public key (04 || x || y).
 * To extract coordinates for ownership data:
 *   x = publicKey.slice(4, 68)  // 32 bytes hex
 *   y = publicKey.slice(68, 132) // 32 bytes hex
 *
 * @param privateKey - The P256 private key as a hex string
 * @returns A LocalAccount<'p256'> with P256 signing capabilities
 */
export const toP256Signer = (privateKey: Hex): P256Signer => {
  const privateKeyBytesArray = hexToBytes(privateKey)

  const publicKeyBytes = p256.getPublicKey(privateKeyBytesArray, false) // uncompressed: 04 || x || y
  const publicKey = toHex(publicKeyBytes)

  // Derive an Ethereum-style address from the P256 public key coordinates for type compatibility
  const xyHex = toHex(publicKeyBytes.slice(1)) // x || y (64 bytes)
  const address = keccak256(xyHex).slice(0, 42) as `0x${string}`

  const signP256 = (hash: Hex): Hex => {
    const hashBytesArray = hexToBytes(hash)
    // sign returns compact format (r || s, 64 bytes) by default with prehash: false
    const sigBytes = p256.sign(hashBytesArray, privateKeyBytesArray, {
      prehash: false
    })

    return toHex(sigBytes)
  }

  const account = toAccount({
    address,
    async sign({ hash }: { hash: Hex }): Promise<Hex> {
      return signP256(hash)
    },
    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      const hash = hashMessage(message)
      return signP256(hash)
    },
    async signTransaction(_) {
      throw new Error("signTransaction is not supported for P256 signer")
    },
    async signTypedData(typedData): Promise<Hex> {
      const hash = hashTypedData(typedData)
      return signP256(hash)
    }
  })

  return {
    ...account,
    signP256,
    publicKey,
    source: "p256"
  } as P256Signer
}
