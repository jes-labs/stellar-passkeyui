import type { CDPSession, Page } from '@playwright/test'

// Chromium's virtual authenticator, driven over CDP. It performs real WebAuthn
// ceremonies — actual CTAP2, actual P-256 keys, actual signatures — without a
// physical device, which is exactly the automatable slice of the compatibility
// matrix.

export interface VirtualAuthenticatorOptions {
  hasResidentKey?: boolean
  hasUserVerification?: boolean
  isUserVerified?: boolean
}

export interface VirtualAuthenticator {
  client: CDPSession
  authenticatorId: string
  remove(): Promise<void>
}

export async function enableWebAuthn(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  return client
}

export async function addVirtualAuthenticator(
  client: CDPSession,
  options: VirtualAuthenticatorOptions = {},
): Promise<VirtualAuthenticator> {
  const { authenticatorId } = (await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: options.hasResidentKey ?? true,
      hasUserVerification: options.hasUserVerification ?? true,
      isUserVerified: options.isUserVerified ?? true,
      automaticPresenceSimulation: true,
    },
  })) as { authenticatorId: string }

  return {
    client,
    authenticatorId,
    remove: async () => {
      await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
    },
  }
}
