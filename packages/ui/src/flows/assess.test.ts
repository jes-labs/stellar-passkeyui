import { describe, expect, test } from 'vitest'
import { assessReadiness, noticesFromRules } from './assess'
import { fakeCapabilities, fakeRule } from './test-helpers'

describe('noticesFromRules', () => {
  test('marks require-secure-context as a blocker', () => {
    const [notice] = noticesFromRules([fakeRule('require-secure-context')])
    expect(notice?.severity).toBe('blocker')
  })

  test('marks other actions as advisory', () => {
    const [notice] = noticesFromRules([fakeRule('open-popup-for-create')])
    expect(notice?.severity).toBe('advisory')
  })
})

describe('assessReadiness', () => {
  test('is ready when only advisory notices apply', () => {
    const result = assessReadiness(fakeCapabilities(), [fakeRule('show-explicit-passkey-button')])
    expect(result.blocked).toBe(false)
    expect(result.notices).toHaveLength(1)
  })

  test('is blocked when a blocking rule applies', () => {
    const result = assessReadiness(fakeCapabilities({ secureContext: false }), [
      fakeRule('require-secure-context'),
    ])
    expect(result.blocked).toBe(true)
  })

  test('prepends a blocker when WebAuthn is unavailable', () => {
    const result = assessReadiness(fakeCapabilities({ webauthnAvailable: false }), [])
    expect(result.blocked).toBe(true)
    expect(result.notices[0]?.code).toBe('webauthn-unavailable')
  })
})
