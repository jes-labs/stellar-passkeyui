import type { xdr } from '@stellar/stellar-sdk'
import type { SignWithPasskeyResult } from '../webauthn'
import { payloadForAuthEntry } from './challenge'

// Everything the smart-wallet contract needs to authorize a transaction, with the
// crypto already done and verified. The final step — encoding this into the
// contract's signature ScVal — depends on the deployed contract's generated
// bindings, so it is handled by an injected encoder rather than guessed at here.
// See the package notes on the contract-binding integration boundary.
export interface PasskeyAuthorization {
  /** The credential id, which is also the signer key on the wallet. */
  keyId: Uint8Array
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  /** Compact 64-byte low-S signature. */
  signature: Uint8Array
  /** The digest the authenticator signed; what the contract re-derives. */
  signedDigest: Uint8Array
  /** The 32-byte authorization payload that became the WebAuthn challenge. */
  payload: Uint8Array
}

/** Runs the passkey assertion ceremony over a given challenge. */
export type PayloadSigner = (challenge: Uint8Array) => Promise<SignWithPasskeyResult>

/** Produce a passkey authorization for an arbitrary 32-byte payload. */
export async function authorizePayload(
  payload: Uint8Array,
  sign: PayloadSigner,
): Promise<PasskeyAuthorization> {
  const assertion = await sign(payload)
  return {
    keyId: assertion.credentialId,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature: assertion.signature,
    signedDigest: assertion.signedDigest,
    payload,
  }
}

/** Produce a passkey authorization for a Soroban address-credentials auth entry. */
export async function authorizeWalletEntry(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
  sign: PayloadSigner,
): Promise<PasskeyAuthorization> {
  return authorizePayload(payloadForAuthEntry(entry, networkPassphrase), sign)
}

/**
 * Encodes a passkey authorization into the contract-specific signature ScVal and
 * applies it to the auth entry. Implemented by the binding adapter for a given
 * deployed smart-wallet contract; the core SDK stays free of a specific contract
 * layout.
 */
export interface SignatureEncoder {
  apply(
    entry: xdr.SorobanAuthorizationEntry,
    authorization: PasskeyAuthorization,
  ): xdr.SorobanAuthorizationEntry
}
