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
  browserWebAuthnApi,
  buildCreationOptions,
  buildRequestOptions,
  defaultAuthenticatorSelection,
  createPasskey,
  signWithPasskey,
  type WebAuthnApi,
  type RawCreateResult,
  type RawGetResult,
  type CreatePasskeyInput,
  type SignWithPasskeyInput,
  type CreatePasskeyResult,
  type SignWithPasskeyResult,
} from './webauthn'

export {
  detectBrowser,
  browserEnvironment,
  detectCapabilities,
  activeConditions,
  selectFallbacks,
  type BrowserEngine,
  type BrowserFamily,
  type Capabilities,
  type ConditionObservations,
  type PasskeyEnvironment,
  type CompatRule,
  type RuntimeConditionId,
  type FallbackActionId,
} from './capabilities'

export {
  deriveWalletAddress,
  authorizationPayload,
  payloadForAuthEntry,
  authorizePayload,
  authorizeWalletEntry,
  launchtubeSubmitter,
  passkeyKitSignatureScVal,
  attachSignatureToEntry,
  type WebAuthnSignatureParts,
  rpcWalletStateReader,
  secp256r1SignerLedgerKey,
  contractInstanceLedgerKey,
  type WalletStateReader,
  type WalletStateSource,
  type SignerKeySummary,
  type LedgerEntriesRpc,
  type DeriveWalletAddressArgs,
  type AuthorizationPayloadArgs,
  type PasskeyAuthorization,
  type PayloadSigner,
  type SignatureEncoder,
  type Submitter,
  type SubmitResult,
  type LaunchtubeConfig,
  type FetchLike,
  type FetchResponse,
} from './stellar'

export const version = '0.0.0'
