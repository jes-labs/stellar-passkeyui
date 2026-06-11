import type { Capabilities, CompatRule, FallbackActionId } from '@passkey-ui/core'
import type { FlowNotice } from './types'

// This is where the compatibility matrix becomes UI. The fallback rules the core
// engine selects for the current platform turn into notices, and the few that the
// flow genuinely cannot work around become blockers.

// require-secure-context is the only action that stops a flow outright: without a
// secure context there is no WebAuthn to fall back to. The rest are things the UI
// can warn about and still proceed (open a popup, show an explicit button, etc.).
const BLOCKING_ACTIONS: ReadonlySet<FallbackActionId> = new Set(['require-secure-context'])

export function noticesFromRules(rules: readonly CompatRule[]): FlowNotice[] {
  return rules.map((rule) => ({
    code: rule.action,
    reason: rule.reason,
    severity: BLOCKING_ACTIONS.has(rule.action) ? 'blocker' : 'advisory',
  }))
}

export interface Readiness {
  blocked: boolean
  notices: FlowNotice[]
}

export function assessReadiness(
  capabilities: Capabilities,
  rules: readonly CompatRule[],
): Readiness {
  const notices = noticesFromRules(rules)

  if (!capabilities.webauthnAvailable)
    notices.unshift({
      code: 'webauthn-unavailable',
      reason: 'This browser or device does not support passkeys (WebAuthn).',
      severity: 'blocker',
    })

  return { blocked: notices.some((notice) => notice.severity === 'blocker'), notices }
}
