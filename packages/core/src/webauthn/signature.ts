import { p256 } from '@noble/curves/nist.js'

// WebAuthn authenticators return ECDSA signatures in ASN.1 DER. The Stellar
// smart-wallet contract verifies a 64-byte compact signature (r || s), and the
// network rejects any signature whose s is in the upper half of the curve order
// (the "high-S" malleable form). normalizeS() folds high-S down to its canonical
// low-S equivalent, which verifies to the same point.
//
// We delegate the parsing and the field math to @noble/curves on purpose: DER is
// fragile to hand-parse, and getting low-S wrong produces signatures that pass
// locally but get rejected on-chain.

/** Convert a DER-encoded P-256 signature into the canonical 64-byte low-S form. */
export function derToCompactSignature(der: Uint8Array): Uint8Array {
  return p256.Signature.fromDER(der).normalizeS().toBytes('compact')
}
