# @passkey-ui/ui

Reusable create, sign, and recover UI for Stellar passkey wallets.

The package is two layers. A **framework-agnostic flow layer** owns the logic: it checks capabilities, surfaces the documented notices, runs the ceremony, and handles errors and retries. **React components** are the reference binding on top. The split means the flows can be reused by any framework, and the components render the states the compatibility matrix says actually occur — blocked, advisory, prompting, error — not only the happy path.

## Install

```bash
pnpm add @passkey-ui/ui @passkey-ui/core
```

## React

```tsx
import { createCreatePasskeyFlow } from '@passkey-ui/ui'
import { CreatePasskey } from '@passkey-ui/ui/react'
import { detectCapabilities, selectFallbacks, createPasskey } from '@passkey-ui/core'

const flow = createCreatePasskeyFlow({
  detectCapabilities,
  selectFallbacks,
  createPasskey,
  input: { rp: { name: 'My Wallet' }, user: { id, name: 'alice' } },
})

function Onboarding() {
  return <CreatePasskey flow={flow} renderSuccess={(wallet) => <p>{wallet.credentialIdBase64Url}</p>} />
}
```

`SignTransaction` and `Recover` follow the same shape. Each wraps `PasskeyFlow`, which renders every state and accepts label overrides.

## Theming

The components ship structure and CSS variables, not a design system. Override any token to match your app:

```tsx
<CreatePasskey flow={flow} theme={{ accent: '#6d8bff', foreground: '#e7e9ee' }} />
```

The `pk-*` classes are yours to style. The reference demo in `examples/wallet-kit` includes a complete stylesheet you can copy as a starting point.

## Without React

The flow layer has no React dependency. Import from the package root and bind it to any renderer:

```ts
import { createSignFlow } from '@passkey-ui/ui'

const flow = createSignFlow({ detectCapabilities, selectFallbacks, sign })
flow.store.subscribe(() => render(flow.store.getState()))
await flow.start()
```

## License

Apache-2.0.
