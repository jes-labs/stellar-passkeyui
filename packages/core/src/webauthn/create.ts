import { toBase64Url } from '../bytes'
import { type RawCreateResult, type WebAuthnApi, browserWebAuthnApi } from './api'
import { type CreatePasskeyInput, buildCreationOptions } from './options'
import { publicKeyFromAuthenticatorData, publicKeyFromSpki } from './public-key'

export interface CreatePasskeyResult {
  credentialId: Uint8Array
  credentialIdBase64Url: string
  /** The 65-byte uncompressed P-256 point used as the smart-wallet signer. */
  publicKey: Uint8Array
  /** Whether a discoverable key was created, when the browser reports it. */
  residentKey?: boolean
  transports?: readonly string[]
  raw: RawCreateResult
}

/**
 * Run the passkey registration ceremony and pull out the signer key. The browser
 * returns the public key either as a DER SPKI blob (getPublicKey) or inside the
 * authenticator data; we accept whichever is present.
 */
export async function createPasskey(
  input: CreatePasskeyInput,
  api: WebAuthnApi = browserWebAuthnApi(),
): Promise<CreatePasskeyResult> {
  const raw = await api.create(buildCreationOptions(input))

  const result: CreatePasskeyResult = {
    credentialId: raw.credentialId,
    credentialIdBase64Url: toBase64Url(raw.credentialId),
    publicKey: extractPublicKey(raw),
    raw,
  }
  if (raw.residentKey !== undefined) result.residentKey = raw.residentKey
  if (raw.transports) result.transports = raw.transports
  return result
}

function extractPublicKey(raw: RawCreateResult): Uint8Array {
  if (raw.publicKeySpki) return publicKeyFromSpki(raw.publicKeySpki)
  if (raw.authenticatorData) return publicKeyFromAuthenticatorData(raw.authenticatorData)
  throw new Error(
    'credential exposed no public key; expected getPublicKey() or getAuthenticatorData()',
  )
}
