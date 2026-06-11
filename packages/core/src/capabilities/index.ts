// Capability detection and the fallback engine: figure out what the platform can
// do, and which documented fallbacks apply.

export { detectBrowser } from './browser'
export { browserEnvironment } from './environment'
export { detectCapabilities } from './detect'
export { activeConditions, selectFallbacks } from './fallbacks'
export type {
  BrowserEngine,
  BrowserFamily,
  Capabilities,
  ConditionObservations,
  PasskeyEnvironment,
} from './types'
export type {
  CompatRule,
  RuntimeConditionId,
  FallbackActionId,
} from '../generated/compat-rules.gen'
