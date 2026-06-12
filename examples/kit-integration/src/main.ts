// The README snippet, running for real: the passkey module registered in the
// actual Stellar Wallets Kit next to Freighter, Albedo, xBull, and Lobstr —
// connected from the kit's own modal, signing through the kit's facade.
import { Networks, StellarWalletsKit, SwkAppDarkTheme } from '@creit.tech/stellar-wallets-kit'
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo'
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter'
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr'
import { PASSKEY_ID, PasskeyModule } from '@creit.tech/stellar-wallets-kit/modules/passkey'
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull'
import { Address, xdr } from '@stellar/stellar-base'

// A fixed demo factory account so derived wallet addresses are stable.
const DEPLOYER = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'
const EXPIRATION_LEDGER = 4_000_000

StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [
    new PasskeyModule({
      networkPassphrase: Networks.TESTNET,
      rpName: 'Stellar Passkey Demo',
      deployer: DEPLOYER,
    }),
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
    new LobstrModule(),
  ],
})
StellarWalletsKit.setTheme(SwkAppDarkTheme)

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing #${id}`)
  return node as T
}

const hero = el('hero')
const wallet = el('wallet')
const heroError = el('hero-error')
const addressEl = el('address')
const nonceEl = el('nonce')
const signStatus = el('sign-status')
const signError = el('sign-error')
const receipt = el('receipt')
const signatureEl = el('signature')
const signedXdrEl = el('signed-xdr')

// Each session signs a fresh nonce, like a real transaction would.
const nonce = randomNonce()
nonceEl.textContent = nonce.toString()

let connectedAddress: string | undefined

function showWallet(address: string): void {
  connectedAddress = address
  addressEl.textContent = address
  hero.hidden = true
  wallet.hidden = false
}

function resetToHero(): void {
  connectedAddress = undefined
  wallet.hidden = true
  receipt.hidden = true
  signError.hidden = true
  hero.hidden = false
}

el('connect').addEventListener('click', () => {
  heroError.hidden = true
  StellarWalletsKit.authModal()
    .then(({ address }) => showWallet(address))
    .catch((e: unknown) => {
      // Closing the modal without picking a wallet rejects; stay quiet on that.
      const message = errorMessage(e)
      if (!/closed/i.test(message)) {
        heroError.textContent = message
        heroError.hidden = false
      }
    })
})

el('copy').addEventListener('click', () => {
  if (!connectedAddress) return
  void navigator.clipboard.writeText(connectedAddress).then(() => {
    el('copy').textContent = 'Copied'
    setTimeout(() => {
      el('copy').textContent = 'Copy address'
    }, 1600)
  })
})

el('disconnect').addEventListener('click', () => {
  void StellarWalletsKit.disconnect().finally(resetToHero)
})

el('sign').addEventListener('click', () => {
  if (!connectedAddress) return
  signError.hidden = true
  receipt.hidden = true
  signStatus.textContent = 'Waiting for your wallet…'
  signStatus.hidden = false

  const entryXdr = buildAuthEntry(connectedAddress, nonce)
  StellarWalletsKit.signAuthEntry(entryXdr, { networkPassphrase: Networks.TESTNET })
    .then(({ signedAuthEntry }) => {
      signStatus.hidden = true
      signatureEl.textContent = extractSignatureHex(signedAuthEntry) ?? '(see XDR below)'
      signedXdrEl.textContent = signedAuthEntry
      receipt.hidden = false
    })
    .catch((e: unknown) => {
      signStatus.hidden = true
      signError.textContent = errorMessage(e)
      signError.hidden = false
    })
})

/** A realistic Soroban authorization entry: the wallet authorizes transfer(). */
function buildAuthEntry(walletAddress: string, entryNonce: bigint): string {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(walletAddress).toScAddress(),
        functionName: 'transfer',
        args: [],
      }),
    ),
    subInvocations: [],
  })

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(walletAddress).toScAddress(),
        nonce: new xdr.Int64(entryNonce),
        signatureExpirationLedger: EXPIRATION_LEDGER,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  }).toXDR('base64')
}

/** Pull the 64-byte compact signature out of the signed entry's ScVal, when present. */
function extractSignatureHex(signedEntryXdr: string): string | undefined {
  try {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signedEntryXdr, 'base64')
    // Signatures is Vec-wrapped (tuple struct), then Map, then the enum payload.
    const fields = entry
      .credentials()
      .address()
      .signature()
      .vec()?.[0]
      ?.map()?.[0]
      ?.val()
      .vec()?.[1]
      ?.map()
    const signature = fields?.find((field) => field.key().sym().toString() === 'signature')
    if (!signature) return undefined
    const bytes = new Uint8Array(signature.val().bytes())
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined
  }
}

function randomNonce(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  bytes[0] = (bytes[0] ?? 0) & 0x3f // keep it positive and inside Int64
  return Array.from(bytes).reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as Error).message)
  return String(e)
}

// Deterministic hooks for the end-to-end suite: the same calls a dapp makes,
// minus the modal click.
declare global {
  interface Window {
    harness: {
      connect(): Promise<string>
      signEntry(entryXdr: string): Promise<string>
      signTx(txXdr: string): Promise<string>
    }
  }
}

window.harness = {
  async connect() {
    StellarWalletsKit.setWallet(PASSKEY_ID)
    const { address } = await StellarWalletsKit.fetchAddress()
    showWallet(address)
    return address
  },
  async signEntry(entryXdr: string) {
    const { signedAuthEntry } = await StellarWalletsKit.signAuthEntry(entryXdr, {
      networkPassphrase: Networks.TESTNET,
    })
    return signedAuthEntry
  },
  async signTx(txXdr: string) {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(txXdr, {
      networkPassphrase: Networks.TESTNET,
    })
    return signedTxXdr
  },
}
