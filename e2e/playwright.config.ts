import { defineConfig } from '@playwright/test'

// Browser end-to-end tests: real Chromium, a CDP virtual authenticator, and the
// actual demo app served by Vite. The webServer block builds and serves the
// example, so `pnpm --filter @passkey-ui/e2e test` is self-contained.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm --filter example-wallet-kit run build && pnpm --filter example-wallet-kit run preview -- --port 4173 --strictPort',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
