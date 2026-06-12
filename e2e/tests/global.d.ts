// The shape of the test hook the demo app exposes on window. Mirrors
// examples/wallet-kit/src/test-hook.ts; only the fields the e2e suite reads.
declare global {
  interface Window {
    __passkeyDemo?: {
      create?: {
        credentialId: Uint8Array
        publicKey: Uint8Array
        residentKey?: boolean
      }
      sign?: {
        authenticatorData: Uint8Array
        clientDataJSON: Uint8Array
        signature: Uint8Array
        signedDigest: Uint8Array
      }
    }
  }
}

export {}
