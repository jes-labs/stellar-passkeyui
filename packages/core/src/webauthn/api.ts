// The thin boundary to the browser's WebAuthn API. Everything the SDK needs from
// a ceremony is normalized into plain bytes here, so the rest of the code never
// touches a live PublicKeyCredential and stays testable with a fake.

/** Normalized result of navigator.credentials.create(). */
export interface RawCreateResult {
  credentialId: Uint8Array
  /** DER SubjectPublicKeyInfo from getPublicKey(), when the browser provides it. */
  publicKeySpki?: Uint8Array
  /** Raw authenticator data from getAuthenticatorData(), the fallback key source. */
  authenticatorData?: Uint8Array
  attestationObject?: Uint8Array
  /** Whether a discoverable (resident) key was actually created, via credProps. */
  residentKey?: boolean
  transports?: readonly string[]
}

/** Normalized result of navigator.credentials.get(). */
export interface RawGetResult {
  credentialId: Uint8Array
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  /** DER-encoded ECDSA signature, as returned by the authenticator. */
  signature: Uint8Array
  userHandle?: Uint8Array
}

export interface WebAuthnApi {
  create(options: PublicKeyCredentialCreationOptions): Promise<RawCreateResult>
  get(options: PublicKeyCredentialRequestOptions): Promise<RawGetResult>
}

/** The real implementation, backed by navigator.credentials. */
export function browserWebAuthnApi(): WebAuthnApi {
  return {
    async create(publicKey) {
      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('passkey creation was cancelled or returned no credential')

      const response = credential.response as AuthenticatorAttestationResponse
      const result: RawCreateResult = {
        credentialId: new Uint8Array(credential.rawId),
        attestationObject: new Uint8Array(response.attestationObject),
      }

      const spki = response.getPublicKey?.()
      if (spki) result.publicKeySpki = new Uint8Array(spki)

      if (typeof response.getAuthenticatorData === 'function')
        result.authenticatorData = new Uint8Array(response.getAuthenticatorData())

      const credProps = credential.getClientExtensionResults?.().credProps
      if (credProps && typeof credProps.rk === 'boolean') result.residentKey = credProps.rk

      if (typeof response.getTransports === 'function') result.transports = response.getTransports()

      return result
    },

    async get(publicKey) {
      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('passkey assertion was cancelled or returned no credential')

      const response = credential.response as AuthenticatorAssertionResponse
      const result: RawGetResult = {
        credentialId: new Uint8Array(credential.rawId),
        authenticatorData: new Uint8Array(response.authenticatorData),
        clientDataJSON: new Uint8Array(response.clientDataJSON),
        signature: new Uint8Array(response.signature),
      }
      if (response.userHandle) result.userHandle = new Uint8Array(response.userHandle)
      return result
    },
  }
}
