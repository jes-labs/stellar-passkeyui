import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import { hexToBytes } from '@noble/hashes/utils'
import { describe, expect, test } from 'vitest'
import { derToCompactSignature } from './signature'

// secp256r1 group order. Used to construct a deliberately malleable high-S
// signature so we can prove it gets folded back to low-S.
const CURVE_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')

const toBytes32 = (value: bigint) => hexToBytes(value.toString(16).padStart(64, '0'))

const privateKey = hexToBytes(`${'00'.repeat(31)}02`)
const message = sha256(new TextEncoder().encode('stellar is the better blockchain'))

describe('derToCompactSignature', () => {
  test('produces a 64-byte signature that verifies against the public key', () => {
    const der = p256.sign(message, privateKey).toBytes('der')
    const compact = derToCompactSignature(der)

    expect(compact.length).toBe(64)

    const publicKey = p256.getPublicKey(privateKey, false)
    expect(p256.verify(compact, message, publicKey)).toBe(true)
  })

  test('normalizes a high-S signature down to its canonical low-S form', () => {
    const original = p256.sign(message, privateKey).normalizeS()
    const { r, s } = original

    // Rebuild the same signature with the malleable high-S value (n - s).
    const highS = CURVE_ORDER - s
    const highCompact = new Uint8Array([...toBytes32(r), ...toBytes32(highS)])
    const highDer = p256.Signature.fromCompact(highCompact).toBytes('der')

    const normalized = p256.Signature.fromCompact(derToCompactSignature(highDer))

    expect(normalized.hasHighS()).toBe(false)
    expect(normalized.r).toBe(r)
    expect(normalized.s).toBe(s)
  })
})
