import { webcrypto } from 'node:crypto'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import { describe, expect, test } from 'vitest'
import { bytesToHex, concatBytes } from '../bytes'
import { publicKeyFromAuthenticatorData, publicKeyFromSpki } from './public-key'
import { derToCompactSignature } from './signature'

// These tests check our output against implementations that share no code with
// @noble: the Web Crypto API (browser/Node native) parses SPKI and verifies
// signatures independently. If our byte handling were subtly wrong, agreement
// across two implementations would be near impossible.

const subtle = webcrypto.subtle

function buildAuthenticatorData(rawPoint: Uint8Array, credIdLen: number): Uint8Array {
  const x = rawPoint.subarray(1, 33)
  const y = rawPoint.subarray(33, 65)
  const cose = concatBytes(
    new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    new Uint8Array([0x22, 0x58, 0x20]),
    y,
  )
  const head = new Uint8Array(55)
  head[32] = 0x45 // user present + verified + attested credential data
  head[53] = (credIdLen >> 8) & 0xff
  head[54] = credIdLen & 0xff
  const credId = new Uint8Array(credIdLen).fill(0xab)
  return concatBytes(head, credId, cose)
}

describe('public key extraction vs Web Crypto', () => {
  // Credential ID lengths chosen to exercise the 2-byte big-endian length field,
  // including the 255/256 boundary where the high byte first becomes non-zero.
  const credentialIdLengths = [0, 1, 16, 255, 256, 1023]

  test('SPKI and COSE extraction agree with Web Crypto over many keys', async () => {
    for (let i = 0; i < 60; i++) {
      const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify',
      ])
      const raw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey))
      const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey))
      const expected = bytesToHex(raw)

      expect(bytesToHex(publicKeyFromSpki(spki))).toBe(expected)

      for (const credIdLen of credentialIdLengths) {
        const authData = buildAuthenticatorData(raw, credIdLen)
        expect(bytesToHex(publicKeyFromAuthenticatorData(authData))).toBe(expected)
      }
    }
  })
})

describe('DER to compact signature vs Web Crypto', () => {
  test('normalized compact signatures verify under Web Crypto', async () => {
    for (let i = 0; i < 60; i++) {
      // Deterministic, always-valid private key (1..60), so the test never flakes.
      const privateKey = new Uint8Array(32)
      privateKey[31] = i + 1
      const publicKey = p256.getPublicKey(privateKey, false)

      const message = webcrypto.getRandomValues(new Uint8Array(48))
      const der = p256.sign(sha256(message), privateKey).toBytes('der')
      const compact = derToCompactSignature(der)

      expect(compact.length).toBe(64)

      const verifyKey = await subtle.importKey(
        'raw',
        publicKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
      const ok = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        verifyKey,
        compact,
        message,
      )
      expect(ok).toBe(true)
    }
  })
})
