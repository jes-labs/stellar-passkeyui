// Public surface of the compatibility package: the schema, the dataset, and the
// generators. apps/docs and the build tooling consume these; the SDK consumes the
// generated rules file, not this package, at runtime.

export * from './schema'
export { findings, sessions } from './data'
export { generateGuide, type GuideOptions } from './publish/guide'
export {
  type CompatRule,
  deriveRules,
  emitRulesModule,
  type EmitOptions,
} from './publish/rules'
