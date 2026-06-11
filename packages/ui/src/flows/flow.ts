import type { Capabilities, CompatRule } from '@passkey-ui/core'
import { assessReadiness } from './assess'
import { type Store, createStore } from './store'
import type { FlowState } from './types'

// The shared controller behind all three flows. It owns the lifecycle —
// check capabilities, surface notices, run the ceremony, handle errors and
// retries — while each flow supplies only its own `run` step. Keeping the
// lifecycle in one place means create, sign, and recover behave consistently.
export interface FlowDeps<Result> {
  detectCapabilities: () => Promise<Capabilities>
  selectFallbacks: (capabilities: Capabilities) => CompatRule[]
  run: () => Promise<Result>
}

export interface Flow<Result> {
  store: Store<FlowState<Result>>
  /** Detect capabilities and move to ready or blocked. */
  start(): Promise<void>
  /** Run the ceremony. No-op while blocked. */
  proceed(): Promise<void>
  /** Re-run the ceremony after a retryable error. */
  retry(): Promise<void>
  /** Return to the initial state. */
  reset(): void
}

export function createFlow<Result>(deps: FlowDeps<Result>): Flow<Result> {
  const store = createStore<FlowState<Result>>({ phase: 'idle', notices: [] })

  async function start(): Promise<void> {
    store.setState({ phase: 'checking', notices: [] })
    try {
      const capabilities = await deps.detectCapabilities()
      const { blocked, notices } = assessReadiness(capabilities, deps.selectFallbacks(capabilities))
      store.setState({ phase: blocked ? 'blocked' : 'ready', notices })
    } catch (error) {
      store.setState({
        phase: 'error',
        notices: [],
        error: { message: messageOf(error), retryable: true },
      })
    }
  }

  async function proceed(): Promise<void> {
    const { phase, notices } = store.getState()
    if (phase === 'blocked' || phase === 'checking') return

    store.setState({ phase: 'prompting', notices })
    try {
      const result = await deps.run()
      store.setState({ phase: 'success', notices, result })
    } catch (error) {
      store.setState({
        phase: 'error',
        notices,
        error: { message: messageOf(error), retryable: true },
      })
    }
  }

  async function retry(): Promise<void> {
    if (store.getState().phase !== 'error') return
    await proceed()
  }

  function reset(): void {
    store.setState({ phase: 'idle', notices: [] })
  }

  return { store, start, proceed, retry, reset }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
