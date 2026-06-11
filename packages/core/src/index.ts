// Public entry point for the core SDK. The surface is kept deliberately small;
// see the package README for the full API. Higher-level flows (wallet deploy,
// sign, recover) are layered on top of these primitives as each phase lands.

export {
  toBase64Url,
  fromBase64Url,
  bytesToHex,
  hexToBytes,
  concatBytes,
} from './bytes'

export {
  publicKeyFromSpki,
  publicKeyFromAuthenticatorData,
  derToCompactSignature,
  webauthnSignedDigest,
  challengeFromPayload,
} from './webauthn'

export const version = '0.0.0'
