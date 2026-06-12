import type { CreatePasskeyResult, SignWithPasskeyResult } from '@passkey-ui/core'

// Exposes ceremony results on window so the e2e suite can verify the real bytes
// (public key, signature, signed digest) with WebCrypto in the browser, instead
// of only asserting on rendered text. Inert outside the tests.
declare global {
  interface Window {
    __passkeyDemo?: {
      create?: CreatePasskeyResult
      sign?: SignWithPasskeyResult
    }
  }
}

export function recordCreate(result: CreatePasskeyResult): void {
  window.__passkeyDemo = { ...window.__passkeyDemo, create: result }
}

export function recordSign(result: SignWithPasskeyResult): void {
  window.__passkeyDemo = { ...window.__passkeyDemo, sign: result }
}
