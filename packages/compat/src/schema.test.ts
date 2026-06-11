import { describe, expect, test } from 'vitest'
import { findings } from './data'
import {
  type CompatFinding,
  FALLBACK_ACTIONS,
  RUNTIME_CONDITIONS,
  dataAsOf,
  validateFindings,
} from './schema'

describe('shipped dataset', () => {
  test('passes validation', () => {
    expect(validateFindings(findings)).toEqual([])
  })

  test('every runtime rule uses a known condition and action', () => {
    for (const finding of findings) {
      if (!finding.runtime) continue
      expect(RUNTIME_CONDITIONS).toContain(finding.runtime.condition)
      expect(FALLBACK_ACTIONS).toContain(finding.runtime.action)
    }
  })

  test('ids are unique', () => {
    const ids = findings.map((finding) => finding.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('dataAsOf returns the latest verified date', () => {
    expect(dataAsOf(findings)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('validateFindings catches problems', () => {
  const base: CompatFinding = {
    id: 'sample',
    title: 'Sample',
    axis: 'capability-flag',
    feature: 'credential-get',
    platforms: {},
    outcome: 'works',
    cause: 'because',
    fallback: 'do this',
    recommendation: 'do that',
    sources: ['https://example.com'],
    verification: { method: 'documented', lastVerified: '2026-06-11' },
  }

  test('flags duplicate ids', () => {
    const errors = validateFindings([base, { ...base }])
    expect(errors.some((error) => error.includes('duplicate id'))).toBe(true)
  })

  test('flags a malformed date', () => {
    const errors = validateFindings([
      { ...base, verification: { method: 'documented', lastVerified: 'June 2026' } },
    ])
    expect(errors.some((error) => error.includes('not an ISO date'))).toBe(true)
  })

  test('flags missing sources', () => {
    const errors = validateFindings([{ ...base, sources: [] }])
    expect(errors.some((error) => error.includes('needs at least one source'))).toBe(true)
  })
})
