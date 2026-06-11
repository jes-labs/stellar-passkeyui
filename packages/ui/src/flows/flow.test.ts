import type { Capabilities, CompatRule } from '@passkey-ui/core'
import { describe, expect, test, vi } from 'vitest'
import { type FlowDeps, createFlow } from './flow'
import { fakeCapabilities, fakeRule } from './test-helpers'

function deps(overrides: Partial<FlowDeps<string>> = {}): FlowDeps<string> {
  return {
    detectCapabilities: () => Promise.resolve(fakeCapabilities()),
    selectFallbacks: () => [],
    run: () => Promise.resolve('done'),
    ...overrides,
  }
}

describe('createFlow lifecycle', () => {
  test('starts idle', () => {
    expect(createFlow(deps()).store.getState().phase).toBe('idle')
  })

  test('start moves to ready when nothing blocks', async () => {
    const flow = createFlow(deps())
    await flow.start()
    expect(flow.store.getState().phase).toBe('ready')
  })

  test('start moves to blocked when a blocking rule applies', async () => {
    const flow = createFlow(
      deps({ selectFallbacks: (): CompatRule[] => [fakeRule('require-secure-context')] }),
    )
    await flow.start()
    expect(flow.store.getState().phase).toBe('blocked')
  })

  test('proceed runs the ceremony and reaches success', async () => {
    const flow = createFlow(deps())
    await flow.start()
    await flow.proceed()
    const state = flow.store.getState()
    expect(state.phase).toBe('success')
    expect(state.result).toBe('done')
  })

  test('proceed is a no-op while blocked', async () => {
    const run = vi.fn(() => Promise.resolve('done'))
    const flow = createFlow(
      deps({ selectFallbacks: () => [fakeRule('require-secure-context')], run }),
    )
    await flow.start()
    await flow.proceed()
    expect(run).not.toHaveBeenCalled()
    expect(flow.store.getState().phase).toBe('blocked')
  })

  test('a failing ceremony produces a retryable error, and retry can recover', async () => {
    let attempts = 0
    const flow = createFlow(
      deps({
        run: () => {
          attempts += 1
          if (attempts === 1) return Promise.reject(new Error('user cancelled'))
          return Promise.resolve('done')
        },
      }),
    )
    await flow.start()
    await flow.proceed()

    const failed = flow.store.getState()
    expect(failed.phase).toBe('error')
    expect(failed.error).toEqual({ message: 'user cancelled', retryable: true })

    await flow.retry()
    expect(flow.store.getState().phase).toBe('success')
  })

  test('a failing capability check surfaces as an error', async () => {
    const flow = createFlow(
      deps({ detectCapabilities: (): Promise<Capabilities> => Promise.reject(new Error('boom')) }),
    )
    await flow.start()
    expect(flow.store.getState().phase).toBe('error')
  })

  test('reset returns to idle', async () => {
    const flow = createFlow(deps())
    await flow.start()
    await flow.proceed()
    flow.reset()
    expect(flow.store.getState().phase).toBe('idle')
  })

  test('notifies subscribers on each transition', async () => {
    const flow = createFlow(deps())
    const listener = vi.fn()
    flow.store.subscribe(listener)
    await flow.start()
    await flow.proceed()
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
