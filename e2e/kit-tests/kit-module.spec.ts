import { createPrivateKey } from 'node:crypto'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import { fromBase64Url, payloadForAuthEntry, toBase64Url } from '@passkey-ui/core'
import { expect, test } from '@playwright/test'
import { Address, Networks, StrKey, xdr } from '@stellar/stellar-sdk'
import { addVirtualAuthenticator, enableWebAuthn } from '../tests/helpers'

// The deepest test in the project: the passkey module inside the REAL Stellar
// Wallets Kit (its built npm package), driven through the kit's own facade with
// a real CTAP2 ceremony — and the signature it produces verified independently
// by this repo's SDK and @noble. Two separate implementations agreeing on every
// byte is the strongest correctness evidence available without a deployed
// contract.

const REAL_FIXTURE_TXN =
  'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACZ2gAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABm9cbgAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAADAAAAEgAAAAHEqqtef1h9hZOQyrCuQRtZ3o8DHtvuSRoq1C8mc+UHHAAAABIAAAABStcRNXctVBwYQExJdAWbrBC3X+B3Ue9QkP4MJ8nhD7UAAAAKAAAAAAAAAAAAAAAAAJiWgAAAAAEAAAABAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccVuXL7MuknWEAAkrxAAAAEQAAAAEAAAACAAAAEAAAAAEAAAACAAAADwAAAAdFZDI1NTE5AAAAAA0AAAAgawYrFjEXTyFLVqniIQebbdWimEk+WkHm4UAdwhtQENIAAAAQAAAAAQAAAAIAAAAPAAAAB0VkMjU1MTkAAAAADQAAAEB4a0Pf3RTJS6TOa69dJ7TG5noSSX3OiRRk8xucLNsxgkckcRyeWr18ir8EgFATxz4X2WvJGLMYNDu11ScujcANAAAAEAAAAAEAAAACAAAADwAAAAZQb2xpY3kAAAAAABIAAAABa07R4ERvYHyHhguMb1H1ScVe13IWchSNA5oUEwVRrK8AAAABAAAAAAAAAAHXkotywnA8z+r365/0701QSlWouXn8m0UOoshCtNHOYQAAAAh0cmFuc2ZlcgAAAAMAAAASAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccAAAAEgAAAAFK1xE1dy1UHBhATEl0BZusELdf4HdR71CQ/gwnyeEPtQAAAAoAAAAAAAAAAAAAAAAAmJaAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAMAAAAGAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccAAAAFVbly+zLpJ1hAAAAAAAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAQAAAAAQAAAAIAAAAPAAAAB0JhbGFuY2UAAAAAEgAAAAFK1xE1dy1UHBhATEl0BZusELdf4HdR71CQ/gwnyeEPtQAAAAEAAAAGAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAAEAAAAAEAAAACAAAADwAAAAdCYWxhbmNlAAAAABIAAAABxKqrXn9YfYWTkMqwrkEbWd6PAx7b7kkaKtQvJnPlBxwAAAABAAWL7QAAArgAAAIIAAAAAAACZwQAAAAA'

function buildAuthEntry(walletAddress: string): string {
  // A realistic auth entry: the wallet authorizes calling hello() on a contract.
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(walletAddress).toScAddress(),
        functionName: 'hello',
        args: [],
      }),
    ),
    subInvocations: [],
  })

  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(walletAddress).toScAddress(),
        nonce: new xdr.Int64(123456789n),
        signatureExpirationLedger: 4_000_000,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  })
  return entry.toXDR('base64')
}

test('the kit modal lists the Passkey module', async ({ page }) => {
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/')

  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByText('Passkey', { exact: true })).toBeVisible()
  await expect(page.getByText('Freighter', { exact: true })).toBeVisible()
  await expect(page.getByText('Albedo', { exact: true })).toBeVisible()
  await expect(page.getByText('xBull', { exact: true })).toBeVisible()
  await expect(page.getByText('LOBSTR', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/kit-modal-passkey.png' })
})

test('connect and signAuthEntry through the kit facade, verified independently', async ({
  page,
}) => {
  const client = await enableWebAuthn(page)
  const authenticator = await addVirtualAuthenticator(client)
  await page.goto('/')

  // Connect: a real registration ceremony through StellarWalletsKit.fetchAddress.
  const address = await page.evaluate(() => window.harness.connect())
  expect(address).toMatch(/^C[A-Z2-7]{55}$/)
  expect(StrKey.isValidContract(address)).toBe(true)

  // Sign a realistic auth entry for that wallet through the kit facade.
  const entryXdr = buildAuthEntry(address)
  const signedXdr = await page.evaluate((entry) => window.harness.signEntry(entry), entryXdr)

  const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64')

  // The credentials besides the signature must be untouched.
  const credentials = signed.credentials().address()
  expect(credentials.nonce().toString()).toBe('123456789')
  expect(credentials.signatureExpirationLedger()).toBe(4_000_000)

  // Unpack the signature ScVal: Map<SignerKey::Secp256r1(credentialId),
  // Signature::Secp256r1({ authenticator_data, client_data_json, signature })>.
  const signatureMap = credentials.signature().map()
  expect(signatureMap).not.toBeNull()
  expect(signatureMap!.length).toBe(1)

  const entrySigned = signatureMap![0]!
  const keyVec = entrySigned.key().vec()!
  expect(keyVec[0]!.sym().toString()).toBe('Secp256r1')
  const credentialId = new Uint8Array(keyVec[1]!.bytes())

  const valVec = entrySigned.val().vec()!
  expect(valVec[0]!.sym().toString()).toBe('Secp256r1')
  const fields = new Map(
    valVec[1]!
      .map()!
      .map((field) => [field.key().sym().toString(), new Uint8Array(field.val().bytes())]),
  )
  const authenticatorData = fields.get('authenticator_data')!
  const clientDataJson = fields.get('client_data_json')!
  const signature = fields.get('signature')!
  expect(signature.length).toBe(64)

  // Independent payload: OUR SDK computes the digest the contract verifies.
  const expectedPayload = payloadForAuthEntry(signed, Networks.TESTNET)

  // The kit module must have used exactly that payload as the WebAuthn challenge.
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJson))
  expect(clientData.type).toBe('webauthn.get')
  expect(clientData.challenge).toBe(toBase64Url(expectedPayload))

  // And the signature must verify against the virtual authenticator's real key.
  const { credentials: storedCredentials } = await client.send('WebAuthn.getCredentials', {
    authenticatorId: authenticator.authenticatorId,
  })
  // CDP reports credential ids in standard padded base64; compare raw bytes.
  const stored = storedCredentials.find((candidate) =>
    Buffer.from(candidate.credentialId, 'base64').equals(Buffer.from(credentialId)),
  )
  expect(stored, 'signing credential not found on the authenticator').toBeDefined()

  const privateKey = createPrivateKey({
    key: Buffer.from(stored!.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
  const jwk = privateKey.export({ format: 'jwk' })
  const publicKey = p256.getPublicKey(fromBase64Url(jwk.d as string), false)

  const digestPreimage = new Uint8Array(authenticatorData.length + 32)
  digestPreimage.set(authenticatorData)
  digestPreimage.set(sha256(clientDataJson), authenticatorData.length)

  expect(p256.verify(signature, sha256(digestPreimage), publicKey)).toBe(true)
})

test('signTransaction rejects a transaction with no entries for the wallet', async ({ page }) => {
  const client = await enableWebAuthn(page)
  await addVirtualAuthenticator(client)
  await page.goto('/')

  await page.evaluate(() => window.harness.connect())
  const error = await page.evaluate(
    (tx) =>
      window.harness.signTx(tx).then(
        () => 'no error',
        (e) => String(e?.message ?? e),
      ),
    REAL_FIXTURE_TXN,
  )
  expect(error).toContain('no Soroban authorization entries')
})

declare global {
  interface Window {
    harness: {
      connect(): Promise<string>
      signEntry(entryXdr: string): Promise<string>
      signTx(txXdr: string): Promise<string>
    }
  }
}
