import { concatBytes, hexToBytes } from '@noble/hashes/utils'
import { describe, expect, test } from 'vitest'
import { publicKeyFromAuthenticatorData, publicKeyFromSpki } from './public-key'

// The P-256 generator point. It is, by definition, on the curve, which makes it
// a reliable vector for the on-curve validation without trusting our own encoder.
const GX = hexToBytes('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296')
const GY = hexToBytes('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')
const GENERATOR_POINT = concatBytes(new Uint8Array([0x04]), GX, GY)

const SPKI_P256_HEADER = hexToBytes('3059301306072a8648ce3d020106082a8648ce3d030107034200')

function coseKey(x: Uint8Array, y: Uint8Array): Uint8Array {
  // COSE_Key for an EC2 P-256 key: a 5-entry map of
  //   kty:2, alg:-7, crv:1, x:<32 bytes>, y:<32 bytes>
  return concatBytes(
    new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]),
    new Uint8Array([0x21, 0x58, 0x20]),
    x,
    new Uint8Array([0x22, 0x58, 0x20]),
    y,
  )
}

function authenticatorData(cose: Uint8Array): Uint8Array {
  const rpIdHash = new Uint8Array(32)
  const flags = new Uint8Array([0x45]) // user present + verified + attested data
  const signCount = new Uint8Array(4)
  const aaguid = new Uint8Array(16)
  const credentialIdLength = new Uint8Array([0x00, 0x10]) // 16 bytes
  const credentialId = new Uint8Array(16).fill(0xab)
  return concatBytes(rpIdHash, flags, signCount, aaguid, credentialIdLength, credentialId, cose)
}

describe('publicKeyFromSpki', () => {
  test('extracts the 65-byte point from a DER SPKI key', () => {
    const spki = concatBytes(SPKI_P256_HEADER, GENERATOR_POINT)
    expect(publicKeyFromSpki(spki)).toEqual(GENERATOR_POINT)
  })

  test('rejects an SPKI blob of the wrong length', () => {
    expect(() => publicKeyFromSpki(GENERATOR_POINT)).toThrow()
  })
})

describe('publicKeyFromAuthenticatorData', () => {
  test('decodes the COSE key and returns the on-curve point', () => {
    const authData = authenticatorData(coseKey(GX, GY))
    expect(publicKeyFromAuthenticatorData(authData)).toEqual(GENERATOR_POINT)
  })

  test('rejects a point that is not on the curve', () => {
    const badY = Uint8Array.from(GY)
    badY[31] = (badY[31] as number) ^ 0x01
    const authData = authenticatorData(coseKey(GX, badY))
    expect(() => publicKeyFromAuthenticatorData(authData)).toThrow()
  })

  test('rejects authenticator data without attested credential data', () => {
    const authData = authenticatorData(coseKey(GX, GY))
    authData[32] = 0x05 // clear the attested-credential-data flag (0x40)
    expect(() => publicKeyFromAuthenticatorData(authData)).toThrow()
  })
})
