# Stellar Passkey UI

A minimal, composable passkey SDK and a small set of UI components for Stellar smart wallets, built around a compatibility guide that is kept current as browsers and devices change.

The goal is narrow and practical: let a wallet team add passkey sign-in to a Soroban smart account without rebuilding the WebAuthn plumbing, the on-chain signing logic, or the cross-device compatibility knowledge that decides whether a passkey flow works on a user's phone or silently fails.

## Why it exists

Passkeys replace seed phrases with a key that lives in the device's secure element and never leaves it. On Stellar this became possible at the protocol level with Protocol 21 (CAP-0051), which added native secp256r1 verification: a Soroban contract can verify a WebAuthn signature on-chain and use it to authorize a smart-wallet transaction.

The cryptography is no longer the hard part. The hard part is that WebAuthn behaves differently across browsers, operating systems, authenticators, and embedding contexts, and those differences are poorly documented and shift over time. A wallet that gets this wrong ships a flow that works on the developer's laptop and breaks for a third of their users.

So the most valuable thing this project produces is the knowledge of what works where — captured as data, kept current, and wired directly into the code so the two cannot drift apart.

## The packages

- **`@passkey-ui/core`** — the framework-free SDK: WebAuthn ceremonies, key and signature parsing, capability detection, address derivation, and the authorization payload.
- **`@passkey-ui/ui`** — create, sign, and recover flows with React components as the reference binding.
- **`@passkey-ui/wallet-kit`** — a Stellar Wallets Kit module so passkeys appear in the wallet picker.

Start with [Getting started](/getting-started), or read the [Architecture](/architecture) for how the pieces fit. The [Compatibility guide](/compatibility) is generated from the same data the SDK uses for its runtime fallbacks.
