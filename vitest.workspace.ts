import { defineWorkspace } from 'vitest/config'

// Each package owns its own vitest config; this root file just collects them
// so `pnpm test` runs the whole suite from one place.
export default defineWorkspace(['packages/*'])
