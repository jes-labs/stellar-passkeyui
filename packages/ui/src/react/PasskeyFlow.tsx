import type { CSSProperties, ReactNode } from 'react'
import type { Flow } from '../flows/flow'
import type { FlowNotice } from '../flows/types'
import { type ThemeTokens, themeToCssVariables } from '../tokens'
import { useFlow } from './useFlow'

export interface PasskeyFlowLabels {
  action?: string
  prompting?: string
  success?: string
  retry?: string
  blocked?: string
}

export interface PasskeyFlowProps<Result> {
  flow: Flow<Result>
  labels?: PasskeyFlowLabels
  theme?: ThemeTokens
  autoStart?: boolean
  className?: string
  renderSuccess?: (result: Result) => ReactNode
}

// One component renders every state a passkey flow can be in. It ships structure,
// data-attributes, and CSS-variable theming, not a design system — a consumer
// styles the `pk-*` classes to taste. Crucially it renders the blocked, advisory,
// and error states the compatibility matrix says occur, not only the happy path.
export function PasskeyFlow<Result>({
  flow,
  labels = {},
  theme,
  autoStart = true,
  className,
  renderSuccess,
}: PasskeyFlowProps<Result>) {
  const { state, start, proceed, retry } = useFlow(flow, { autoStart })

  const style = {
    ...(themeToCssVariables(theme) as CSSProperties),
    fontFamily: 'var(--pk-font-family)',
    color: 'var(--pk-foreground)',
  }

  return (
    <div
      className={['pk-flow', className].filter(Boolean).join(' ')}
      data-phase={state.phase}
      style={style}
    >
      <NoticeList notices={state.notices} />

      {(state.phase === 'idle' || state.phase === 'ready') && (
        <button
          type="button"
          className="pk-button"
          onClick={() => void (state.phase === 'idle' ? start() : proceed())}
        >
          {labels.action ?? 'Continue'}
        </button>
      )}

      {state.phase === 'checking' && <p className="pk-status">Checking your device…</p>}

      {state.phase === 'prompting' && (
        <p className="pk-status" aria-busy="true">
          {labels.prompting ?? 'Waiting for your passkey…'}
        </p>
      )}

      {state.phase === 'blocked' && (
        <p className="pk-status pk-status--blocked">
          {labels.blocked ?? 'This device can’t complete the passkey flow. See the notices above.'}
        </p>
      )}

      {state.phase === 'error' && (
        <div role="alert" className="pk-error">
          <p>{state.error?.message}</p>
          {state.error?.retryable && (
            <button type="button" className="pk-button" onClick={() => void retry()}>
              {labels.retry ?? 'Try again'}
            </button>
          )}
        </div>
      )}

      {state.phase === 'success' && (
        <div className="pk-success">
          {renderSuccess && state.result !== undefined ? (
            renderSuccess(state.result)
          ) : (
            <p>{labels.success ?? 'Done.'}</p>
          )}
        </div>
      )}
    </div>
  )
}

function NoticeList({ notices }: { notices: readonly FlowNotice[] }) {
  if (notices.length === 0) return null
  return (
    <ul className="pk-notices">
      {notices.map((notice) => (
        <li
          key={notice.code}
          className={`pk-notice pk-notice--${notice.severity}`}
          style={{
            color: notice.severity === 'blocker' ? 'var(--pk-blocker)' : 'var(--pk-advisory)',
          }}
        >
          {notice.reason}
        </li>
      ))}
    </ul>
  )
}
