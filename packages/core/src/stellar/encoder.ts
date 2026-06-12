// Explicit import: browsers have no Buffer global. Bare 'buffer' on purpose —
// see the note in address.ts.
// biome-ignore lint/style/useNodejsImportProtocol: bundlers must resolve the browser package
import { Buffer } from 'buffer'
import { xdr } from '@stellar/stellar-sdk'

// The default signature encoding for the passkey-kit lineage smart-wallet
// contracts — the layout __check_auth deserializes:
//
//   Signatures: Map<SignerKey, Signature>
//     SignerKey::Secp256r1(Bytes)            — the credential id
//     Signature::Secp256r1(Secp256r1Signature)
//       Secp256r1Signature { authenticator_data, client_data_json, signature }
//
// Soroban encodes enum variants as Vec[Symbol, value] and structs as Maps with
// symbol keys in lexicographic order. The same encoding ships inside the
// Stellar Wallets Kit module; this is the core SDK's copy, kept in lockstep.

export interface WebAuthnSignatureParts {
  credentialId: Uint8Array
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  /** Compact 64-byte low-S signature. */
  signature: Uint8Array
}

export function passkeyKitSignatureScVal(parts: WebAuthnSignatureParts): xdr.ScVal {
  const signerKey = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Secp256r1'),
    xdr.ScVal.scvBytes(Buffer.from(parts.credentialId)),
  ])

  const signatureStruct = xdr.ScVal.scvMap([
    mapEntry('authenticator_data', parts.authenticatorData),
    mapEntry('client_data_json', parts.clientDataJSON),
    mapEntry('signature', parts.signature),
  ])
  const signature = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Secp256r1'), signatureStruct])

  // Signatures is a one-field tuple struct in the contract, and Soroban encodes
  // tuple structs as a Vec of their fields — so the map rides inside a Vec.
  // Confirmed byte-for-byte against the Rust SDK's own encoding.
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: signerKey, val: signature })]),
  ])
}

/** Apply an encoded signature to the entry's address credentials, in place. */
export function attachSignatureToEntry(
  entry: xdr.SorobanAuthorizationEntry,
  signature: xdr.ScVal,
): void {
  entry.credentials().address().signature(signature)
}

function mapEntry(symbol: string, bytes: Uint8Array): xdr.ScMapEntry {
  return new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol(symbol),
    val: xdr.ScVal.scvBytes(Buffer.from(bytes)),
  })
}
