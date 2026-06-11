import { webcrypto } from 'node:crypto'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import { describe, expect, test } from 'vitest'
import { concatBytes, toBase64Url } from '../bytes'
import type { WebAuthnApi } from '../webauthn/api'
import { signWithPasskey } from '../webauthn/sign'
import { authorizePayload } from './signing'

const subtle = webcrypto.subtle
const privateKey = new Uint8Array(32)
privateKey[31] = 9
const publicKey = p256.getPublicKey(privateKey, false)
const credentialId = new Uint8Array([1, 2, 3])

// Reproduce a real assertion for a given challenge: the client data carries the
// challenge, and the authenticator signs the contract digest over it.
function buildAssertion(challenge: Uint8Array) {
  const authenticatorData = new Uint8Array(37)
  authenticatorData[32] = 0x05
  const clientDataJSON = new TextEncoder().encode(
    `{"type":"webauthn.get","challenge":"${toBase64Url(challenge)}","origin":"https://wallet.example"}`,
  )
  const preimage = concatBytes(authenticatorData, sha256(clientDataJSON))
  const der = p256.sign(sha256(preimage), privateKey).toBytes('der')
  return { authenticatorData, clientDataJSON, preimage, der }
}

// Compose the real sign wrapper (task 5) with the payload authorization.
const sign = (challenge: Uint8Array) => {
  const { authenticatorData, clientDataJSON, der } = buildAssertion(challenge)
  const api: WebAuthnApi = {
    create: () => Promise.reject(new Error('not used')),
    get: () => Promise.resolve({ credentialId, authenticatorData, clientDataJSON, signature: der }),
  }
  return signWithPasskey({ challenge }, api)
}

describe('authorizePayload', () => {
  test('carries the payload and credential through', async () => {
    const payload = new Uint8Array(32).fill(0x11)
    const authorization = await authorizePayload(payload, sign)

    expect(authorization.payload).toEqual(payload)
    expect(authorization.keyId).toEqual(credentialId)
    expect(authorization.signature.length).toBe(64)
  })

  test('produces a signature that verifies over the signed digest', async () => {
    const payload = new Uint8Array(32).fill(0x22)
    const authorization = await authorizePayload(payload, sign)

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
      authorization.signature,
      buildAssertion(payload).preimage,
    )
    expect(ok).toBe(true)
  })
})
