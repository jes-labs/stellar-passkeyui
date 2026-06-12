import {
  type Capabilities,
  type CreatePasskeyResult,
  type SignWithPasskeyResult,
  bytesToHex,
  createPasskey,
  deriveWalletAddress,
  detectCapabilities,
  selectFallbacks,
  signWithPasskey,
} from '@passkey-ui/core'
import { type Flow, createCreatePasskeyFlow, createSignFlow } from '@passkey-ui/ui'
import { CreatePasskey, SignTransaction, useFlow } from '@passkey-ui/ui/react'
import { PasskeyModule } from '@passkey-ui/wallet-kit'
import { Networks } from '@stellar/stellar-sdk'
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { chainStore, startChainSetup } from './chain-setup'
import { recordCreate, recordSign } from './test-hook'
import { EXPLORER, type PaymentResult, type Session, sendPayment } from './testnet'

const NETWORK = Networks.TESTNET

// Live testnet is the default. ?mode=offline keeps everything client-side with
// no network calls — the end-to-end suite runs against that path.
const OFFLINE = new URLSearchParams(window.location.search).get('mode') === 'offline'

// In offline mode the deployer is fixed so the derived address is stable.
const OFFLINE_DEPLOYER = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'

// Component theme tokens, matched to the Aurum palette in app.css.
const AURUM_THEME = {
  foreground: '#f2efe8',
  muted: '#a39e92',
  accent: '#c9a961',
  accentForeground: '#15110a',
  advisory: '#d9a05b',
  blocker: '#d4766a',
  radius: '999px',
  fontFamily: "'Archivo', system-ui, sans-serif",
}

const createInput = {
  rp: { name: 'Aurum' },
  user: {
    id: new TextEncoder().encode('aurum-demo-user'),
    name: 'you@aurum',
    displayName: 'Aurum Demo',
  },
}

// Offline mode signs this stand-in payload instead of a live auth entry.
const DEMO_PAYLOAD = new Uint8Array(32).map((_, i) => (i * 7 + 3) % 256)

export function App() {
  const createFlow = useMemo(
    () =>
      createCreatePasskeyFlow({
        detectCapabilities,
        selectFallbacks,
        createPasskey: async (input) => {
          const result = await createPasskey(input)
          recordCreate(result)
          // Kick the chain machine the moment the credential exists — outside
          // React, so renders and StrictMode double-effects cannot race it.
          if (!OFFLINE) startChainSetup(result)
          return result
        },
        input: createInput,
      }),
    [],
  )
  const { state } = useFlow(createFlow, { autoStart: true })
  const wallet = state.phase === 'success' ? state.result : undefined

  return (
    <div className="app">
      <header className="masthead">
        <span className="masthead__brand">
          <KeyMark />
          Aurum
        </span>
        <span className="masthead__meta">
          {OFFLINE ? 'Reference demo · offline mode' : 'Live on Stellar testnet'}
        </span>
      </header>

      <main className="stage">
        {wallet ? <WalletView credential={wallet} /> : <Onboard flow={createFlow} />}
      </main>

      <footer className="colophon">
        <p>
          Built on <code>@passkey-ui/core</code>, <code>@passkey-ui/ui</code>, and{' '}
          <code>@passkey-ui/wallet-kit</code>.{' '}
          {OFFLINE
            ? 'Offline mode: the passkey and signature are real; nothing touches the network.'
            : 'Everything here is real: the passkey, the smart-wallet contract, and the payment all run on Stellar testnet. Fees are paid by a throwaway session account funded by friendbot.'}
        </p>
      </footer>
    </div>
  )
}

function Onboard({ flow }: { flow: Flow<CreatePasskeyResult> }) {
  return (
    <section className="onboard">
      <div className="orb" aria-hidden="true">
        <div className="orb__core" />
        <div className="orb__ring" />
      </div>

      <p className="kicker reveal" style={{ animationDelay: '80ms' }}>
        Soroban smart account
      </p>
      <h1 className="display reveal" style={{ animationDelay: '160ms' }}>
        A wallet with
        <br />
        <em>no seed phrase.</em>
      </h1>
      <p className="lede reveal" style={{ animationDelay: '260ms' }}>
        Your fingerprint is the key. It is forged in your device's secure element, never leaves it,
        and the Stellar network verifies every signature on-chain.
      </p>

      <div className="onboard__action reveal" style={{ animationDelay: '360ms' }}>
        <CreatePasskey flow={flow} theme={AURUM_THEME} renderSuccess={() => null} />
      </div>

      <DeviceStrip />
    </section>
  )
}

// ---- live-chain view --------------------------------------------------------
// Orchestration lives in chain-setup.ts, outside React; these components only
// render its store and forward the retry click.

function WalletView({ credential }: { credential: CreatePasskeyResult }) {
  return OFFLINE ? (
    <OfflineWallet credential={credential} />
  ) : (
    <LiveWallet credential={credential} />
  )
}

function LiveWallet({ credential }: { credential: CreatePasskeyResult }) {
  const chain = useSyncExternalStore(chainStore.subscribe, chainStore.getState)

  return (
    <section className="wallet enter">
      <WalletCard
        address={chain.address}
        pill="Testnet · live"
        explorer={chain.address ? `${EXPLORER}/contract/${chain.address}` : undefined}
      />

      <div className="panel">
        <h2 className="panel__title">Going on-chain</h2>
        <ol className="steps">
          <ChainStep
            done={chain.phase !== 'session'}
            active={chain.phase === 'session'}
            label="Fund a throwaway session account (friendbot)"
          />
          <ChainStep
            done={['funding', 'ready'].includes(chain.phase)}
            active={chain.phase === 'deploying'}
            label="Deploy your smart wallet at its pre-derived address"
            link={chain.deployHash ? `${EXPLORER}/tx/${chain.deployHash}` : undefined}
          />
          <ChainStep
            done={chain.phase === 'ready'}
            active={chain.phase === 'funding'}
            label="Fund the wallet with 100 XLM"
            link={chain.fundHash ? `${EXPLORER}/tx/${chain.fundHash}` : undefined}
          />
        </ol>
        {chain.phase === 'error' && (
          <div className="chain-error">
            <p className="error">{chain.error}</p>
            <button type="button" className="ghost" onClick={() => startChainSetup(credential)}>
              Try again
            </button>
          </div>
        )}
      </div>

      {chain.phase === 'ready' && chain.address && chain.session && (
        <LiveSendPanel credential={credential} address={chain.address} session={chain.session} />
      )}

      <ProofDrawer credential={credential} />
      <ModuleDrawer />
    </section>
  )
}

function LiveSendPanel({
  credential,
  address,
  session,
}: {
  credential: CreatePasskeyResult
  address: string
  session: Session
}) {
  const flow = useMemo(
    () =>
      createSignFlow<PaymentResult>({
        detectCapabilities,
        selectFallbacks,
        sign: () =>
          sendPayment(session, address, async (payload) => {
            const assertion = await signWithPasskey({
              challenge: payload,
              allowCredentials: [credential.credentialId],
            })
            recordSign(assertion)
            return assertion
          }),
      }),
    [credential, address, session],
  )

  return (
    <div className="panel">
      <h2 className="panel__title">Send a payment</h2>
      <p className="panel__hint">
        25 XLM, out of your smart wallet, signed with your passkey and verified by the contract
        on-chain.
      </p>
      <dl className="ledger">
        <div className="ledger__row">
          <dt>To</dt>
          <dd className="mono">{truncate(session.publicKey)}</dd>
        </div>
        <div className="ledger__row">
          <dt>Amount</dt>
          <dd className="mono">25.0000 XLM</dd>
        </div>
        <div className="ledger__row">
          <dt>Network</dt>
          <dd>Stellar testnet</dd>
        </div>
      </dl>

      <SignTransaction
        flow={flow}
        theme={AURUM_THEME}
        autoStart={false}
        labels={{ prompting: 'Confirm with your passkey, then we submit on-chain…' }}
        renderSuccess={(result) => <LiveReceipt result={result} />}
      />
    </div>
  )
}

function LiveReceipt({ result }: { result: PaymentResult }) {
  return (
    <div className="receipt">
      <div className="receipt__stamp">On-chain</div>
      <p className="receipt__line">
        The contract re-derived this payload and verified your passkey's secp256r1 signature with
        native cryptography. This is a real transaction:
      </p>
      <p className="receipt__link">
        <a href={`${EXPLORER}/tx/${result.hash}`} target="_blank" rel="noreferrer">
          View it on stellar.expert ↗
        </a>
      </p>
      <div className="field">
        <span className="field__label">Signature (64-byte compact)</span>
        <code className="field__value" data-field="signature">
          {result.signatureHex}
        </code>
      </div>
      <details className="drawer">
        <summary>Signed authorization entry (XDR)</summary>
        <div className="drawer__body">
          <code className="field__value">{result.signedEntryXdr}</code>
        </div>
      </details>
    </div>
  )
}

// ---- offline mode (the hermetic path the e2e suite drives) ------------------

function OfflineWallet({ credential }: { credential: CreatePasskeyResult }) {
  const address = useMemo(
    () =>
      deriveWalletAddress({
        deployer: OFFLINE_DEPLOYER,
        keyId: credential.credentialId,
        networkPassphrase: NETWORK,
      }),
    [credential],
  )

  return (
    <section className="wallet enter">
      <WalletCard address={address} pill="Testnet" />
      <OfflineSendPanel credential={credential} />
      <ProofDrawer credential={credential} />
      <ModuleDrawer />
    </section>
  )
}

function OfflineSendPanel({ credential }: { credential: CreatePasskeyResult }) {
  const flow = useMemo(
    () =>
      createSignFlow({
        detectCapabilities,
        selectFallbacks,
        sign: async () => {
          const result = await signWithPasskey({
            challenge: DEMO_PAYLOAD,
            allowCredentials: [credential.credentialId],
          })
          recordSign(result)
          return result
        },
      }),
    [credential],
  )

  return (
    <div className="panel">
      <h2 className="panel__title">Send a payment</h2>
      <dl className="ledger">
        <div className="ledger__row">
          <dt>To</dt>
          <dd className="mono">{truncate(OFFLINE_DEPLOYER)}</dd>
        </div>
        <div className="ledger__row">
          <dt>Amount</dt>
          <dd className="mono">25.0000 XLM</dd>
        </div>
        <div className="ledger__row">
          <dt>Memo</dt>
          <dd>aurum demo payment</dd>
        </div>
      </dl>

      <SignTransaction
        flow={flow}
        theme={AURUM_THEME}
        autoStart={false}
        renderSuccess={(result) => <OfflineReceipt result={result} />}
      />
    </div>
  )
}

function OfflineReceipt({ result }: { result: SignWithPasskeyResult }) {
  return (
    <div className="receipt">
      <div className="receipt__stamp">Signed</div>
      <p className="receipt__line">
        Authorized with your passkey. The contract re-derives this exact digest on-chain and
        verifies the signature with native secp256r1.
      </p>
      <div className="field">
        <span className="field__label">Signature (64-byte compact)</span>
        <code className="field__value" data-field="signature">
          {bytesToHex(result.signature)}
        </code>
      </div>
    </div>
  )
}

// ---- shared pieces -----------------------------------------------------------

function WalletCard({
  address,
  pill,
  explorer,
}: {
  address?: string | undefined
  pill: string
  explorer?: string | undefined
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="wallet-card">
      <div className="wallet-card__head">
        <span className="wallet-card__title">
          <KeyMark /> Smart wallet
        </span>
        <span className="pill">{pill}</span>
      </div>
      <div className="field">
        <span className="field__label">Smart-wallet address</span>
        <code className="field__value field__value--address" data-field="address">
          {address ?? 'deriving…'}
        </code>
      </div>
      <div className="wallet-card__actions">
        <button
          type="button"
          className="copy"
          disabled={!address}
          onClick={() => {
            if (!address) return
            void navigator.clipboard.writeText(address).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy address'}
        </button>
        {explorer && (
          <a className="copy copy--link" href={explorer} target="_blank" rel="noreferrer">
            View on explorer ↗
          </a>
        )}
      </div>
    </div>
  )
}

function ChainStep({
  done,
  active,
  label,
  link,
}: {
  done: boolean
  active: boolean
  label: string
  link?: string | undefined
}) {
  return (
    <li className={`step ${done ? 'step--done' : ''} ${active ? 'step--active' : ''}`}>
      <span className="step__marker" aria-hidden="true" />
      <span className="step__label">
        {label}
        {link && (
          <>
            {' '}
            <a href={link} target="_blank" rel="noreferrer" className="step__link">
              tx ↗
            </a>
          </>
        )}
      </span>
    </li>
  )
}

function ProofDrawer({ credential }: { credential: CreatePasskeyResult }) {
  return (
    <details className="drawer">
      <summary>Technical proof</summary>
      <div className="drawer__body">
        <p className="drawer__note">
          The raw material of the wallet: the credential your device minted, and the P-256 public
          key the smart-wallet contract verifies signatures against.
        </p>
        <div className="field">
          <span className="field__label">Credential ID</span>
          <code className="field__value" data-field="credential-id">
            {credential.credentialIdBase64Url}
          </code>
        </div>
        <div className="field">
          <span className="field__label">Public key (65-byte P-256)</span>
          <code className="field__value" data-field="public-key">
            {bytesToHex(credential.publicKey)}
          </code>
        </div>
      </div>
    </details>
  )
}

const REGISTER_SNIPPET = `import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { PasskeyModule } from '@passkey-ui/wallet-kit'

StellarWalletsKit.init({
  network,
  modules: [
    new PasskeyModule({ network, networkPassphrase, getWalletAddress }),
    // ...the kit's other modules
  ],
})`

function ModuleDrawer() {
  const module = useMemo(
    () =>
      new PasskeyModule({
        network: 'TESTNET',
        networkPassphrase: NETWORK,
        getWalletAddress: () => null,
      }),
    [],
  )

  return (
    <details className="drawer">
      <summary>For wallet teams</summary>
      <div className="drawer__body">
        <p className="drawer__note">
          This whole experience is a Stellar Wallets Kit module. Register it next to the kit's other
          wallets:
        </p>
        <div className="module-badge">
          <img src={module.productIcon} alt="" width={26} height={26} />
          <span>
            <strong>{module.productName}</strong>
            <span className="module-badge__meta"> · {module.productId}</span>
          </span>
        </div>
        <HighlightedCode code={REGISTER_SNIPPET} />
      </div>
    </details>
  )
}

function DeviceStrip() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  useEffect(() => {
    void detectCapabilities().then(setCapabilities)
  }, [])

  if (!capabilities) return <div className="device reveal" style={{ animationDelay: '460ms' }} />

  const notices = selectFallbacks(capabilities)
  const lights: Array<[string, boolean]> = [
    ['WebAuthn', capabilities.webauthnAvailable],
    ['Secure context', capabilities.secureContext],
    ['Platform authenticator', capabilities.platformAuthenticator],
    ['Autofill', capabilities.conditionalMediation],
  ]

  return (
    <div className="device reveal" style={{ animationDelay: '460ms' }}>
      <ul className="device__lights">
        {lights.map(([label, ok]) => (
          <li key={label} className={`light ${ok ? 'light--on' : ''}`}>
            {label}
          </li>
        ))}
        <li className="light light--meta">
          {(capabilities.brand ?? capabilities.browser).toLowerCase()} · {capabilities.engine}
        </li>
      </ul>
      {notices.length > 0 && (
        <ul className="device__notices">
          {notices.map((notice) => (
            <li key={notice.id}>{notice.reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// A 20-line highlighter is all the snippet needs; no syntax library required.
// Order matters: comments win over strings win over keywords over type names.
const TOKEN_PATTERN = /(\/\/.*$)|('[^']*')|\b(import|from|new)\b|\b([A-Z][A-Za-z0-9]*)\b/gm

function HighlightedCode({ code }: { code: string }) {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(code.slice(cursor, index))

    const [text, comment, string, keyword] = match
    const className = comment
      ? 'tok-comment'
      : string
        ? 'tok-string'
        : keyword
          ? 'tok-keyword'
          : 'tok-type'
    nodes.push(
      <span key={index} className={className}>
        {text}
      </span>,
    )
    cursor = index + text.length
  }
  if (cursor < code.length) nodes.push(code.slice(cursor))

  return (
    <pre className="code">
      <code>{nodes}</code>
    </pre>
  )
}

function KeyMark() {
  return (
    <svg className="keymark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 11.5V20l2-1.8L13 20v-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function truncate(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
