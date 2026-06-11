# Stellar Passkey UI

A minimal, composable passkey SDK and a small set of UI components for Stellar smart wallets, built around a compatibility guide that is kept current as browsers and devices change.

The goal is narrow and practical: let a wallet team add passkey sign-in to a Soroban smart account without rebuilding the WebAuthn plumbing, the on-chain signing logic, or — the part that actually hurts — the cross-device compatibility knowledge that decides whether a passkey flow works on a user's phone or silently fails.

## Why this exists

Passkeys replace seed phrases with a key that lives in the device's secure element and never leaves it. On Stellar this became possible at the protocol level with Protocol 21 (CAP-0051), which added native secp256r1 verification, so a Soroban contract can verify a WebAuthn signature on-chain and use it to authorize a smart-wallet transaction. The cryptographic foundation is live on mainnet today.

The hard part is no longer the cryptography. It is that WebAuthn behaves differently across browsers, operating systems, authenticators, and embedding contexts, and those differences are poorly documented and move over time. Safari in an iframe does not behave like Chrome. A synced iCloud passkey does not behave like a device-bound security key. A passkey prompt inside a cross-origin iframe is a different problem again. A wallet team that gets this wrong ships a flow that works on the developer's laptop and breaks for a third of their users.

So the most valuable thing this project produces is not the SDK. It is the knowledge of what works where, and what to do when it doesn't — captured as data, kept current, and wired directly into the code so the two cannot drift apart.

## The core idea: documentation leads

Most SDKs treat a compatibility matrix as a document you write at the end, if at all. Here it is the specification.

The compatibility findings live as structured data. That single dataset has three consumers:

1. The SDK's capability detection and fallback logic is generated from it. When the SDK hits an unsupported feature on a given platform, it takes the documented fallback instead of failing.
2. The UI components render the states the data says actually occur — including the failure and fallback states, not just the happy path.
3. The published guide is generated from it, and every entry carries a last-verified date, so a reader can see what is fresh and what needs re-checking.

Because all three are generated from the same source, the guide cannot quietly go stale while the code moves on. That is the whole design, and everything else follows from it.

## How it works

The system sits between the browser's WebAuthn API and a Soroban smart wallet, and is consumed by wallet teams through [stellar-wallet-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit).

```
User device (Face ID, Touch ID, Windows Hello, security key)
        │
   WebAuthn API   navigator.credentials.create / .get
        │
   Core SDK   capability detection + documented fallbacks
        │
   Soroban smart wallet   factory + wallet contracts, on-chain secp256r1
        │
   Submission (fees, sequence numbers)   ·   Indexing (contract events)
        │
   stellar-wallet-kit   the module wallet teams integrate
```

There are three flows, and they are the only three a passkey wallet needs.

**Create.** The SDK asks the browser to create a passkey, extracts the P-256 public key the authenticator generated, and deploys a smart wallet whose signer is that key. The wallet address is derived deterministically from the key, so it can be known before deployment.

**Sign.** The SDK builds the transaction, computes the exact digest the wallet contract will verify, and asks the browser to sign it. The authenticator returns an assertion; the SDK assembles it into a contract call, and the contract verifies the secp256r1 signature on-chain.

**Recover.** Recovery is signer management. The SDK adds a new passkey signer from a new device, or falls back to a secondary factor, according to the wallet's policy. The UI makes the security trade-off visible, because an add-signer path is also, by nature, an account-takeover path if misused.

The single most failure-prone detail across all of this is that the digest the SDK signs must be byte-for-byte what the contract re-derives on-chain:

```
sha256(authenticatorData || sha256(clientDataJSON))
```

If those disagree by a byte, every signature fails verification. The SDK defines that digest in exactly one place, and it is covered by tests.

## Repository layout

This is a pnpm monorepo. The SDK core is kept deliberately thin and framework-free, because it is destined to be adopted upstream into stellar-wallet-kit as a module; the UI, the compatibility data, the docs, and the examples stay here.

```
packages/
  core/        framework-free SDK: WebAuthn, key + signature parsing,
               challenge construction, wallet operations, capability detection
  ui/          create / sign / recover components, themeable, no design system
  compat/      the compatibility matrix as data, plus the pipeline that
               generates the SDK tables and the published guide
examples/
  standalone/  the SDK used directly
  wallet-kit/  the SDK used through stellar-wallet-kit (the reference integration)
apps/
  docs/        the guide and API docs, generated from compat data
```

## Relationship to existing work

This project builds on prior art rather than competing with it.

- **[passkey-kit](https://github.com/kalepail/passkey-kit)** (Tyler van der Hoeven) is the functional precedent: the smart-wallet factory and wallet contracts, and on-chain secp256r1 verification. This project reuses those contracts and distills a minimal, composable layer from the lineage rather than reinventing the on-chain model.
- **[stellar-wallet-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)** (Creit Tech) is the integration target. The core SDK conforms to its module interface so passkeys become one more wallet option teams can switch on.
- **[Porto](https://porto.sh)** (Ithaca) is a reference for SDK shape and passkey UX, and for its honest catalogue of WebAuthn gotchas. Porto targets Ethereum, so its account model does not transfer; what transfers is the API minimalism, the clean split between a headless core and a UI layer, and the hard-won compatibility lessons.

## Project status

Early. The work is sequenced so the riskiest, most testable parts come first.

Landed and verified:

- The monorepo foundation — strict TypeScript, Biome, Vitest, library builds.
- The core cryptographic and WebAuthn primitives: P-256 public-key extraction from both DER SPKI keys and raw COSE authenticator data, DER-to-compact signature conversion with low-S normalization, the on-chain signing digest, and the base64url encoding both the browser and the contract rely on. Each is covered by tests that check against independent references — Node's own crypto, the curve generator point, and real P-256 signatures — rather than against the implementation itself.

In progress, in order: the compatibility data layer and its generators, capability detection and fallback selection, the WebAuthn create/sign/recover flow wrappers, the smart-wallet operations against testnet, the UI components, and the stellar-wallet-kit module with a reference integration.

## Development

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm test         # run the full test suite
pnpm typecheck    # strict type checking across packages
pnpm build        # build the libraries
pnpm lint         # Biome
pnpm format       # apply formatting
```

## License

Apache-2.0.
