# @passkey-ui/core

The framework-free core of Stellar Passkey UI. It wraps the browser's WebAuthn API, parses what authenticators return into what a Soroban smart-wallet contract verifies, detects platform capabilities, and drives the create and sign ceremonies.

There is no UI here and no framework dependency — those live in `@passkey-ui/ui`.

## Install

```bash
pnpm add @passkey-ui/core
```

## What it does

**Capability detection and fallbacks.** Detect what the current browser, engine, and authenticator can do, and look up the documented fallback for anything that does not work.

```ts
import { detectCapabilities, selectFallbacks } from '@passkey-ui/core'

const capabilities = await detectCapabilities()
const fallbacks = selectFallbacks(capabilities) // e.g. "open a popup for creation on Safari in an iframe"
```

**Create and sign.** Run the WebAuthn ceremonies and get back exactly what the wallet needs — the signer public key on create, and the compact, low-S signature plus the signed digest on sign.

```ts
import { createPasskey, signWithPasskey } from '@passkey-ui/core'

const wallet = await createPasskey({
  rp: { name: 'My Wallet' },
  user: { id: new TextEncoder().encode('user-id'), name: 'alice' },
})
// wallet.publicKey — the 65-byte P-256 signer
// wallet.credentialId — the credential to store and pass on sign-in

const assertion = await signWithPasskey({ challenge: payload, allowCredentials: [wallet.credentialId] })
// assertion.signature — 64-byte compact low-S, ready for the contract
```

**Address and authorization.** Derive the smart-wallet address before deployment, and build the authorization payload a passkey signs for a transaction.

```ts
import { deriveWalletAddress, payloadForAuthEntry } from '@passkey-ui/core'

const address = deriveWalletAddress({ deployer, keyId: wallet.credentialId, networkPassphrase })
```

**Submission.** Submit a signed transaction through a service that pays the fee and manages the source account, so the wallet needs no XLM.

```ts
import { launchtubeSubmitter } from '@passkey-ui/core'

const submitter = launchtubeSubmitter({ url, jwt })
await submitter.submit(signedXdr)
```

## Correctness

The single most failure-prone detail in passkey wallets is that the digest the SDK signs must equal what the contract re-derives on-chain. This package defines that digest in one place and verifies it against independent implementations — the Stellar SDK's own preimage construction, plus Node's WebCrypto and the OpenSSL CLI for the signature path.

## The contract-binding seam

Encoding the passkey signature into a specific deployed contract's authorization ScVal, and the factory deployment, depend on that contract's generated bindings. The package produces the verified authorization material and exposes a `SignatureEncoder` for the binding-specific step, so the core stays free of any single contract layout.

## License

Apache-2.0.
