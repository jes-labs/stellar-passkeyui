// The contract a Stellar Wallets Kit module must satisfy, copied faithfully from
// the kit source so this module can be type-checked against it without pulling in
// the kit's large dependency tree (WalletConnect, Ledger, Trezor, and the rest).
//
// Source: Creit-Tech/Stellar-Wallets-Kit, src/types/mod.ts and src/types/sdk.ts,
// npm package @creit.tech/stellar-wallets-kit@2.3.0. When this module is upstreamed,
// these local copies are replaced by the kit's own exports. Keep them in sync.

export enum ModuleType {
  HW_WALLET = 'HW_WALLET',
  HOT_WALLET = 'HOT_WALLET',
  BRIDGE_WALLET = 'BRIDGE_WALLET',
  AIR_GAPED_WALLET = 'AIR_GAPED_WALLET',
}

export interface SignOptions {
  networkPassphrase?: string
  address?: string
  path?: string
}

export interface ModuleInterface {
  moduleType: ModuleType
  productId: string
  productName: string
  productUrl: string
  productIcon: string

  isAvailable(): Promise<boolean>
  isPlatformWrapper?(): Promise<boolean>
  onChange?(callback: (event: unknown) => void): void

  getAddress(params?: { path?: string; skipRequestAccess?: boolean }): Promise<{
    address: string
  }>

  signTransaction(
    xdr: string,
    opts?: SignOptions,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>

  signAuthEntry(
    authEntry: string,
    opts?: SignOptions,
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }>

  signMessage(
    message: string,
    opts?: SignOptions,
  ): Promise<{ signedMessage: string; signerAddress?: string }>

  signAndSubmitTransaction?(
    xdr: string,
    opts?: SignOptions,
  ): Promise<{ status: 'success' | 'pending' }>

  getNetwork(): Promise<{ network: string; networkPassphrase: string }>

  disconnect?(): Promise<void>
}
