// The shape of the compatibility matrix. Everything downstream — the published
// guide and the SDK's runtime fallback rules — is derived from data that conforms
// to these types, so the schema is the contract that keeps them in step.

/** The dimension of variability a finding is about. */
export type CompatAxis =
  | 'embedding-context'
  | 'transport-security'
  | 'credential-storage'
  | 'authenticator'
  | 'capability-flag'
  | 'cross-device'

/** The WebAuthn capability a finding concerns. */
export type WebAuthnFeature =
  | 'credential-create'
  | 'credential-get'
  | 'resident-key'
  | 'user-verification'
  | 'conditional-mediation'
  | 'attestation'
  | 'cross-device-auth'
  | 'discoverability'

/** What actually happens on the affected platforms. */
export type Outcome = 'works' | 'partial' | 'fails' | 'unsupported'

/**
 * How a finding was confirmed. Kept honest on purpose:
 * - documented   sourced from specs, vendor docs, or issue trackers
 * - automated    exercised by the CI virtual-authenticator harness
 * - manual-device confirmed by hand on a named real device
 */
export type VerificationMethod = 'documented' | 'automated' | 'manual-device'

export const BROWSERS = [
  'chrome',
  'edge',
  'firefox',
  'safari',
  'chrome-android',
  'firefox-android',
  'safari-ios',
] as const
export type Browser = (typeof BROWSERS)[number]

export const OPERATING_SYSTEMS = ['macos', 'windows', 'linux', 'ios', 'android'] as const
export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number]

// The runtime conditions the SDK can actually detect, and the actions it can take
// in response. These two lists are the closed vocabulary shared between the data
// and the generated rules, so the SDK never sees a condition or action it cannot
// handle.
export const RUNTIME_CONDITIONS = [
  'safari-create-in-iframe',
  'cross-origin-iframe',
  'insecure-context',
  'no-resident-key',
  'no-conditional-mediation',
  'no-platform-authenticator',
] as const
export type RuntimeConditionId = (typeof RUNTIME_CONDITIONS)[number]

export const FALLBACK_ACTIONS = [
  'open-popup-for-create',
  'set-iframe-permissions-or-popup',
  'require-secure-context',
  'use-credential-id-allowlist',
  'show-explicit-passkey-button',
  'offer-cross-device-or-security-key',
] as const
export type FallbackActionId = (typeof FALLBACK_ACTIONS)[number]

/** Which platforms a finding applies to. An empty selector means "all". */
export interface PlatformSelector {
  browsers?: readonly Browser[]
  operatingSystems?: readonly OperatingSystem[]
}

export interface Verification {
  method: VerificationMethod
  /** ISO date, YYYY-MM-DD. */
  lastVerified: string
  notes?: string
}

/** Present when a finding maps to something the SDK can detect and act on. */
export interface RuntimeRuleRef {
  condition: RuntimeConditionId
  action: FallbackActionId
}

export interface CompatFinding {
  /** Stable kebab-case identifier. */
  id: string
  title: string
  axis: CompatAxis
  feature: WebAuthnFeature
  platforms: PlatformSelector
  outcome: Outcome
  /** Why it happens. */
  cause: string
  /** What to do instead when it does not work. */
  fallback: string
  /** Guidance for a wallet team. */
  recommendation: string
  sources: readonly string[]
  verification: Verification
  runtime?: RuntimeRuleRef
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Check the dataset for the integrity problems that would silently corrupt the
 * generated output: missing fields, duplicate ids, malformed dates. Returns a
 * list of human-readable errors, empty when the data is sound.
 */
export function validateFindings(findings: readonly CompatFinding[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const finding of findings) {
    const where = finding.id || '(finding with no id)'

    if (!finding.id) errors.push('a finding is missing its id')
    else if (seen.has(finding.id)) errors.push(`duplicate id: ${finding.id}`)
    else seen.add(finding.id)

    if (!finding.title) errors.push(`${where}: missing title`)
    if (!finding.cause) errors.push(`${where}: missing cause`)
    if (!finding.fallback) errors.push(`${where}: missing fallback`)
    if (!finding.recommendation) errors.push(`${where}: missing recommendation`)
    if (finding.sources.length === 0) errors.push(`${where}: needs at least one source`)
    if (!ISO_DATE.test(finding.verification.lastVerified))
      errors.push(
        `${where}: lastVerified "${finding.verification.lastVerified}" is not an ISO date`,
      )
  }

  return errors
}

/** Throw if the dataset has any integrity problems. */
export function assertValidFindings(findings: readonly CompatFinding[]): void {
  const errors = validateFindings(findings)
  if (errors.length > 0)
    throw new Error(`compatibility data failed validation:\n- ${errors.join('\n- ')}`)
}

/** The most recent last-verified date across the dataset, as a "data as of" stamp. */
export function dataAsOf(findings: readonly CompatFinding[]): string {
  let latest = '0000-00-00'
  for (const finding of findings)
    if (finding.verification.lastVerified > latest) latest = finding.verification.lastVerified
  return latest
}
