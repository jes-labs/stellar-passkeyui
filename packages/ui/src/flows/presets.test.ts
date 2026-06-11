import type { CreatePasskeyInput, CreatePasskeyResult } from '@passkey-ui/core'
import { describe, expect, test, vi } from 'vitest'
import { createCreatePasskeyFlow, createRecoverFlow } from './presets'
import { fakeCapabilities } from './test-helpers'

const input: CreatePasskeyInput = {
  rp: { name: 'Wallet' },
  user: { id: new Uint8Array([1]), name: 'alice' },
}

function result(id: number): CreatePasskeyResult {
  return {
    credentialId: new Uint8Array([id]),
    credentialIdBase64Url: String(id),
    publicKey: new Uint8Array(65),
    raw: { credentialId: new Uint8Array([id]) },
  }
}

const capabilityDeps = {
  detectCapabilities: () => Promise.resolve(fakeCapabilities()),
  selectFallbacks: () => [],
}

describe('createCreatePasskeyFlow', () => {
  test('runs createPasskey with the configured input', async () => {
    const createPasskey = vi.fn(() => Promise.resolve(result(1)))
    const flow = createCreatePasskeyFlow({ ...capabilityDeps, createPasskey, input })

    await flow.start()
    await flow.proceed()

    expect(createPasskey).toHaveBeenCalledWith(input)
    expect(flow.store.getState().result?.credentialIdBase64Url).toBe('1')
  })
})

describe('createRecoverFlow', () => {
  test('enrolls a passkey and then adds it as a signer', async () => {
    const order: string[] = []
    const enrollPasskey = vi.fn(() => {
      order.push('enroll')
      return Promise.resolve(result(2))
    })
    const addSigner = vi.fn(() => {
      order.push('addSigner')
      return Promise.resolve()
    })
    const flow = createRecoverFlow({ ...capabilityDeps, enrollPasskey, input, addSigner })

    await flow.start()
    await flow.proceed()

    expect(order).toEqual(['enroll', 'addSigner'])
    expect(flow.store.getState().phase).toBe('success')
  })

  test('surfaces a failed add-signer as a retryable error', async () => {
    const flow = createRecoverFlow({
      ...capabilityDeps,
      enrollPasskey: () => Promise.resolve(result(3)),
      input,
      addSigner: () => Promise.reject(new Error('add signer rejected')),
    })

    await flow.start()
    await flow.proceed()

    expect(flow.store.getState().phase).toBe('error')
    expect(flow.store.getState().error?.retryable).toBe(true)
  })
})
