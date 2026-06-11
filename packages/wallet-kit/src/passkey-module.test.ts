import { describe, expect, test } from 'vitest'
import { type ModuleInterface, ModuleType } from './module-interface'
import { PasskeyModule, type PasskeyModuleConfig } from './passkey-module'

function module(overrides: Partial<PasskeyModuleConfig> = {}) {
  return new PasskeyModule({
    network: 'TESTNET',
    networkPassphrase: 'Test SDF Network ; September 2015',
    getWalletAddress: () => 'CWALLET',
    ...overrides,
  })
}

describe('PasskeyModule metadata', () => {
  test('declares the kit module fields', () => {
    const m = module()
    expect(m.moduleType).toBe(ModuleType.HOT_WALLET)
    expect(m.productId).toBe('passkey')
    expect(m.productName).toBe('Passkey')
    expect(m.productUrl).toMatch(/^https?:\/\//)
    expect(m.productIcon.startsWith('data:image/svg+xml')).toBe(true)
  })

  // Structural conformance: a PasskeyModule is assignable to ModuleInterface.
  test('satisfies ModuleInterface', () => {
    const m: ModuleInterface = module()
    expect(typeof m.getAddress).toBe('function')
  })
})

describe('isAvailable', () => {
  test('uses the override when provided', async () => {
    expect(await module({ isAvailable: () => Promise.resolve(true) }).isAvailable()).toBe(true)
  })

  test('falls back to capability detection (false in a non-browser context)', async () => {
    // No WebAuthn or secure context in the Node test runner, so detection says no.
    expect(await module().isAvailable()).toBe(false)
  })
})

describe('getAddress', () => {
  test('returns the connected wallet address', async () => {
    expect(await module().getAddress()).toEqual({ address: 'CWALLET' })
  })

  test('throws when no wallet is connected', async () => {
    await expect(module({ getWalletAddress: () => null }).getAddress()).rejects.toThrow(
      /no passkey wallet/i,
    )
  })
})

describe('getNetwork', () => {
  test('reports the configured network', async () => {
    expect(await module().getNetwork()).toEqual({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
  })
})

describe('signing', () => {
  test('delegates signTransaction to the configured signer', async () => {
    const m = module({
      signTransaction: (xdr) => Promise.resolve({ signedTxXdr: `signed:${xdr}` }),
    })
    expect(await m.signTransaction('XDR')).toEqual({ signedTxXdr: 'signed:XDR' })
  })

  test('throws a guiding error when signTransaction is not configured', async () => {
    await expect(module().signTransaction('XDR')).rejects.toThrow(/not configured/i)
  })

  test('rejects arbitrary message signing', async () => {
    await expect(module().signMessage()).rejects.toThrow(/do not support/i)
  })
})
