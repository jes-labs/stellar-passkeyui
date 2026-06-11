import { webcrypto } from 'node:crypto'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import { describe, expect, test } from 'vitest'
import { concatBytes, toBase64Url } from '../bytes'
import type { RawGetResult, WebAuthnApi } from './api'
import { signWithPasskey } from './sign'

const subtle = webcrypto.subtle

function fakeApi(raw: RawGetResult): WebAuthnApi {
  return {
    create: () => Promise.reject(new Error('not used')),
    get: () => Promise.resolve(raw),
  }
}

describe('signWithPasskey', () => {
  // Build a realistic assertion: sign the exact digest the contract re-derives,
  // then confirm the wrapper hands back a compact signature Web Crypto accepts.
  test('assembles a compact signature that verifies over the signed digest', async () => {
    const privateKey = new Uint8Array(32)
    privateKey[31] = 7
    const publicKey = p256.getPublicKey(privateKey, false)

    const challenge = new Uint8Array(32).fill(3)
    const authenticatorData = new Uint8Array(37)
    authenticatorData[32] = 0x05 // user present + verified, no attested data
    const clientDataJSON = new TextEncoder().encode(
      `{"type":"webauthn.get","challenge":"${toBase64Url(challenge)}","origin":"https://wallet.example"}`,
    )

    const signedDigest = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)))
    const der = p256.sign(signedDigest, privateKey).toBytes('der')

    const credentialId = new Uint8Array([5, 6, 7])
    const result = await signWithPasskey(
      { challenge },
      fakeApi({ credentialId, authenticatorData, clientDataJSON, signature: der }),
    )

    expect(result.signature.length).toBe(64)
    expect(result.credentialIdBase64Url).toBe(toBase64Url(credentialId))
    expect(Buffer.from(result.signedDigest)).toEqual(Buffer.from(signedDigest))

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
      result.signature,
      // Web Crypto hashes the input; the authenticator signed sha256(input), so
      // we pass the preimage of the signed digest: authData || sha256(clientData).
      concatBytes(authenticatorData, sha256(clientDataJSON)),
    )
    expect(ok).toBe(true)
  })
})
