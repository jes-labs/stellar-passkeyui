# Architecture

## Documentation leads

Most SDKs treat a compatibility matrix as a document written at the end, if at all. Here it is the specification.

The compatibility findings live as structured data, and one generator turns that single dataset into two things: the SDK's runtime capability and fallback rules, and the published [compatibility guide](/compatibility). Because both come from the same source, the guidance a wallet team reads and the behavior the SDK actually takes cannot drift apart. Every fallback the SDK takes maps to a documented finding; every UI state maps to a documented condition.

## The layers

```
User device (Face ID, Touch ID, Windows Hello, security key)
        │
   WebAuthn API   navigator.credentials.create / .get
        │
   @passkey-ui/core   capability detection + documented fallbacks
        │
   Soroban smart wallet   factory + wallet contracts, on-chain secp256r1
        │
   Submission (fees, sequence numbers)   ·   Indexing (contract events)
        │
   @passkey-ui/ui   ·   @passkey-ui/wallet-kit
        │
   Wallet teams
```

- **Core** is framework-free. It wraps WebAuthn, parses credentials, builds the signing payload, derives the wallet address, and submits.
- **The compatibility layer** is the spine. Its data drives the core's fallback engine and the guide.
- **The UI** is a framework-agnostic flow layer with React components on top. The flows turn the matrix's conditions into the states the components render.
- **The wallet-kit module** adapts the core to the Stellar Wallets Kit's module interface.

## The three flows

**Create.** Run WebAuthn registration, extract the P-256 public key, and derive the wallet address from the credential. The address is known before deployment because it derives deterministically from the key.

**Sign.** Build the transaction, compute the digest the wallet contract will verify, run the WebAuthn assertion over it, and assemble the result into the contract's signature. The contract verifies the secp256r1 signature on-chain.

**Recover.** Enroll a new passkey on a new device and add it as a signer. Recovery is signer management, and the UI makes the security trade-off visible, because an add-signer path is also an account-takeover path if misused.

## The digest that must match

The most failure-prone detail across all of this is that the digest the SDK signs has to be byte-for-byte what the contract re-derives on-chain:

```
sha256(authenticatorData || sha256(clientDataJSON))
```

If those disagree by a byte, every signature fails verification. The core defines that digest in one place, and the authorization payload — the hash of the Soroban authorization preimage that becomes the WebAuthn challenge — is checked against the Stellar SDK's own construction in the test suite.

## The contract-binding seam

Encoding the passkey signature into a specific deployed contract's authorization ScVal, and the factory deployment, depend on that contract's generated bindings. The core produces the verified authorization material and exposes an adapter for the binding-specific step, so it stays free of any single contract layout. This is a deliberate boundary: it is reused from and coordinated with the existing smart-wallet contracts rather than forked.

## Relationship to existing work

- **[passkey-kit](https://github.com/kalepail/passkey-kit)** is the functional precedent — the factory and wallet contracts and on-chain secp256r1 verification. This project reuses those contracts and distills a minimal layer from the lineage.
- **[Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)** is the integration target.
- **[Porto](https://porto.sh)** is a reference for SDK shape, the headless-core/UI split, and its honest catalogue of WebAuthn gotchas. It targets Ethereum, so its account model does not transfer; the patterns do.
