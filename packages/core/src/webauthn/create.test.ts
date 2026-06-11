import { webcrypto } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { bytesToHex, concatBytes, toBase64Url } from '../bytes'
import type { RawCreateResult, WebAuthnApi } from './api'
import { createPasskey } from './create'

const subtle = webcrypto.subtle

function fakeApi(raw: RawCreateResult): WebAuthnApi {
  return {
    create: () => Promise.resolve(raw),
    get: () => Promise.reject(new Error('not used')),
  }
}

const input = {
  rp: { name: 'Wallet' },
  user: { id: new Uint8Array([1]), name: 'alice' },
}

function coseAuthenticatorData(rawPoint: Uint8Array): Uint8Array {
  const cose = concatBytes(
    new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    rawPoint.subarray(1, 33),
    new Uint8Array([0x22, 0x58, 0x20]),
    rawPoint.subarray(33, 65),
  )
  const head = new Uint8Array(55)
  head[32] = 0x45
  head[53] = 0x00
  head[54] = 0x10
  return concatBytes(head, new Uint8Array(16).fill(0xab), cose)
}

describe('createPasskey', () => {
  test('extracts the signer key from a DER SPKI credential', async () => {
    const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const raw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey))
    const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey))

    const credentialId = new Uint8Array([10, 20, 30])
    const result = await createPasskey(
      input,
      fakeApi({ credentialId, publicKeySpki: spki, residentKey: true }),
    )

    expect(bytesToHex(result.publicKey)).toBe(bytesToHex(raw))
    expect(result.credentialIdBase64Url).toBe(toBase64Url(credentialId))
    expect(result.residentKey).toBe(true)
  })

  test('falls back to authenticator data when no SPKI is present', async () => {
    const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const raw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey))

    const result = await createPasskey(
      input,
      fakeApi({
        credentialId: new Uint8Array([1, 2]),
        authenticatorData: coseAuthenticatorData(raw),
      }),
    )

    expect(bytesToHex(result.publicKey)).toBe(bytesToHex(raw))
  })

  test('throws when the credential exposes no public key', async () => {
    await expect(
      createPasskey(input, fakeApi({ credentialId: new Uint8Array([1]) })),
    ).rejects.toThrow(/no public key/)
  })
})
