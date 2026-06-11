import { Keypair, Networks, StrKey } from '@stellar/stellar-sdk'
import { describe, expect, test } from 'vitest'
import { deriveWalletAddress } from './address'

const deployer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey()
const keyId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])

describe('deriveWalletAddress', () => {
  test('produces a valid contract address', () => {
    const address = deriveWalletAddress({
      deployer,
      keyId,
      networkPassphrase: Networks.TESTNET,
    })
    expect(address.startsWith('C')).toBe(true)
    expect(StrKey.isValidContract(address)).toBe(true)
  })

  test('is deterministic for the same inputs', () => {
    const args = { deployer, keyId, networkPassphrase: Networks.TESTNET }
    expect(deriveWalletAddress(args)).toBe(deriveWalletAddress(args))
  })

  test('changes with the credential id', () => {
    const a = deriveWalletAddress({ deployer, keyId, networkPassphrase: Networks.TESTNET })
    const b = deriveWalletAddress({
      deployer,
      keyId: new Uint8Array([9, 9, 9, 9]),
      networkPassphrase: Networks.TESTNET,
    })
    expect(a).not.toBe(b)
  })

  test('changes with the network', () => {
    const a = deriveWalletAddress({ deployer, keyId, networkPassphrase: Networks.TESTNET })
    const b = deriveWalletAddress({ deployer, keyId, networkPassphrase: Networks.PUBLIC })
    expect(a).not.toBe(b)
  })
})
