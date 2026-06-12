import { expect, test } from '@playwright/test'
import { addVirtualAuthenticator, enableWebAuthn } from './helpers'

const noHorizontalOverflow = async (page: import('@playwright/test').Page) => {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
}

test('mobile: no overflow on onboard and wallet views', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/?mode=offline')
  await page.waitForTimeout(1200)
  expect(await noHorizontalOverflow(page), 'onboard overflows').toBe(true)
  await page.screenshot({ path: '/tmp/aurum-mobile-onboard.png' })

  await page.getByRole('button', { name: 'Create passkey' }).click()
  await page.getByText('Smart-wallet address', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await page.getByText('Signature (64-byte compact)', { exact: true }).waitFor()
  for (const summary of await page.locator('.drawer summary').all()) await summary.click()
  await page.waitForTimeout(400)
  expect(await noHorizontalOverflow(page), 'wallet overflows').toBe(true)
  await page.screenshot({ path: '/tmp/aurum-mobile-wallet.png', fullPage: true })
})
