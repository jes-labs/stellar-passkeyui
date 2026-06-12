import type { PasskeyEnvironment } from './types'

// Build a PasskeyEnvironment from the real browser globals. Every access is
// guarded so importing this in a non-browser context (SSR, a test runner, a
// build step) returns safe, conservative defaults instead of throwing.
export function browserEnvironment(): PasskeyEnvironment {
  const hasWindow = typeof window !== 'undefined'
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  const PublicKeyCredentialCtor =
    typeof PublicKeyCredential !== 'undefined' ? PublicKeyCredential : undefined

  return {
    secureContext: hasWindow ? window.isSecureContext : false,
    webauthnAvailable: PublicKeyCredentialCtor !== undefined,
    inIframe: hasWindow ? window.top !== window.self : false,
    crossOriginIframe: hasWindow ? detectCrossOriginIframe(window) : false,
    userAgent,
    brands: readClientHintBrands(),
    isPlatformAuthenticatorAvailable: () =>
      PublicKeyCredentialCtor?.isUserVerifyingPlatformAuthenticatorAvailable?.() ??
      Promise.resolve(false),
    isConditionalMediationAvailable: () =>
      PublicKeyCredentialCtor?.isConditionalMediationAvailable?.() ?? Promise.resolve(false),
  }
}

// User-Agent Client Hints. Brave, Opera, and Edge ship a Chrome user-agent
// string but declare their real brand here, so it is the only reliable way to
// name the browser a user is actually looking at. Still experimental in the DOM
// types, hence the local shape.
function readClientHintBrands(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  const data = (navigator as { userAgentData?: { brands?: ReadonlyArray<{ brand: string }> } })
    .userAgentData
  return data?.brands?.map((entry) => entry.brand) ?? []
}

// A same-origin top frame lets us read its origin; a cross-origin top frame
// throws on that access, which is itself the signal we want.
function detectCrossOriginIframe(win: Window): boolean {
  if (win.top === win.self) return false
  try {
    const top = win.top
    if (!top) return false
    return top.location.origin !== win.location.origin
  } catch {
    return true
  }
}
