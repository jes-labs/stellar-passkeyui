import { describe, expect, test } from 'vitest'
import { findings } from '../data'
import { generateGuide } from './guide'

describe('generateGuide', () => {
  const guide = generateGuide(findings, { asOf: '2026-06-11' })

  test('includes the title and the data-as-of stamp', () => {
    expect(guide).toContain('# Stellar Passkey Compatibility Guide')
    expect(guide).toContain('Data as of **2026-06-11**')
  })

  test('renders every finding title', () => {
    for (const finding of findings) expect(guide).toContain(finding.title)
  })

  test('explains the verification statuses', () => {
    expect(guide).toContain('documented')
    expect(guide).toContain('automated')
    expect(guide).toContain('manual-device')
  })

  test('surfaces the SDK rule for findings that have one', () => {
    const withRule = findings.find((finding) => finding.runtime)
    expect(withRule).toBeDefined()
    if (withRule?.runtime) expect(guide).toContain(withRule.runtime.condition)
  })

  test('is deterministic', () => {
    expect(generateGuide(findings, { asOf: '2026-06-11' })).toBe(guide)
  })
})
