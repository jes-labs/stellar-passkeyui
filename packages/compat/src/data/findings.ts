import type { CompatFinding } from '../schema'

// The compatibility matrix. Every entry is sourced from specifications, vendor
// documentation, or issue trackers and marked "documented" — it has not yet been
// re-confirmed on real hardware by this project. The automated and on-device
// verification harness will upgrade entries to "automated" or "manual-device"
// and update their dates. Stating that plainly is the point: a guide is only
// useful if a reader can tell what has actually been checked.

const VERIFIED = '2026-06-11'

export const findings: readonly CompatFinding[] = [
  {
    id: 'safari-webauthn-create-in-iframe',
    title: 'Safari blocks passkey creation inside cross-origin iframes',
    axis: 'embedding-context',
    feature: 'credential-create',
    platforms: { browsers: ['safari', 'safari-ios'], operatingSystems: ['macos', 'ios'] },
    outcome: 'fails',
    cause:
      'WebKit does not expose navigator.credentials.create() to cross-origin iframes, so an embedded registration call is rejected.',
    fallback:
      'Run the create flow in a popup or full-page redirect on the wallet origin, then return to the embedding page.',
    recommendation:
      'Detect Safari and route passkey creation out of the iframe to a popup; a get() ceremony can stay in the frame where the permissions policy allows it.',
    sources: [
      'https://github.com/WebKit/standards-positions/issues/304',
      'https://developer.apple.com/documentation/authenticationservices',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: { condition: 'safari-create-in-iframe', action: 'open-popup-for-create' },
  },
  {
    id: 'cross-origin-iframe-permissions-policy',
    title: 'Cross-origin iframes need an explicit permissions policy for WebAuthn',
    axis: 'embedding-context',
    feature: 'credential-get',
    platforms: { browsers: ['chrome', 'edge', 'chrome-android', 'firefox', 'safari'] },
    outcome: 'partial',
    cause:
      'Without "publickey-credentials-get" and "publickey-credentials-create" granted to the wallet origin in the iframe allow attribute, browsers block WebAuthn calls made from the frame.',
    fallback:
      'Set the iframe allow attribute to grant both permissions to the wallet origin. When the embedding page is not under your control, fall back to a popup.',
    recommendation:
      'Ship the correct allow attribute as part of the embed snippet and document it; treat a missing or wrong policy as a popup trigger rather than a hard failure.',
    sources: [
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy/publickey-credentials-get',
      'https://www.w3.org/TR/webauthn-2/#sctn-permissions-policy',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: { condition: 'cross-origin-iframe', action: 'set-iframe-permissions-or-popup' },
  },
  {
    id: 'insecure-context-no-webauthn',
    title: 'WebAuthn is unavailable on insecure (HTTP) origins',
    axis: 'transport-security',
    feature: 'credential-get',
    platforms: {
      browsers: ['chrome', 'safari', 'firefox', 'edge', 'chrome-android', 'safari-ios'],
    },
    outcome: 'unsupported',
    cause:
      'navigator.credentials requires a secure context. Plain HTTP origins other than localhost do not expose the API at all.',
    fallback:
      'Serve the wallet over HTTPS. localhost and 127.0.0.1 are treated as secure contexts for development.',
    recommendation:
      'Hard-require HTTPS in production and fail early with a clear message when the page is served over HTTP.',
    sources: [
      'https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts',
      'https://www.w3.org/TR/webauthn-2/#sctn-secure-contexts',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: { condition: 'insecure-context', action: 'require-secure-context' },
  },
  {
    id: 'resident-key-support-varies',
    title: 'Discoverable (resident) credential support varies by authenticator',
    axis: 'capability-flag',
    feature: 'resident-key',
    platforms: { browsers: ['chrome', 'safari', 'firefox', 'edge'] },
    outcome: 'partial',
    cause:
      'Platform authenticators such as iCloud Keychain, Google Password Manager, and Windows Hello support discoverable credentials, but some roaming security keys have limited resident-key storage or none.',
    fallback:
      'When resident keys are unavailable, fall back to non-discoverable credentials and persist the credential ID so it can be passed in allowCredentials on sign-in.',
    recommendation:
      'Request residentKey "preferred" unless usernameless login is essential, and always store the credential ID so sign-in works either way.',
    sources: [
      'https://passkeys.dev/device-support/',
      'https://www.w3.org/TR/webauthn-2/#dom-authenticatorselectioncriteria-residentkey',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: { condition: 'no-resident-key', action: 'use-credential-id-allowlist' },
  },
  {
    id: 'discoverability-address-chicken-egg',
    title: 'The passkey-to-address discoverability problem',
    axis: 'capability-flag',
    feature: 'discoverability',
    platforms: {},
    outcome: 'partial',
    cause:
      'The smart-wallet address derives from the passkey public key, so the address is unknown until after the credential exists, yet WebAuthn does not let you rename a credential afterwards to carry that address.',
    fallback:
      'Record the credential-ID to contract-address mapping at creation time (in the indexer and locally), and use discoverable credentials where supported so the credential can be found without knowing the address first.',
    recommendation:
      'Persist the mapping on create and treat the indexer as the lookup of record. Do not rely on naming the passkey with the address.',
    sources: ['https://porto.sh', 'https://passkeys.dev/docs/use-cases/bootstrapping/'],
    verification: { method: 'documented', lastVerified: VERIFIED },
  },
  {
    id: 'user-verification-required-vs-preferred',
    title: 'userVerification "required" can break some authenticators',
    axis: 'capability-flag',
    feature: 'user-verification',
    platforms: { browsers: ['chrome', 'safari', 'firefox', 'edge'] },
    outcome: 'partial',
    cause:
      'Forcing userVerification "required" demands a biometric or PIN. A roaming key without a configured PIN, or certain platform states, rejects the ceremony rather than degrading to a lower assurance level.',
    fallback:
      'Use "preferred" for broad compatibility and reserve "required" for flows whose security model genuinely needs guaranteed user verification.',
    recommendation:
      'Default to "preferred" and make "required" an explicit, documented opt-in chosen per wallet policy.',
    sources: [
      'https://www.w3.org/TR/webauthn-2/#enum-userVerificationRequirement',
      'https://passkeys.dev/docs/reference/terms/',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
  },
  {
    id: 'conditional-mediation-autofill',
    title: 'Passkey autofill (conditional UI) is not universally available',
    axis: 'capability-flag',
    feature: 'conditional-mediation',
    platforms: { browsers: ['chrome', 'safari', 'edge', 'chrome-android', 'safari-ios'] },
    outcome: 'partial',
    cause:
      'mediation "conditional" drives passkey autofill in form fields and is gated behind PublicKeyCredential.isConditionalMediationAvailable(); older browsers and Firefox lag behind.',
    fallback:
      'Feature-detect conditional mediation; when it is absent, show an explicit "Sign in with a passkey" button instead of relying on autofill.',
    recommendation:
      'Always offer the explicit button and layer autofill on top only where it is available.',
    sources: [
      'https://web.dev/articles/passkey-form-autofill',
      'https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/isConditionalMediationAvailable_static',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: { condition: 'no-conditional-mediation', action: 'show-explicit-passkey-button' },
  },
  {
    id: 'platform-authenticator-availability',
    title: 'A user-verifying platform authenticator may not be present',
    axis: 'authenticator',
    feature: 'credential-create',
    platforms: { browsers: ['chrome', 'firefox', 'edge'], operatingSystems: ['windows', 'linux'] },
    outcome: 'partial',
    cause:
      'A desktop without Windows Hello configured, or a Linux machine without a platform authenticator, reports no user-verifying platform authenticator; isUserVerifyingPlatformAuthenticatorAvailable() returns false.',
    fallback:
      'Offer a roaming security key or the cross-device (phone) flow when no platform authenticator is available.',
    recommendation:
      'Probe isUserVerifyingPlatformAuthenticatorAvailable() before offering "create on this device"; otherwise present cross-device or security-key options.',
    sources: [
      'https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/isUserVerifyingPlatformAuthenticatorAvailable_static',
      'https://passkeys.dev/device-support/',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
    runtime: {
      condition: 'no-platform-authenticator',
      action: 'offer-cross-device-or-security-key',
    },
  },
  {
    id: 'synced-vs-device-bound-passkeys',
    title: 'Synced and device-bound passkeys behave differently for recovery',
    axis: 'credential-storage',
    feature: 'discoverability',
    platforms: {
      browsers: ['safari', 'chrome', 'safari-ios', 'chrome-android'],
      operatingSystems: ['ios', 'android', 'macos'],
    },
    outcome: 'works',
    cause:
      'iCloud Keychain and Google Password Manager sync passkeys across a user’s devices, while roaming security keys and some enterprise configurations are device-bound and do not sync.',
    fallback:
      'Do not assume a passkey survives device loss. For device-bound setups, require enrolling a second signer up front.',
    recommendation:
      'Surface whether a credential is synced, and for device-bound credentials push the user to add a recovery signer during onboarding.',
    sources: [
      'https://passkeys.dev/docs/reference/terms/',
      'https://support.apple.com/en-us/102195',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
  },
  {
    id: 'cross-device-hybrid-flow',
    title: 'Cross-device sign-in lets a phone authenticate a desktop',
    axis: 'cross-device',
    feature: 'cross-device-auth',
    platforms: {
      browsers: ['chrome', 'edge', 'safari'],
      operatingSystems: ['macos', 'windows', 'android', 'ios'],
    },
    outcome: 'works',
    cause:
      'The hybrid transport pairs a desktop browser with a phone over a QR code and Bluetooth proximity check; it is supported across Chromium and Safari, with UX differences between them.',
    fallback:
      'When no local authenticator fits, present the cross-device option; it requires Bluetooth on both ends.',
    recommendation:
      'Offer cross-device as a first-class path for desktops without a platform authenticator, and explain the Bluetooth requirement.',
    sources: [
      'https://passkeys.dev/docs/reference/terms/',
      'https://developers.google.com/identity/passkeys/supported-environments',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
  },
  {
    id: 'attestation-none-default',
    title: 'Request no attestation for consumer passkey wallets',
    axis: 'capability-flag',
    feature: 'attestation',
    platforms: { browsers: ['chrome', 'safari', 'firefox', 'edge'] },
    outcome: 'works',
    cause:
      'Direct or enterprise attestation can surface extra consent prompts and privacy concerns, and platform authenticators frequently return none regardless.',
    fallback:
      'Use attestation "none" and do not depend on attestation data for the wallet trust model.',
    recommendation:
      'Default attestation to "none" unless a specific compliance requirement dictates otherwise.',
    sources: [
      'https://www.w3.org/TR/webauthn-2/#enum-attestation-convey',
      'https://passkeys.dev/docs/advanced/',
    ],
    verification: { method: 'documented', lastVerified: VERIFIED },
  },
]
