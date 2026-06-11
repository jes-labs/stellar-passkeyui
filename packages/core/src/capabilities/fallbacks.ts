import {
  type CompatRule,
  type RuntimeConditionId,
  compatRules,
} from '../generated/compat-rules.gen'
import type { Capabilities, ConditionObservations } from './types'

// The detection half of the system. The compat package owns what to do about a
// condition (the rules); core owns how to tell whether a condition holds (these
// evaluators). Keeping the evaluator map keyed by the generated RuntimeConditionId
// means the compiler refuses to build if the data introduces a condition core has
// not learned to detect yet.

interface ConditionInput {
  capabilities: Capabilities
  observations: ConditionObservations
}

const evaluators: Record<RuntimeConditionId, (input: ConditionInput) => boolean> = {
  'insecure-context': ({ capabilities }) => !capabilities.secureContext,

  // WebKit blocks credential creation in cross-origin iframes regardless of the
  // browser's branding, so this keys off the engine, not the family.
  'safari-create-in-iframe': ({ capabilities }) =>
    capabilities.engine === 'webkit' && capabilities.crossOriginIframe,

  'cross-origin-iframe': ({ capabilities }) => capabilities.crossOriginIframe,

  // Not knowable before a ceremony. The credProps extension reports it in the
  // create() result, which the caller feeds back in as an observation.
  'no-resident-key': ({ observations }) => observations.residentKeyCreated === false,

  'no-conditional-mediation': ({ capabilities }) => !capabilities.conditionalMediation,

  'no-platform-authenticator': ({ capabilities }) => !capabilities.platformAuthenticator,
}

/** The conditions that currently hold, given the detected capabilities. */
export function activeConditions(
  capabilities: Capabilities,
  observations: ConditionObservations = {},
): RuntimeConditionId[] {
  const input: ConditionInput = { capabilities, observations }
  const active: RuntimeConditionId[] = []
  for (const condition of Object.keys(evaluators) as RuntimeConditionId[])
    if (evaluators[condition](input)) active.push(condition)
  return active
}

/**
 * The documented fallback rules that apply right now. Each carries the action to
 * take, the reason, and its sources, drawn from the compatibility data. The flow
 * layer decides how to act on them; a hard blocker like require-secure-context
 * should take precedence over softer adjustments.
 */
export function selectFallbacks(
  capabilities: Capabilities,
  observations: ConditionObservations = {},
): CompatRule[] {
  const active = new Set(activeConditions(capabilities, observations))
  return compatRules.filter((rule) => active.has(rule.condition))
}
