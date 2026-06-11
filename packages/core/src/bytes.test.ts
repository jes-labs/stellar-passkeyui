import { describe, expect, test } from 'vitest'
import { fromBase64Url, hexToBytes, toBase64Url } from './bytes'

const samples = [
  new Uint8Array([]),
  new Uint8Array([0x00]),
  new Uint8Array([0xff, 0xfe, 0xfd]),
  hexToBytes('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
  new Uint8Array(Array.from({ length: 100 }, (_, i) => (i * 7) % 256)),
]

describe('base64url', () => {
  // Cross-check against Node's own base64url so we are not just testing our
  // encoder against our decoder.
  test('matches Node base64url encoding', () => {
    for (const bytes of samples)
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'))
  })

  test('round-trips through encode/decode', () => {
    for (const bytes of samples) expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
  })

  test('never emits padding or non-url-safe characters', () => {
    for (const bytes of samples) {
      const encoded = toBase64Url(bytes)
      expect(encoded).not.toMatch(/[+/=]/)
    }
  })

  test('decodes input that is missing its padding', () => {
    const unpadded = 'AQID' // base64url for [1, 2, 3]
    expect(fromBase64Url(unpadded)).toEqual(new Uint8Array([1, 2, 3]))
  })
})
