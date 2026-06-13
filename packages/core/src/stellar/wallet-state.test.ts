import { Keypair, Networks, xdr } from '@stellar/stellar-sdk'
import { describe, expect, test } from 'vitest'
import { deriveWalletAddress } from './address'
import {
  contractInstanceLedgerKey,
  rpcWalletStateReader,
  secp256r1SignerLedgerKey,
} from './wallet-state'

const wallet = deriveWalletAddress({
  deployer: Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey(),
  keyId: new Uint8Array([1, 2, 3]),
  networkPassphrase: Networks.TESTNET,
})
const credentialId = new Uint8Array(20).fill(0xcd)

describe('ledger key construction', () => {
  test('signer key is contract data under SignerKey::Secp256r1(credentialId), persistent', () => {
    const key = secp256r1SignerLedgerKey(wallet, credentialId)
    const data = key.contractData()

    expect(data.durability()).toEqual(xdr.ContractDataDurability.persistent())

    const scval = data.key().vec()!
    expect(scval[0]!.sym().toString()).toBe('Secp256r1')
    expect(new Uint8Array(scval[1]!.bytes())).toEqual(credentialId)

    // Round-trips through XDR, so it can actually be sent to an RPC.
    expect(xdr.LedgerKey.fromXDR(key.toXDR()).switch()).toEqual(key.switch())
  })

  test('instance key targets the contract instance', () => {
    const key = contractInstanceLedgerKey(wallet)
    expect(key.contractData().key().switch().name).toBe('scvLedgerKeyContractInstance')
  })
})

describe('rpcWalletStateReader', () => {
  test('maps entry presence to booleans', async () => {
    const seen: xdr.LedgerKey[] = []
    const reader = rpcWalletStateReader({
      getLedgerEntries: (...keys) => {
        seen.push(...keys)
        // Answer "exists" for the instance key, "missing" for the signer key.
        const isInstance =
          keys[0]?.contractData().key().switch().name === 'scvLedgerKeyContractInstance'
        return Promise.resolve({ entries: isInstance ? [{ key: keys[0]! }] : [] })
      },
    })

    expect(await reader.contractExists(wallet)).toBe(true)
    expect(await reader.hasSecp256r1Signer(wallet, credentialId)).toBe(false)
    expect(seen).toHaveLength(2)
  })
})
