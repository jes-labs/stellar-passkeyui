import type {
  Capabilities,
  CompatRule,
  FallbackActionId,
  RuntimeConditionId,
} from '@passkey-ui/core'

export function fakeCapabilities(overrides: Partial<Capabilities> = {}): Capabilities {
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

export function fakeRule(
  action: FallbackActionId,
  condition: RuntimeConditionId = 'insecure-context',
): CompatRule {
  return {
    id: `rule-${action}`,
    condition,
    action,
    feature: 'credential-get',
    outcome: 'partial',
    reason: `reason for ${action}`,
    sources: ['https://example.com'],
    lastVerified: '2026-06-11',
  }
}
