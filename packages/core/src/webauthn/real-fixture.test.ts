import { describe, expect, test } from 'vitest'
import { bytesToHex, fromBase64Url } from '../bytes'
import { publicKeyFromAuthenticatorData, publicKeyFromSpki } from './public-key'

// Real registration output captured from an actual authenticator (sourced from
// passkey-kit's bun_tests). Validating against this proves the parsers work on
// genuine device output, not just synthetic vectors we built ourselves.
const REAL_SPKI = fromBase64Url(
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIWhAQyE5H-_9WM__87tYZq3yJPQ0rostof00z3MMSMqG3SuBh2TaTUHQDwd4CHyArPQ4EhKoScPbq0zxm1k_Dw',
)
const REAL_AUTHENTICATOR_DATA = fromBase64Url(
  'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NBAAAABAAAAAAAAAAAAAAAAAAAAAAAQA8EYfqizPJVk0HtwVdqazrXmAyb7tuHDD7PzBmf6gFOyCngKjd1RCTIQHCpS3SMyeYULBg7Ykx6n1usOd5PlSilAQIDJiABIVggIWhAQyE5H-_9WM__87tYZq3yJPQ0rostof00z3MMSMoiWCCG3SuBh2TaTUHQDwd4CHyArPQ4EhKoScPbq0zxm1k_Dw',
)

describe('real authenticator fixture', () => {
  // The reference (last 65 bytes of the DER SPKI key) is how passkey-kit itself
  // pulls the point, so this also confirms we agree with the established lineage.
  const expected = bytesToHex(REAL_SPKI.subarray(REAL_SPKI.length - 65))

  test('SPKI extraction matches the embedded point', () => {
    expect(bytesToHex(publicKeyFromSpki(REAL_SPKI))).toBe(expected)
  })

  test('COSE extraction from authenticator data matches the SPKI key', () => {
    expect(bytesToHex(publicKeyFromAuthenticatorData(REAL_AUTHENTICATOR_DATA))).toBe(expected)
  })
})
