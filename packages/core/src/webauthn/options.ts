// Pure builders for the WebAuthn option objects. Defaults follow the
// compatibility guidance: ES256 only (the curve the smart-wallet contract
// verifies), no attestation, and "preferred" for user verification and resident
// keys so the broadest set of authenticators succeeds.

// ES256 over the P-256 curve. This is the only algorithm the on-chain verifier
// supports, so it is the only one we request.
const ES256 = -7

const DEFAULT_TIMEOUT_MS = 60_000

// Registration does not feed a security check in this model — the wallet trusts
// the public key, not the attestation — so a fixed challenge is fine. Callers
// that want a random one can pass it.
const DEFAULT_REGISTRATION_CHALLENGE = new TextEncoder().encode('stellar-passkey-registration')

export interface CreatePasskeyInput {
  rp: { name: string; id?: string }
  user: { id: Uint8Array; name: string; displayName?: string }
  challenge?: Uint8Array
  authenticatorSelection?: AuthenticatorSelectionCriteria
  attestation?: AttestationConveyancePreference
  timeoutMs?: number
}

export interface SignWithPasskeyInput {
  /** The 32-byte payload the contract will verify, passed as the challenge. */
  challenge: Uint8Array
  rpId?: string
  /** Credential IDs to allow, for non-discoverable sign-in. */
  allowCredentials?: readonly Uint8Array[]
  userVerification?: UserVerificationRequirement
  timeoutMs?: number
}

// The DOM WebAuthn types want an ArrayBuffer-backed view, while a caller's bytes
// may be backed by ArrayBufferLike (the SharedArrayBuffer-inclusive type). Copy
// into a fresh buffer at the boundary; it also detaches the option object from
// any buffer the caller might mutate.
function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy
}

export function defaultAuthenticatorSelection(): AuthenticatorSelectionCriteria {
  return {
    residentKey: 'preferred',
    requireResidentKey: false,
    userVerification: 'preferred',
  }
}

export function buildCreationOptions(
  input: CreatePasskeyInput,
): PublicKeyCredentialCreationOptions {
  return {
    rp: input.rp.id ? { id: input.rp.id, name: input.rp.name } : { name: input.rp.name },
    user: {
      id: toBufferSource(input.user.id),
      name: input.user.name,
      displayName: input.user.displayName ?? input.user.name,
    },
    challenge: toBufferSource(input.challenge ?? DEFAULT_REGISTRATION_CHALLENGE),
    pubKeyCredParams: [{ type: 'public-key', alg: ES256 }],
    authenticatorSelection: input.authenticatorSelection ?? defaultAuthenticatorSelection(),
    attestation: input.attestation ?? 'none',
    // credProps tells us afterwards whether a discoverable key was created.
    extensions: { credProps: true },
    timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

export function buildRequestOptions(
  input: SignWithPasskeyInput,
): PublicKeyCredentialRequestOptions {
  const options: PublicKeyCredentialRequestOptions = {
    challenge: toBufferSource(input.challenge),
    userVerification: input.userVerification ?? 'preferred',
    timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
  if (input.rpId) options.rpId = input.rpId
  if (input.allowCredentials && input.allowCredentials.length > 0)
    options.allowCredentials = input.allowCredentials.map((id) => ({
      type: 'public-key',
      id: toBufferSource(id),
    }))
  return options
}
