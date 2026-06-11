// Byte helpers shared across the SDK. Hex and concat come from @noble/hashes so
// we don't reimplement well-tested code; base64url is ours because WebAuthn and
// Soroban both speak the URL-safe, unpadded variant that the Web atob/btoa pair
// does not produce on its own.

export { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils'

/** Encode bytes as base64url (URL-safe alphabet, no padding). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)

  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a base64url string back to bytes. Tolerates missing padding. */
export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLength)

  if (typeof atob === 'function') {
    const binary = atob(padded)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }

  return new Uint8Array(Buffer.from(padded, 'base64'))
}
