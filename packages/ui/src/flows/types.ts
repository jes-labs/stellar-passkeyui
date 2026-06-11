import type { FallbackActionId } from '@passkey-ui/core'

// The states a passkey flow can be in. These map directly onto what the UI must
// render: not just the happy path, but the blocked and advisory states the
// compatibility matrix says actually occur.
export type FlowPhase =
  | 'idle'
  | 'checking'
  | 'blocked'
  | 'ready'
  | 'prompting'
  | 'success'
  | 'error'

// A notice surfaced to the user. The code is a documented fallback action, or the
// catch-all for a platform with no WebAuthn at all.
export type NoticeCode = FallbackActionId | 'webauthn-unavailable'

export interface FlowNotice {
  code: NoticeCode
  reason: string
  // blocker stops the flow; advisory lets it proceed with a heads-up.
  severity: 'blocker' | 'advisory'
}

export interface FlowError {
  message: string
  retryable: boolean
}

export interface FlowState<Result> {
  phase: FlowPhase
  notices: readonly FlowNotice[]
  result?: Result
  error?: FlowError
}
