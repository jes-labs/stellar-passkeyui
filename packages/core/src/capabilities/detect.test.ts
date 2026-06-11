import { describe, expect, test } from 'vitest'
import { detectCapabilities } from './detect'
import { browserEnvironment } from './environment'
import type { PasskeyEnvironment } from './types'

function fakeEnv(overrides: Partial<PasskeyEnvironment> = {}): PasskeyEnvironment {
  return {
    secureContext: true,
    webauthnAvailable: true,
    inIframe: false,
    crossOriginIframe: false,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    isPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    isConditionalMediationAvailable: () => Promise.resolve(true),
    ...overrides,
  }
}

describe('detectCapabilities', () => {
  test('resolves the async probes and the browser', async () => {
    const caps = await detectCapabilities(fakeEnv())
    expect(caps).toMatchObject({
      webauthnAvailable: true,
      secureContext: true,
      platformAuthenticator: true,
      conditionalMediation: true,
      browser: 'chrome',
      engine: 'blink',
    })
  })

  test('skips the probes when WebAuthn is unavailable', async () => {
    let probed = false
    const caps = await detectCapabilities(
      fakeEnv({
        webauthnAvailable: false,
        isPlatformAuthenticatorAvailable: () => {
          probed = true
          return Promise.resolve(true)
        },
      }),
    )
    expect(probed).toBe(false)
    expect(caps.platformAuthenticator).toBe(false)
    expect(caps.conditionalMediation).toBe(false)
  })

  test('treats a throwing probe as feature-absent', async () => {
    const caps = await detectCapabilities(
      fakeEnv({
        isPlatformAuthenticatorAvailable: () => Promise.reject(new Error('boom')),
      }),
    )
    expect(caps.platformAuthenticator).toBe(false)
    expect(caps.conditionalMediation).toBe(true)
  })
})

describe('browserEnvironment', () => {
  // In the Node test runner there are no browser globals, so it must degrade to
  // conservative defaults instead of throwing.
  test('returns safe defaults outside a browser', () => {
    const env = browserEnvironment()
    expect(env.webauthnAvailable).toBe(false)
    expect(env.secureContext).toBe(false)
    expect(env.inIframe).toBe(false)
  })
})
