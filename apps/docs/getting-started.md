# Getting started

## Install

```bash
pnpm add @passkey-ui/core @passkey-ui/ui
```

The core SDK runs in the browser and requires a secure context (HTTPS, or `localhost` in development). WebAuthn is unavailable on plain HTTP origins.

## Detect what the device can do

Before offering a passkey flow, check the platform. `detectCapabilities` probes the browser and authenticator; `selectFallbacks` returns the documented action for anything that will not work as-is.

```ts
import { detectCapabilities, selectFallbacks } from '@passkey-ui/core'

const capabilities = await detectCapabilities()
const fallbacks = selectFallbacks(capabilities)
// e.g. on Safari inside a cross-origin iframe, fallbacks include
// "open-popup-for-create" with the reason and its sources.
```

You rarely call these directly — the UI flows do it for you and surface the results as notices.

## Create a wallet

The create ceremony runs WebAuthn registration and returns the signer key and the credential id. The wallet address derives deterministically from the credential, so you can know it before deployment.

```tsx
import { createCreatePasskeyFlow } from '@passkey-ui/ui'
import { CreatePasskey } from '@passkey-ui/ui/react'
import { detectCapabilities, selectFallbacks, createPasskey, deriveWalletAddress } from '@passkey-ui/core'

const flow = createCreatePasskeyFlow({
  detectCapabilities,
  selectFallbacks,
  createPasskey,
  input: {
    rp: { name: 'My Wallet' },
    user: { id: new TextEncoder().encode('user-id'), name: 'alice' },
  },
})

function Onboarding() {
  return (
    <CreatePasskey
      flow={flow}
      renderSuccess={(wallet) => {
        const address = deriveWalletAddress({
          deployer,
          keyId: wallet.credentialId,
          networkPassphrase,
        })
        return <p>Wallet address: {address}</p>
      }}
    />
  )
}
```

`CreatePasskey` renders the whole flow — the action button, the prompting state, any blocking or advisory notices for the current device, and the error and success states.

## Sign a transaction

Signing produces the compact, low-S signature the smart-wallet contract verifies. You provide what to sign; the flow governs the states around it.

```tsx
import { createSignFlow } from '@passkey-ui/ui'
import { SignTransaction } from '@passkey-ui/ui/react'
import { signWithPasskey } from '@passkey-ui/core'

const flow = createSignFlow({
  detectCapabilities,
  selectFallbacks,
  sign: () => signWithPasskey({ challenge: payload, allowCredentials: [credentialId] }),
})

<SignTransaction flow={flow} renderSuccess={(r) => <p>Signed.</p>} />
```

The `payload` is the 32-byte Soroban authorization payload, which you build from the transaction with `payloadForAuthEntry` or `authorizationPayload`.

## Submit

A submission service pays the fee and manages the source account, so the wallet needs no XLM.

```ts
import { launchtubeSubmitter } from '@passkey-ui/core'

const submitter = launchtubeSubmitter({ url, jwt })
await submitter.submit(signedXdr)
```

## Theming

The components ship structure and CSS variables, not a design system. Override any token, and style the `pk-*` classes to match your app:

```tsx
<CreatePasskey flow={flow} theme={{ accent: '#6d8bff', foreground: '#e7e9ee' }} />
```

The reference demo in `examples/wallet-kit` includes a complete stylesheet you can copy as a starting point.

## Using it through the Stellar Wallets Kit

If you already use the [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit), register the passkey module so it appears in the wallet picker alongside the others. See the [API reference](/api#passkey-ui-wallet-kit).
