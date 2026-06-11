import { describe, expect, test } from 'vitest'
import { buildCreationOptions, buildRequestOptions } from './options'

describe('buildCreationOptions', () => {
  const base = {
    rp: { name: 'Wallet' },
    user: { id: new Uint8Array([1, 2, 3]), name: 'alice' },
  }

  test('requests only ES256', () => {
    const options = buildCreationOptions(base)
    expect(options.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }])
  })

  test('defaults attestation to none and asks for credProps', () => {
    const options = buildCreationOptions(base)
    expect(options.attestation).toBe('none')
    expect(options.extensions?.credProps).toBe(true)
  })

  test('defaults user verification and resident key to preferred', () => {
    const options = buildCreationOptions(base)
    expect(options.authenticatorSelection?.userVerification).toBe('preferred')
    expect(options.authenticatorSelection?.residentKey).toBe('preferred')
  })

  test('falls back displayName to name and omits rp.id when not given', () => {
    const options = buildCreationOptions(base)
    expect(options.user.displayName).toBe('alice')
    expect(options.rp.id).toBeUndefined()
  })

  test('passes rp.id through when provided', () => {
    const options = buildCreationOptions({ ...base, rp: { name: 'Wallet', id: 'wallet.example' } })
    expect(options.rp.id).toBe('wallet.example')
  })
})

describe('buildRequestOptions', () => {
  const challenge = new Uint8Array(32).fill(7)

  test('uses the challenge and defaults user verification to preferred', () => {
    const options = buildRequestOptions({ challenge })
    // The builder copies the bytes into a fresh buffer, so compare by value.
    expect(options.challenge).toEqual(challenge)
    expect(options.userVerification).toBe('preferred')
  })

  test('omits allowCredentials and rpId when not supplied', () => {
    const options = buildRequestOptions({ challenge })
    expect(options.allowCredentials).toBeUndefined()
    expect(options.rpId).toBeUndefined()
  })

  test('maps credential ids into allowCredentials descriptors', () => {
    const id = new Uint8Array([9, 9, 9])
    const options = buildRequestOptions({
      challenge,
      allowCredentials: [id],
      rpId: 'wallet.example',
    })
    expect(options.rpId).toBe('wallet.example')
    expect(options.allowCredentials).toEqual([{ type: 'public-key', id }])
  })
})
