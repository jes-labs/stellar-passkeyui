import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, test } from 'vitest'
import { concatBytes } from '../bytes'
import { publicKeyFromAuthenticatorData, publicKeyFromSpki } from './public-key'
import { derToCompactSignature } from './signature'

// Malformed input must fail loudly. A parser that returns a wrong-but-plausible
// key or signature is far more dangerous than one that throws, because the error
// only surfaces later as an unverifiable on-chain signature.

const subtle = webcrypto.subtle

let validRaw: Uint8Array
let validSpki: Uint8Array

beforeAll(async () => {
  const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  validRaw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey))
  validSpki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey))
})

function authDataFor(rawPoint: Uint8Array, credIdLen: number): Uint8Array {
  const cose = concatBytes(
    new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    rawPoint.subarray(1, 33),
    new Uint8Array([0x22, 0x58, 0x20]),
    rawPoint.subarray(33, 65),
  )
  const head = new Uint8Array(55)
  head[32] = 0x45
  head[53] = (credIdLen >> 8) & 0xff
  head[54] = credIdLen & 0xff
  return concatBytes(head, new Uint8Array(credIdLen).fill(0xab), cose)
}

describe('publicKeyFromSpki rejects bad input', () => {
  test('truncated SPKI', () => {
    expect(() => publicKeyFromSpki(validSpki.subarray(0, 50))).toThrow()
  })

  test('raw point with no SPKI header', () => {
    expect(() => publicKeyFromSpki(validRaw)).toThrow()
  })

  test('empty input', () => {
    expect(() => publicKeyFromSpki(new Uint8Array(0))).toThrow()
  })

  test('point not on the curve', () => {
    const bad = Uint8Array.from(validSpki)
    bad[bad.length - 1] = (bad[bad.length - 1] as number) ^ 0x01
    expect(() => publicKeyFromSpki(bad)).toThrow()
  })
})

describe('publicKeyFromAuthenticatorData rejects bad input', () => {
  test('empty input', () => {
    expect(() => publicKeyFromAuthenticatorData(new Uint8Array(0))).toThrow()
  })

  test('too short to hold attested credential data', () => {
    expect(() => publicKeyFromAuthenticatorData(new Uint8Array(40))).toThrow()
  })

  test('attested-credential-data flag not set', () => {
    const authData = authDataFor(validRaw, 16)
    authData[32] = 0x05
    expect(() => publicKeyFromAuthenticatorData(authData)).toThrow()
  })

  test('credential id length runs past the buffer', () => {
    const authData = authDataFor(validRaw, 16)
    authData[53] = 0xff
    authData[54] = 0xff
    expect(() => publicKeyFromAuthenticatorData(authData)).toThrow()
  })
})

describe('derToCompactSignature rejects bad input', () => {
  test('empty input', () => {
    expect(() => derToCompactSignature(new Uint8Array(0))).toThrow()
  })

  test('garbage bytes', () => {
    expect(() => derToCompactSignature(new Uint8Array([0x99, 0x01, 0x02, 0x03]))).toThrow()
  })
})
