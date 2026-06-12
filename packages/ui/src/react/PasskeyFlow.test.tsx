import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { createFlow } from '../flows/flow'
import { fakeCapabilities, fakeRule } from '../flows/test-helpers'
import { PasskeyFlow } from './PasskeyFlow'

afterEach(cleanup)

const healthyDeps = {
  detectCapabilities: () => Promise.resolve(fakeCapabilities()),
  selectFallbacks: () => [],
}

describe('PasskeyFlow', () => {
  test('renders the action button and runs through to success', async () => {
    const flow = createFlow({ ...healthyDeps, run: () => Promise.resolve('ok') })
    render(
      <PasskeyFlow flow={flow} autoStart={false} labels={{ action: 'Go', success: 'All set.' }} />,
    )

    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy()

    await act(async () => {
      await flow.start()
    })
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy()

    await act(async () => {
      await flow.proceed()
    })
    expect(screen.getByText('All set.')).toBeTruthy()
  })

  test('renders blocker notices and no action button when blocked', async () => {
    const flow = createFlow({
      detectCapabilities: () => Promise.resolve(fakeCapabilities({ secureContext: false })),
      selectFallbacks: () => [fakeRule('require-secure-context')],
      run: () => Promise.resolve('ok'),
    })
    render(<PasskeyFlow flow={flow} autoStart={false} labels={{ action: 'Go' }} />)

    await act(async () => {
      await flow.start()
    })

    expect(screen.getByText(/reason for require-secure-context/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull()
  })

  test('a single click from idle runs the check and the ceremony', async () => {
    const flow = createFlow({ ...healthyDeps, run: () => Promise.resolve('ok') })
    render(
      <PasskeyFlow flow={flow} autoStart={false} labels={{ action: 'Go', success: 'Done!' }} />,
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Go' }).click()
      // Let the start -> ready -> proceed chain settle.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(flow.store.getState().phase).toBe('success')
    expect(screen.getByText('Done!')).toBeTruthy()
  })

  test('renders a retryable error with a retry button', async () => {
    let attempts = 0
    const flow = createFlow({
      ...healthyDeps,
      run: () => {
        attempts += 1
        return attempts === 1 ? Promise.reject(new Error('cancelled')) : Promise.resolve('ok')
      },
    })
    render(<PasskeyFlow flow={flow} autoStart={false} labels={{ retry: 'Retry' }} />)

    await act(async () => {
      await flow.start()
      await flow.proceed()
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('cancelled')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
