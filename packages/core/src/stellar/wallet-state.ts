// Reading smart-wallet state. Two tiers, honestly separated:
//
// - The RPC tier works against any Soroban RPC with no credentials: it can
//   check whether a wallet contract exists and whether a specific credential is
//   one of its signers, because those live at predictable ledger keys.
// - Enumerating ALL of a wallet's signers requires an indexer (ledger entries
//   cannot be listed by prefix over RPC); the WalletStateSource interface is
//   where a Mercury/Zephyr implementation plugs in.

// Explicit import: browsers have no Buffer global. Bare 'buffer' on purpose —
// see the note in address.ts.
// biome-ignore lint/style/useNodejsImportProtocol: bundlers must resolve the browser package
import { Buffer } from 'buffer'
import { Address, xdr } from '@stellar/stellar-sdk'

export interface WalletStateReader {
  /** True when the wallet contract instance exists on-chain. */
  contractExists(walletAddress: string): Promise<boolean>
  /** True when the credential id is a Secp256r1 signer on the wallet. */
  hasSecp256r1Signer(walletAddress: string, credentialId: Uint8Array): Promise<boolean>
}

/** The full-state interface an indexer-backed implementation satisfies. */
export interface WalletStateSource extends WalletStateReader {
  /** All signer keys on the wallet, as the indexer reports them. */
  getSignerKeys(walletAddress: string): Promise<SignerKeySummary[]>
}

export interface SignerKeySummary {
  kind: 'secp256r1' | 'ed25519' | 'policy'
  /** Credential id, public key, or policy address depending on kind. */
  key: Uint8Array | string
}

// Minimal RPC surface so this stays testable without a network.
export interface LedgerEntriesRpc {
  getLedgerEntries(...keys: xdr.LedgerKey[]): Promise<{ entries: Array<{ key: xdr.LedgerKey }> }>
}

/** The SignerKey::Secp256r1(credentialId) ScVal the contract stores signers under. */
export function secp256r1SignerLedgerKey(
  walletAddress: string,
  credentialId: Uint8Array,
): xdr.LedgerKey {
  const signerKey = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Secp256r1'),
    xdr.ScVal.scvBytes(Buffer.from(credentialId)),
  ])
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(walletAddress).toScAddress(),
      key: signerKey,
      durability: xdr.ContractDataDurability.persistent(),
    }),
  )
}

export function contractInstanceLedgerKey(walletAddress: string): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(walletAddress).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  )
}

/** A credential-less reader backed by any Soroban RPC server. */
export function rpcWalletStateReader(rpc: LedgerEntriesRpc): WalletStateReader {
  return {
    async contractExists(walletAddress) {
      const result = await rpc.getLedgerEntries(contractInstanceLedgerKey(walletAddress))
      return result.entries.length > 0
    },
    async hasSecp256r1Signer(walletAddress, credentialId) {
      const result = await rpc.getLedgerEntries(
        secp256r1SignerLedgerKey(walletAddress, credentialId),
      )
      return result.entries.length > 0
    },
  }
}
