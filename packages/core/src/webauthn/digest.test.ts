import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { challengeFromPayload, webauthnSignedDigest } from './digest'

const utf8 = (value: string) => new TextEncoder().encode(value)

describe('webauthnSignedDigest', () => {
  // Recompute the expected digest with Node's crypto, independent of @noble, to
  // confirm we match sha256(authenticatorData || sha256(clientDataJSON)).
  test('matches the contract digest construction', () => {
    const authenticatorData = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    const clientDataJSON = utf8('{"type":"webauthn.get","challenge":"abc"}')

    const innerHash = createHash('sha256').update(clientDataJSON).digest()
    const expected = createHash('sha256')
      .update(Buffer.concat([Buffer.from(authenticatorData), innerHash]))
      .digest()

    expect(Buffer.from(webauthnSignedDigest(authenticatorData, clientDataJSON))).toEqual(expected)
  })
})

describe('challengeFromPayload', () => {
  test('base64url-encodes the payload the way the contract expects', () => {
    const payload = new Uint8Array(32)
    for (let i = 0; i < payload.length; i++) payload[i] = i

    expect(challengeFromPayload(payload)).toBe(Buffer.from(payload).toString('base64url'))
  })
})
