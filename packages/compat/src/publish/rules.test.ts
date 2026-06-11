import { describe, expect, test } from 'vitest'
import { findings } from '../data'
import { deriveRules, emitRulesModule } from './rules'

describe('deriveRules', () => {
  const rules = deriveRules(findings)

  test('includes only findings that carry a runtime rule', () => {
    const expected = findings.filter((finding) => finding.runtime).length
    expect(rules.length).toBe(expected)
    expect(rules.length).toBeGreaterThan(0)
  })

  test('carries the condition, action, and source through from the finding', () => {
    for (const rule of rules) {
      const source = findings.find((finding) => finding.id === rule.id)
      expect(source?.runtime?.condition).toBe(rule.condition)
      expect(source?.runtime?.action).toBe(rule.action)
      expect(rule.sources.length).toBeGreaterThan(0)
    }
  })
})

describe('emitRulesModule', () => {
  const module = emitRulesModule(deriveRules(findings), { asOf: '2026-06-11' })

  test('is marked auto-generated and stamped', () => {
    expect(module).toContain('AUTO-GENERATED')
    expect(module).toContain('Data as of: 2026-06-11')
  })

  test('declares the types and the exported const', () => {
    expect(module).toContain('export type RuntimeConditionId')
    expect(module).toContain('export type FallbackActionId')
    expect(module).toContain('export interface CompatRule')
    expect(module).toContain('export const compatRules: readonly CompatRule[]')
  })

  test('contains every derived rule id', () => {
    for (const rule of deriveRules(findings)) expect(module).toContain(`"${rule.id}"`)
  })

  test('is deterministic', () => {
    expect(emitRulesModule(deriveRules(findings), { asOf: '2026-06-11' })).toBe(module)
  })
})
