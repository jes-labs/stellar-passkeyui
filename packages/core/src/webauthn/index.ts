// WebAuthn credential handling: turning what the browser returns into what the
// Stellar smart-wallet contract verifies.

export {
  publicKeyFromSpki,
  publicKeyFromAuthenticatorData,
} from './public-key'
export { derToCompactSignature } from './signature'
export { webauthnSignedDigest, challengeFromPayload } from './digest'
