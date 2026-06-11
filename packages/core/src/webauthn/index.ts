// WebAuthn credential handling: running the create and sign ceremonies, and
// turning what the browser returns into what the Stellar smart-wallet contract
// verifies.

export {
  publicKeyFromSpki,
  publicKeyFromAuthenticatorData,
} from './public-key'
export { derToCompactSignature } from './signature'
export { webauthnSignedDigest, challengeFromPayload } from './digest'

export {
  type WebAuthnApi,
  type RawCreateResult,
  type RawGetResult,
  browserWebAuthnApi,
} from './api'
export {
  type CreatePasskeyInput,
  type SignWithPasskeyInput,
  buildCreationOptions,
  buildRequestOptions,
  defaultAuthenticatorSelection,
} from './options'
export { type CreatePasskeyResult, createPasskey } from './create'
export { type SignWithPasskeyResult, signWithPasskey } from './sign'
