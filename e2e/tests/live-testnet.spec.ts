import { expect, test } from '@playwright/test'
import { addVirtualAuthenticator, enableWebAuthn } from './helpers'

// The whole story against the real network: a browser WebAuthn ceremony
// authorizes an actual payment on Stellar testnet. Gated behind E2E_LIVE
// because it spends minutes of wall clock and depends on friendbot and the
// public RPC; run with: E2E_LIVE=1 npx playwright test live-testnet
const LIVE = process.env.E2E_LIVE === '1'

test('a passkey created in the browser pays out of a smart wallet on testnet', async ({ page }) => {
  test.skip(!LIVE, 'set E2E_LIVE=1 to run against the real network')
  test.setTimeout(240_000)

  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/')

  // Create the passkey; the app then funds a session account, deploys the
  // wallet, and funds it — all on live testnet.
  await page.getByRole('button', { name: 'Create passkey' }).click()
  await expect(page.getByText('Send a payment')).toBeVisible({ timeout: 120_000 })

  const address = await page.locator('[data-field=address]').textContent()
  expect(address ?? '').toMatch(/^C[A-Z2-7]{55}$/)

  // Sign with the passkey; the app submits and the contract verifies on-chain.
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await expect(page.getByText('On-chain', { exact: true })).toBeVisible({ timeout: 120_000 })

  const link = await page.getByRole('link', { name: /stellar\.expert/ }).getAttribute('href')
  expect(link ?? '').toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}$/)
  console.info('LIVE PAYMENT TX:', link)

  await page.screenshot({ path: '/tmp/aurum-live-onchain.png', fullPage: true })
})
