# @passkey-ui/wallet-kit

A [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit) module that adds passkey smart-wallet support, backed by `@passkey-ui/core`. Register it alongside the kit's other modules and passkeys become one more wallet option in the picker.

This package is the upstream candidate for adoption into the kit itself.

## Install

```bash
pnpm add @passkey-ui/wallet-kit @passkey-ui/core
```

## Use

```ts
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { PasskeyModule } from '@passkey-ui/wallet-kit'

StellarWalletsKit.init({
  network,
  modules: [
    new PasskeyModule({
      network: 'TESTNET',
      networkPassphrase,
      getWalletAddress: () => connectedWalletAddress, // the C… contract, or null
    }),
    // ...the kit's other modules
  ],
})
```

The module reports availability through passkey capability detection, returns the smart-wallet contract address from `getAddress`, and reports the network.

## A note on smart accounts

The kit's interface was designed for traditional accounts, where an address is a `G…` key and signing means signing a transaction envelope. A passkey smart wallet is different: the address is a `C…` contract, and authorization happens by signing the Soroban auth entries that the wallet contract verifies on-chain.

So the methods that map cleanly are implemented directly, and the contract-specific signing is delegated to a signer you provide in the config — the one that holds your deployed contract's bindings. Arbitrary message signing has no standard meaning for a contract account, so it is unsupported rather than faked. Reconciling this interface with smart accounts is an ongoing conversation with the kit's maintainers.

## Conformance

`PasskeyModule` is type-checked against the kit's `ModuleInterface`. To keep this package light, the interface is copied from the kit source (pinned to a version) rather than pulled in as a dependency; on upstream adoption the local copy is replaced by the kit's own export.

## License

Apache-2.0.
