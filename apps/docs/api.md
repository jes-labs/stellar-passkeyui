# API reference

A summary of the public surface. Types are intentionally small and composable.

## @passkey-ui/core

### Capability detection

- **`detectCapabilities(env?)`** → `Promise<Capabilities>` — probe the platform. Accepts an optional environment for testing; defaults to the real browser globals.
- **`selectFallbacks(capabilities, observations?)`** → `CompatRule[]` — the documented fallback rules that apply right now.
- **`activeConditions(capabilities, observations?)`** → `RuntimeConditionId[]` — the conditions currently in effect.
- **`detectBrowser(userAgent)`** → `{ family, engine }` — identify the browser and, more importantly, the rendering engine.

`Capabilities` reports `webauthnAvailable`, `secureContext`, `inIframe`, `crossOriginIframe`, `platformAuthenticator`, `conditionalMediation`, `browser`, and `engine`.

### Ceremonies

- **`createPasskey(input, api?)`** → `Promise<CreatePasskeyResult>` — run WebAuthn registration and return the signer key, credential id, and whether a discoverable key was created.
- **`signWithPasskey(input, api?)`** → `Promise<SignWithPasskeyResult>` — run the assertion over a challenge and return the compact low-S signature and the signed digest.
- **`buildCreationOptions(input)`** / **`buildRequestOptions(input)`** — the pure option builders, if you need them directly.

### WebAuthn primitives

- **`publicKeyFromSpki(spki)`** / **`publicKeyFromAuthenticatorData(authData)`** → the 65-byte P-256 point.
- **`derToCompactSignature(der)`** → the 64-byte low-S signature.
- **`webauthnSignedDigest(authenticatorData, clientDataJSON)`** → the digest the contract re-derives.
- **`challengeFromPayload(payload)`** → the base64url challenge.

### Stellar

- **`deriveWalletAddress({ deployer, keyId, networkPassphrase })`** → the smart-wallet contract address.
- **`authorizationPayload(args)`** / **`payloadForAuthEntry(entry, networkPassphrase)`** → the 32-byte payload a passkey signs.
- **`authorizePayload(payload, sign)`** / **`authorizeWalletEntry(entry, networkPassphrase, sign)`** → compose a passkey assertion into an authorization.
- **`launchtubeSubmitter({ url, jwt, fetch? })`** → a `Submitter` that posts a signed transaction.
- **`SignatureEncoder`** — the adapter interface for encoding an authorization into a deployed contract's signature ScVal.

## @passkey-ui/ui

### Flow layer (framework-agnostic, package root)

- **`createCreatePasskeyFlow(deps)`**, **`createSignFlow(deps)`**, **`createRecoverFlow(deps)`** → a `Flow` with `start`, `proceed`, `retry`, `reset`, and a subscribable `store`.
- **`createFlow(deps)`** — the generic controller the three presets build on.
- **`assessReadiness(capabilities, rules)`** — turn capabilities and rules into notices and a blocked flag.

A `FlowState` carries a `phase` (`idle`, `checking`, `blocked`, `ready`, `prompting`, `success`, `error`), `notices`, and optionally a `result` or `error`.

### React (`@passkey-ui/ui/react`)

- **`useFlow(flow, options?)`** → `{ state, start, proceed, retry, reset }`.
- **`PasskeyFlow`** — renders every state of a flow; accepts `labels`, `theme`, `renderSuccess`.
- **`CreatePasskey`**, **`SignTransaction`**, **`Recover`** — presets over `PasskeyFlow` with default copy.

### Theming (package root)

- **`themeToCssVariables(theme?)`** → a style object of CSS variables.
- **`defaultTheme`**, **`TOKEN_NAMES`** — the default token values and variable names.

## @passkey-ui/wallet-kit

- **`PasskeyModule`** — implements the Stellar Wallets Kit `ModuleInterface`. Construct it with `{ network, networkPassphrase, getWalletAddress }`, and optionally `isAvailable`, `signTransaction`, `signAuthEntry`.
- **`ModuleType`**, **`ModuleInterface`**, **`SignOptions`** — the kit interface types, copied for type-checking until upstream adoption.

```ts
new PasskeyModule({
  network: 'TESTNET',
  networkPassphrase,
  getWalletAddress: () => connectedContractAddress,
})
```
