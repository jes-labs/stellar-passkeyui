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

  return {
    webauthnAvailable: env.webauthnAvailable,
    secureContext: env.secureContext,
    inIframe: env.inIframe,
    crossOriginIframe: env.crossOriginIframe,
    platformAuthenticator,
    conditionalMediation,
    browser: family,
    engine,
  }
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
