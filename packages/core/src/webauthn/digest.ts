import { sha256 } from '@noble/hashes/sha2'
import { concatBytes } from '@noble/hashes/utils'
import { toBase64Url } from '../bytes'

// Reproduce the digest that the authenticator signed, which is also what the
// smart-wallet contract re-derives on-chain before calling secp256r1_verify:
//
//     sha256(authenticatorData || sha256(clientDataJSON))
//
// If the SDK computes this any differently than the contract, every signature
// fails verification, so this function is the single definition both sides agree on.
export function webauthnSignedDigest(
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
): Uint8Array {
  return sha256(concatBytes(authenticatorData, sha256(clientDataJSON)))
}

// The Soroban authorization payload (a 32-byte hash) is handed to WebAuthn as the
// challenge. The browser base64url-encodes it into clientDataJSON, and the contract
// re-encodes the payload the same way to confirm the user signed this exact request.
export function challengeFromPayload(payload: Uint8Array): string {
  return toBase64Url(payload)
}
