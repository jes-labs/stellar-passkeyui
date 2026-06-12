import { detectBrowser } from './browser'
import { browserEnvironment } from './environment'
import type { Capabilities, PasskeyEnvironment } from './types'

// Resolve the platform's capabilities. The two authoritative WebAuthn probes are
// async, so this is async too. Pass a PasskeyEnvironment to test without a browser;
// it defaults to the real globals.
export async function detectCapabilities(
  env: PasskeyEnvironment = browserEnvironment(),
): Promise<Capabilities> {
  const { family, engine } = detectBrowser(env.userAgent)

  const [platformAuthenticator, conditionalMediation] = env.webauthnAvailable
    ? await Promise.all([
        settle(env.isPlatformAuthenticatorAvailable()),
        settle(env.isConditionalMediationAvailable()),
      ])
    : [false, false]

  const capabilities: Capabilities = {
    webauthnAvailable: env.webauthnAvailable,
    secureContext: env.secureContext,
    inIframe: env.inIframe,
    crossOriginIframe: env.crossOriginIframe,
    platformAuthenticator,
    conditionalMediation,
    browser: family,
    engine,
  }

  const brand = resolveBrand(env.brands)
  if (brand) capabilities.brand = brand

  return capabilities
}

// Pick the marketing name out of the client-hint brand list. The list carries
// grease entries ("Not.A/Brand") and the generic "Chromium"; the real brand is
// whatever remains. "Google Chrome" / "Microsoft Edge" are shortened to read
// naturally in a UI.
function resolveBrand(brands: readonly string[] | undefined): string | undefined {
  if (!brands || brands.length === 0) return undefined

  const meaningful = brands.filter((brand) => {
    const letters = brand.replace(/[^a-z]/gi, '').toLowerCase()
    return letters !== 'notabrand' && brand !== 'Chromium'
  })
  const first = meaningful[0]
  if (!first) return undefined
  return first.replace(/^Google /, '').replace(/^Microsoft /, '')
}

// A probe that throws or rejects is treated as "feature absent" rather than
// propagating, so detection never fails the caller.
async function settle(probe: Promise<boolean>): Promise<boolean> {
  try {
    return await probe
  } catch {
    return false
  }
}
