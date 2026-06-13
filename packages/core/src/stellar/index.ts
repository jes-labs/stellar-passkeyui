// Stellar smart-wallet operations: deriving the wallet address, building the
// authorization payload a passkey signs, composing that into an authorization,
// and submitting the result.

export { type DeriveWalletAddressArgs, deriveWalletAddress } from './address'
export {
  type AuthorizationPayloadArgs,
  authorizationPayload,
  payloadForAuthEntry,
} from './challenge'
export {
  type PasskeyAuthorization,
  type PayloadSigner,
  type SignatureEncoder,
  authorizePayload,
  authorizeWalletEntry,
} from './signing'
export {
  type Submitter,
  type SubmitResult,
  type LaunchtubeConfig,
  type FetchLike,
  type FetchResponse,
  launchtubeSubmitter,
} from './submit'
export {
  type WebAuthnSignatureParts,
  passkeyKitSignatureScVal,
  attachSignatureToEntry,
} from './encoder'
export {
  type WalletStateReader,
  type WalletStateSource,
  type SignerKeySummary,
  type LedgerEntriesRpc,
  rpcWalletStateReader,
  secp256r1SignerLedgerKey,
  contractInstanceLedgerKey,
} from './wallet-state'
