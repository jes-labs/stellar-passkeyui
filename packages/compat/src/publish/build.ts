import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findings } from '../data'
import { assertValidFindings, dataAsOf } from '../schema'
import { generateGuide } from './guide'
import { deriveRules, emitRulesModule } from './rules'

// Validate, then regenerate the two artifacts the data feeds: the SDK's runtime
// rules (a generated file inside the core package) and the published guide. Run
// with `pnpm --filter @passkey-ui/compat generate`.

const here = dirname(fileURLToPath(import.meta.url))

const CORE_RULES_PATH = resolve(here, '../../../core/src/generated/compat-rules.gen.ts')
const GUIDE_PATH = resolve(here, '../../generated/compatibility-guide.md')

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents.endsWith('\n') ? contents : `${contents}\n`)
}

assertValidFindings(findings)

const asOf = dataAsOf(findings)
const rules = deriveRules(findings)

write(CORE_RULES_PATH, emitRulesModule(rules, { asOf }))
write(GUIDE_PATH, generateGuide(findings, { asOf }))

console.log(`compat: validated ${findings.length} findings (data as of ${asOf})`)
console.log(`compat: wrote ${rules.length} runtime rules -> ${CORE_RULES_PATH}`)
console.log(`compat: wrote guide -> ${GUIDE_PATH}`)
