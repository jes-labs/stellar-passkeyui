// A tiny observable store. The signature (subscribe with a no-arg listener plus
// getState) is exactly what React's useSyncExternalStore expects, so the flow
// layer stays framework-agnostic while binding cleanly to React.
export interface Store<T> {
  getState(): T
  setState(next: T): void
  subscribe(listener: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState(next) {
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
