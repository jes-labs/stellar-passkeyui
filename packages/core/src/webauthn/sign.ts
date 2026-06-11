import { toBase64Url } from '../bytes'
import { type RawGetResult, type WebAuthnApi, browserWebAuthnApi } from './api'
import { webauthnSignedDigest } from './digest'
import { type SignWithPasskeyInput, buildRequestOptions } from './options'
import { derToCompactSignature } from './signature'

export interface SignWithPasskeyResult {
  credentialId: Uint8Array
  credentialIdBase64Url: string
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  /** Compact 64-byte low-S signature, ready for the smart-wallet contract. */
  signature: Uint8Array
  /** The digest the authenticator actually signed; what the contract re-derives. */
  signedDigest: Uint8Array
  raw: RawGetResult
}

/**
 * Run the passkey assertion ceremony over the given challenge and assemble the
 * pieces the smart-wallet contract verifies: the authenticator data, the client
 * data JSON, and the signature in the contract's compact low-S form.
 */
export async function signWithPasskey(
  input: SignWithPasskeyInput,
  api: WebAuthnApi = browserWebAuthnApi(),
): Promise<SignWithPasskeyResult> {
  const raw = await api.get(buildRequestOptions(input))

  return {
    credentialId: raw.credentialId,
    credentialIdBase64Url: toBase64Url(raw.credentialId),
    authenticatorData: raw.authenticatorData,
    clientDataJSON: raw.clientDataJSON,
    signature: derToCompactSignature(raw.signature),
    signedDigest: webauthnSignedDigest(raw.authenticatorData, raw.clientDataJSON),
    raw,
  }
}
