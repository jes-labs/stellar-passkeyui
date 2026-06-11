import { describe, expect, test } from 'vitest'
import { compatRules } from '../generated/compat-rules.gen'
import { activeConditions, selectFallbacks } from './fallbacks'
import type { Capabilities, ConditionObservations } from './types'

// A fully healthy platform: secure, top-level, Blink, both probes available.
function healthy(overrides: Partial<Capabilities> = {}): Capabilities {
  return {
    webauthnAvailable: true,
    secureContext: true,
    inIframe: false,
    crossOriginIframe: false,
    platformAuthenticator: true,
    conditionalMediation: true,
    browser: 'chrome',
    engine: 'blink',
    ...overrides,
  }
}

const actionsFor = (caps: Capabilities, obs?: ConditionObservations) =>
  selectFallbacks(caps, obs).map((rule) => rule.action)

describe('selectFallbacks', () => {
  test('a healthy platform triggers no fallbacks', () => {
    expect(selectFallbacks(healthy())).toEqual([])
  })

  test('an insecure context requires a secure context', () => {
    expect(actionsFor(healthy({ secureContext: false }))).toContain('require-secure-context')
  })

  test('WebKit in a cross-origin iframe routes creation to a popup', () => {
    const caps = healthy({
      engine: 'webkit',
      browser: 'safari',
      inIframe: true,
      crossOriginIframe: true,
    })
    const actions = actionsFor(caps)
    expect(actions).toContain('open-popup-for-create')
    expect(actions).toContain('set-iframe-permissions-or-popup')
  })

  test('Blink in a cross-origin iframe needs permissions, not a popup for creation', () => {
    const caps = healthy({ engine: 'blink', inIframe: true, crossOriginIframe: true })
    const actions = actionsFor(caps)
    expect(actions).toContain('set-iframe-permissions-or-popup')
    expect(actions).not.toContain('open-popup-for-create')
  })

  test('no platform authenticator offers cross-device or a security key', () => {
    expect(actionsFor(healthy({ platformAuthenticator: false }))).toContain(
      'offer-cross-device-or-security-key',
    )
  })

  test('no conditional mediation falls back to an explicit button', () => {
    expect(actionsFor(healthy({ conditionalMediation: false }))).toContain(
      'show-explicit-passkey-button',
    )
  })

  test('a resident key not created is observed, not pre-flight detected', () => {
    expect(actionsFor(healthy())).not.toContain('use-credential-id-allowlist')
    expect(actionsFor(healthy(), { residentKeyCreated: false })).toContain(
      'use-credential-id-allowlist',
    )
  })
})

describe('rule reachability', () => {
  // Every shipped rule must be reachable by some platform state, otherwise it is
  // dead data masquerading as coverage.
  test('each generated rule can be triggered', () => {
    const triggers: Record<string, () => ReturnType<typeof selectFallbacks>> = {
      'safari-create-in-iframe': () =>
        selectFallbacks(healthy({ engine: 'webkit', crossOriginIframe: true, inIframe: true })),
      'cross-origin-iframe': () =>
        selectFallbacks(healthy({ crossOriginIframe: true, inIframe: true })),
      'insecure-context': () => selectFallbacks(healthy({ secureContext: false })),
      'no-resident-key': () => selectFallbacks(healthy(), { residentKeyCreated: false }),
      'no-conditional-mediation': () => selectFallbacks(healthy({ conditionalMediation: false })),
      'no-platform-authenticator': () => selectFallbacks(healthy({ platformAuthenticator: false })),
    }

    for (const rule of compatRules) {
      const trigger = triggers[rule.condition]
      expect(trigger, `no trigger defined for condition ${rule.condition}`).toBeDefined()
      const fired = trigger?.().some((selected) => selected.id === rule.id)
      expect(fired, `rule ${rule.id} was not reachable`).toBe(true)
    }
  })
})

describe('activeConditions', () => {
  test('reports the conditions that hold', () => {
    const conditions = activeConditions(
      healthy({ secureContext: false, conditionalMediation: false }),
    )
    expect(conditions).toContain('insecure-context')
    expect(conditions).toContain('no-conditional-mediation')
  })
})
