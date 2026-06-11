import { detectCapabilities } from '@passkey-ui/core'
import { type ModuleInterface, ModuleType, type SignOptions } from './module-interface'

// A small, neutral key glyph so the module shows up in the kit's wallet picker
// without depending on an external asset.
const PASSKEY_ICON = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M9 12v9l2-2 2 2v-4"/><path d="M16 8a4 4 0 0 0-4-4"/></svg>',
)}`

export const PASSKEY_MODULE_ID = 'passkey'

// The kit's signing methods are shaped for traditional accounts (sign an envelope
// with a G-address key). A passkey smart wallet differs: the address is a C-address
// contract, and authorization happens by signing Soroban auth entries that the
// wallet contract verifies on-chain. So the methods that do not map cleanly are
// delegated to the integration, which holds the contract bindings. This shape, and
// where the kit's interface and smart accounts diverge, is the substance of the
// coordination with Creit Tech.
export interface PasskeyModuleConfig {
  /** The network label the kit reports, e.g. "TESTNET". */
  network: string
  networkPassphrase: string
  /** The connected smart-wallet contract address (C…), or null when not connected. */
  getWalletAddress: () => string | null | Promise<string | null>
  /** Override availability; defaults to passkey capability detection. */
  isAvailable?: () => Promise<boolean>
  /** Sign a transaction's auth entries with the passkey. Provided by the integration. */
  signTransaction?: (
    xdr: string,
    opts?: SignOptions,
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>
  /** Sign a single Soroban auth entry with the passkey. Provided by the integration. */
  signAuthEntry?: (
    authEntry: string,
    opts?: SignOptions,
  ) => Promise<{ signedAuthEntry: string; signerAddress?: string }>
}

export class PasskeyModule implements ModuleInterface {
  readonly moduleType = ModuleType.HOT_WALLET
  readonly productId = PASSKEY_MODULE_ID
  readonly productName = 'Passkey'
  readonly productUrl = 'https://github.com/jes-labs/stellar-passkeyui'
  readonly productIcon = PASSKEY_ICON

  constructor(private readonly config: PasskeyModuleConfig) {}

  async isAvailable(): Promise<boolean> {
    if (this.config.isAvailable) return this.config.isAvailable()
    const capabilities = await detectCapabilities()
    return capabilities.webauthnAvailable && capabilities.secureContext
  }

  async getAddress(): Promise<{ address: string }> {
    const address = await this.config.getWalletAddress()
    if (!address)
      throw new Error('No passkey wallet is connected. Create or connect a wallet first.')
    return { address }
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return { network: this.config.network, networkPassphrase: this.config.networkPassphrase }
  }

  async signTransaction(
    xdr: string,
    opts?: SignOptions,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    if (!this.config.signTransaction)
      throw new Error(
        'signTransaction is not configured. A passkey smart wallet signs Soroban auth entries; ' +
          'wire the contract-binding signer into the module config.',
      )
    return this.config.signTransaction(xdr, opts)
  }

  async signAuthEntry(
    authEntry: string,
    opts?: SignOptions,
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
    if (!this.config.signAuthEntry)
      throw new Error(
        'signAuthEntry is not configured. Wire the contract-binding signer into the module config.',
      )
    return this.config.signAuthEntry(authEntry, opts)
  }

  async signMessage(): Promise<{ signedMessage: string; signerAddress?: string }> {
    // Arbitrary message signing has no standard meaning for a smart-wallet
    // contract account, so this is unsupported rather than faked.
    throw new Error('Passkey smart wallets do not support arbitrary message signing.')
  }
}
