// What the SDK knows about the platform it is running on. These are the inputs
// the fallback engine reasons over.

export type BrowserFamily = 'safari' | 'chrome' | 'edge' | 'firefox' | 'other'

export type BrowserEngine = 'webkit' | 'blink' | 'gecko' | 'unknown'

export interface Capabilities {
  /** PublicKeyCredential exists on this platform. */
  webauthnAvailable: boolean
  /** The page is a secure context (HTTPS or localhost). */
  secureContext: boolean
  /** The page is running inside an iframe. */
  inIframe: boolean
  /** The page is in an iframe whose top-level origin differs from this one. */
  crossOriginIframe: boolean
  /** A user-verifying platform authenticator (Face ID, Hello, …) is available. */
  platformAuthenticator: boolean
  /** Conditional mediation (passkey autofill) is available. */
  conditionalMediation: boolean
  browser: BrowserFamily
  engine: BrowserEngine
  /**
   * The browser's marketing name from User-Agent Client Hints, when it declares
   * one (Brave, Opera, and Edge hide behind a Chrome user-agent string but do
   * declare their brand here). Display only — fallback logic keys on engine.
   */
  brand?: string
}

/**
 * Signals that can only be learned during a ceremony rather than detected ahead
 * of time. For example, whether a resident key was actually created is reported
 * by the credProps extension in the create() result, not by any pre-flight API.
 */
export interface ConditionObservations {
  residentKeyCreated?: boolean
}

/**
 * The platform queries the SDK depends on, abstracted behind an interface so
 * detection can be driven by real globals in a browser or by a fake in a test.
 */
export interface PasskeyEnvironment {
  secureContext: boolean
  webauthnAvailable: boolean
  inIframe: boolean
  crossOriginIframe: boolean
  userAgent: string
  /** Brand names from User-Agent Client Hints, where the browser provides them. */
  brands?: readonly string[]
  isPlatformAuthenticatorAvailable(): Promise<boolean>
  isConditionalMediationAvailable(): Promise<boolean>
}
