import { useEffect, useSyncExternalStore } from 'react'
import type { Flow } from '../flows/flow'
import type { FlowState } from '../flows/types'

export interface UseFlowResult<Result> {
  state: FlowState<Result>
  start: () => Promise<void>
  proceed: () => Promise<void>
  retry: () => Promise<void>
  reset: () => void
}

// Bind a flow controller to React. The store already speaks useSyncExternalStore's
// language, so this is a thin adapter plus an optional auto-start on mount.
export function useFlow<Result>(
  flow: Flow<Result>,
  options: { autoStart?: boolean } = {},
): UseFlowResult<Result> {
  const state = useSyncExternalStore(flow.store.subscribe, flow.store.getState, flow.store.getState)

  const { autoStart } = options
  useEffect(() => {
    if (autoStart && flow.store.getState().phase === 'idle') void flow.start()
  }, [flow, autoStart])

  return { state, start: flow.start, proceed: flow.proceed, retry: flow.retry, reset: flow.reset }
}
