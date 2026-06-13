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

  const link = await page
    .getByRole('link', { name: /View it on stellar\.expert/ })
    .getAttribute('href')
  expect(link ?? '').toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}$/)
  console.info('LIVE PAYMENT TX:', link)

  // Recovery: enroll a second passkey and add it as a signer on-chain. The
  // backup passkey is created on the same virtual authenticator under a
  // different user handle (Chromium allows only one internal authenticator).
  // The app verifies the new signer through the wallet-state reader before
  // reporting success, so the visible receipt is already chain-checked.
  await page.getByRole('button', { name: 'Add a backup passkey' }).click()
  await expect(page.getByText('Signer added', { exact: true })).toBeVisible({ timeout: 150_000 })
  const recoveryLink = await page.getByRole('link', { name: /add_signer/ }).getAttribute('href')
  console.info('LIVE ADD_SIGNER TX:', recoveryLink)

  await page.screenshot({ path: '/tmp/aurum-live-onchain.png', fullPage: true })

  // Reconnect: after a reload, "I already have a wallet" must come back to the
  // SAME wallet (persistent session deployer + discoverable credential), with
  // deploy and funding skipped because the chain already has them.
  await page.reload()
  await page.getByRole('button', { name: 'I already have a wallet' }).click()
  await expect(page.getByText('Send a payment')).toBeVisible({ timeout: 60_000 })
  const reconnectedAddress = await page.locator('[data-field=address]').textContent()
  expect(reconnectedAddress).toBe(address)
  console.info('RECONNECTED TO SAME WALLET:', reconnectedAddress)
})
