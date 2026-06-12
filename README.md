# Stellar Passkey UI

A minimal, composable passkey SDK and a small set of UI components for Stellar smart wallets, built around a compatibility guide that is kept current as browsers and devices change.

The passkey module connected from Stellar Wallets Kit's own modal and signing with Touch ID ([upstream PR #94](https://github.com/Creit-Tech/Stellar-Wallets-Kit/pull/94)):

https://github.com/user-attachments/assets/5d2f221b-c8c9-4599-b087-e345a77c4b04

**Live demos:**

- [stellar-passkey-demo.vercel.app](https://stellar-passkey-demo.vercel.app/) — Aurum, the reference wallet experience: create a smart wallet with your fingerprint and sign a transaction, right in the browser.
- [wallet-passkey-demo.vercel.app](https://wallet-passkey-demo.vercel.app/) — the kit integration: the passkey module inside the real Stellar Wallets Kit, next to Freighter, Albedo, xBull, and Lobstr.

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
  compat/      the compatibility matrix as data, plus the pipeline that
               generates the SDK fallback rules and the published guide
  ui/          create / sign / recover flows, framework-agnostic, with React
               components as the reference binding; themeable, no design system
  wallet-kit/  a Stellar Wallets Kit module backed by the core SDK
examples/
  wallet-kit/  the SDK used through the kit (the reference integration + demo)
apps/
  docs/        the guide and API docs, with the guide generated from compat data
```

## Relationship to existing work

This project builds on prior art rather than competing with it.

- **[passkey-kit](https://github.com/kalepail/passkey-kit)** (Tyler van der Hoeven) is the functional precedent: the smart-wallet factory and wallet contracts, and on-chain secp256r1 verification. This project reuses those contracts and distills a minimal, composable layer from the lineage rather than reinventing the on-chain model.
- **[stellar-wallet-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)** (Creit Tech) is the integration target. The core SDK conforms to its module interface so passkeys become one more wallet option teams can switch on.
- **[Porto](https://porto.sh)** (Ithaca) is a reference for SDK shape and passkey UX, and for its honest catalogue of WebAuthn gotchas. Porto targets Ethereum, so its account model does not transfer; what transfers is the API minimalism, the clean split between a headless core and a UI layer, and the hard-won compatibility lessons.

## Verified on-chain

The full smart-wallet flow runs against live testnet, reproducible with `pnpm --filter @passkey-ui/e2e exec tsx testnet/run.ts`: deploy a wallet from the unmodified passkey-kit contracts (the address the SDK derives offline matches the deployment exactly), fund it, and move 25 XLM out of it with a WebAuthn secp256r1 signature the SDK constructs — verified by the contract's own `__check_auth`.

- [Passkey-signed payment](https://stellar.expert/explorer/testnet/tx/dd2d9815ee1a3ea34e95bf58fd2658ba3892a5e47d7bb758c50f75ef49e9c534) · [wallet contract](https://stellar.expert/explorer/testnet/contract/CBKYYID4SL7BWPM6IMYDN6RJ3HWTSG254HRQLGBRWA3VUDIZIFK7YWVH) · [deploy](https://stellar.expert/explorer/testnet/tx/599002d3a0970c54a71d239e0814aee931ad832e5bdb54fd71d17dc82586d69c)

The signature ScVal encoding is byte-identical to what the contract's Rust SDK produces, checked by generating both from the same fixture.

## Verified on real devices

The reference demo has been exercised by hand on real hardware. Each session records only what the tester actually confirmed; the full log lives in the [compatibility guide](apps/docs/compatibility.md) and grows as devices are covered.

| Device | Browser | Authenticator | Result |
| ------ | ------- | ------------- | ------ |
| MacBook Pro (macOS) | Brave, Safari, Firefox | Touch ID | ✅ create + sign |
| iPhone (iOS) | Safari | Face ID | ✅ passkey flow |
| Android phone | Chrome, Edge, Opera Mini | Fingerprint | ✅ passkey flow |
| Android phone | Firefox | Fingerprint | ⚠️ works; no autofill — the SDK fell back to the explicit button, as the matrix documents |

Automated coverage runs in CI-style fashion against Chromium's virtual authenticator (see `e2e/`), exercising create, sign, user-verification degradation, and the lost-credential recovery path on every change.

## Project status

The work was sequenced so the riskiest, most testable parts came first. The pieces below are built and covered by tests that check against independent references — Node's own crypto, the OpenSSL CLI, the curve generator point, and the Stellar SDK's own preimage construction — rather than against the implementation itself.

Built and verified, end to end offline:

- **The core SDK** — P-256 key extraction from both DER SPKI keys and raw COSE authenticator data, DER-to-compact signatures with low-S normalization, the WebAuthn signing digest, capability detection and the documented-fallback engine, the create and sign ceremony wrappers, deterministic wallet-address derivation, the Soroban authorization payload, and a Launchtube submitter.
- **The compatibility layer** — the matrix as structured data, with one generator producing both the published guide and the SDK's runtime fallback rules, so the two cannot drift.
- **The UI** — a framework-agnostic flow layer that maps the matrix's conditions onto UI states, with React components as the reference binding.
- **The Stellar Wallets Kit module** and a reference demo that performs real passkey creation, address derivation, and signing entirely in the browser.

Gated on coordination, not yet verifiable here: the on-chain pieces that depend on the deployed smart-wallet contract bindings — encoding the passkey signature into the contract's authorization ScVal, and the factory deployment. The SDK exposes a clean adapter seam for these, and they are the subject of the coordination with the contract maintainer that the design calls for. The compatibility entries are sourced from specifications and vendor documentation and are marked accordingly; confirming them on real hardware is the next stage of the documentation work.

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
