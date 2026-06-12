import { expect, test } from '@playwright/test'
import { addVirtualAuthenticator, enableWebAuthn } from './helpers'

// End-to-end through the real stack: the demo app, the React components, the
// flow layer, the core SDK, and a real WebAuthn ceremony against Chromium's
// virtual authenticator. The crypto checks at the end run in the browser with
// WebCrypto, against the actual bytes the ceremony produced.

const CONTRACT_ADDRESS = /^C[A-Z2-7]{55}$/
const UNCOMPRESSED_P256_HEX = /^04[0-9a-f]{128}$/
const COMPACT_SIGNATURE_HEX = /^[0-9a-f]{128}$/

test('the capability card reports a healthy platform', async ({ page }) => {
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/')

  const lights = page.locator('.light')
  await expect(lights.filter({ hasText: 'WebAuthn' })).toHaveClass(/light--on/)
  await expect(lights.filter({ hasText: 'Secure context' })).toHaveClass(/light--on/)
})

test('create and sign run real ceremonies and the signature verifies', async ({ page }) => {
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/')

  // Create: a real registration ceremony.
  await page.getByRole('button', { name: 'Create passkey' }).click()
  await expect(page.getByText('Smart-wallet address', { exact: true })).toBeVisible()

  const address = await page.locator('[data-field=address]').textContent()
  expect(address ?? '').toMatch(CONTRACT_ADDRESS)

  // Inside the technical-proof drawer; textContent works without expanding it.
  const publicKeyHex = await page.locator('[data-field=public-key]').textContent()
  expect(publicKeyHex ?? '').toMatch(UNCOMPRESSED_P256_HEX)

  // The authenticator was created with resident-key support, and the SDK should
  // have picked that up from the credProps extension.
  const residentKey = await page.evaluate(() => window.__passkeyDemo?.create?.residentKey)
  expect(residentKey).toBe(true)

  // Sign: a real assertion ceremony over the demo payload.
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await expect(page.getByText('Signature (64-byte compact)', { exact: true })).toBeVisible()

  const signatureHex = await page.locator('[data-field=signature]').textContent()
  expect(signatureHex ?? '').toMatch(COMPACT_SIGNATURE_HEX)

  // Verify the real bytes in the browser: the compact signature must verify
  // under WebCrypto against the created public key, over exactly the digest the
  // smart-wallet contract re-derives, and the clientDataJSON must carry the
  // demo payload as its challenge.
  const verdict = await page.evaluate(async () => {
    const demo = window.__passkeyDemo
    if (!demo?.create || !demo?.sign) return { error: 'missing ceremony results' }
    const { create, sign } = demo

    const publicKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(create.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const clientDataHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(sign.clientDataJSON)),
    )
    const preimage = new Uint8Array(sign.authenticatorData.length + clientDataHash.length)
    preimage.set(new Uint8Array(sign.authenticatorData))
    preimage.set(clientDataHash, sign.authenticatorData.length)

    const signatureValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      new Uint8Array(sign.signature),
      preimage,
    )

    const recomputedDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', preimage))
    const digestMatches =
      recomputedDigest.length === sign.signedDigest.length &&
      recomputedDigest.every((byte, i) => byte === sign.signedDigest[i])

    const clientData = JSON.parse(new TextDecoder().decode(new Uint8Array(sign.clientDataJSON)))
    const expectedChallenge = btoa(
      String.fromCharCode(...new Uint8Array(32).map((_, i) => (i * 7 + 3) % 256)),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    return {
      signatureValid,
      digestMatches,
      challengeMatches: clientData.challenge === expectedChallenge,
      clientDataType: clientData.type,
    }
  })

  expect(verdict).toEqual({
    signatureValid: true,
    digestMatches: true,
    challengeMatches: true,
    clientDataType: 'webauthn.get',
  })
})

test('a user-verification-less authenticator still completes create (uv preferred)', async ({
  page,
}) => {
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client, {
    hasUserVerification: false,
    isUserVerified: false,
  })
  await page.goto('/')

  // The SDK requests userVerification "preferred", so an authenticator without
  // UV must degrade gracefully instead of rejecting the ceremony. This is the
  // user-verification compatibility cell, automated.
  await page.getByRole('button', { name: 'Create passkey' }).click()
  await expect(page.getByText('Smart-wallet address', { exact: true })).toBeVisible()
})

test('a failed ceremony shows a retryable error, and retry recovers', async ({ page }) => {
  const client = await enableWebAuthn(page)
  const authenticator = await addVirtualAuthenticator(client)
  await page.goto('/')

  await page.getByRole('button', { name: 'Create passkey' }).click()
  await expect(page.getByText('Smart-wallet address', { exact: true })).toBeVisible()

  // Snapshot the credential, then wipe it from the authenticator. Signing
  // against a credential the device no longer holds is the real lost-credential
  // failure: the browser rejects with NotAllowedError.
  const { credentials } = await client.send('WebAuthn.getCredentials', {
    authenticatorId: authenticator.authenticatorId,
  })
  const credential = credentials[0]
  expect(credentials.length).toBe(1)
  if (!credential) throw new Error('expected one credential on the authenticator')

  await client.send('WebAuthn.clearCredentials', {
    authenticatorId: authenticator.authenticatorId,
  })
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

  // Restore the credential — the synced-passkey-comes-back case — and retry.
  await client.send('WebAuthn.addCredential', {
    authenticatorId: authenticator.authenticatorId,
    credential,
  })
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Signature (64-byte compact)', { exact: true })).toBeVisible()
})
