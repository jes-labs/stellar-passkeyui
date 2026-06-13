import { defineConfig } from '@playwright/test'

// End-to-end tests for the passkey module running inside the real Stellar
// Wallets Kit (examples/kit-integration, which consumes the kit built from the
// feat/passkey-module branch). Run with: npx playwright test -c kit.config.ts
export default defineConfig({
  testDir: './kit-tests',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    // kit-integration is a standalone project (consumes the PR-branch kit build
    // via a file: dependency), so it installs and builds on its own rather than
    // through the workspace.
    command: 'cd examples/kit-integration && pnpm install && pnpm run build && pnpm run preview',
    cwd: '..',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 240_000,
  },
})
