# Kit integration — the passkey module inside Stellar Wallets Kit

The reference integration the RFP asks for: the passkey module registered in the real Stellar Wallets Kit, picked from the kit's own Connect Wallet modal next to Freighter, Albedo, xBull, and Lobstr, and signing Soroban authorization entries through the kit's facade.

Live: [wallet-passkey-demo.vercel.app](https://wallet-passkey-demo.vercel.app/) · upstream PR: [Creit-Tech/Stellar-Wallets-Kit#94](https://github.com/Creit-Tech/Stellar-Wallets-Kit/pull/94)

## How it consumes the kit

Until #94 merges and ships in a kit release, this example depends on the kit **built from the PR branch** through a local `file:` path:

```json
"@creit.tech/stellar-wallets-kit": "file:../../../Stellar-Wallets-Kit/src/dist"
```

So running it locally takes two repos:

```bash
# 1. Build the kit from the PR branch (sibling checkout of the fork)
cd ../Stellar-Wallets-Kit && git checkout feat/passkey-module
cd src && deno task build-npm

# 2. Run this example
cd ../../stellar-passkeyUI
pnpm install
pnpm --filter example-kit-integration run dev
```

Once the module ships in a published kit version, the dependency switches to the normal npm package and step 1 disappears.

## What to look at

- `src/main.ts` — the whole integration: `StellarWalletsKit.init` with the `PasskeyModule` registered alongside four regular wallets, `authModal()` for connecting, and `signAuthEntry` for authorizing a contract call.
- The end-to-end suite in `../../e2e/kit-tests/` drives this page with a virtual authenticator and verifies the signatures the module produces with an independent implementation.
