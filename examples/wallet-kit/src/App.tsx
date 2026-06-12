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
import { useEffect, useMemo, useState } from 'react'
import { recordCreate, recordSign } from './test-hook'

const NETWORK = Networks.TESTNET
// A fixed demo "factory" account, so the derived wallet address is stable.
const DEPLOYER = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'

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

// Stands in for the Soroban authorization payload of the demo payment.
const DEMO_PAYLOAD = new Uint8Array(32).map((_, i) => (i * 7 + 3) % 256)

const REGISTER_SNIPPET = `import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { PasskeyModule } from '@passkey-ui/wallet-kit'

StellarWalletsKit.init({
  network,
  modules: [
    new PasskeyModule({ network, networkPassphrase, getWalletAddress }),
    // ...the kit's other modules
  ],
})`

export function App() {
  const createFlow = useMemo(
    () =>
      createCreatePasskeyFlow({
        detectCapabilities,
        selectFallbacks,
        createPasskey: async (input) => {
          const result = await createPasskey(input)
          recordCreate(result)
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
        <span className="masthead__meta">Reference demo · Stellar testnet</span>
      </header>

      <main className="stage">
        {wallet ? <WalletView credential={wallet} /> : <Onboard flow={createFlow} />}
      </main>

      <footer className="colophon">
        <p>
          Built on <code>@passkey-ui/core</code>, <code>@passkey-ui/ui</code>, and{' '}
          <code>@passkey-ui/wallet-kit</code>. Signing is real and runs on your device; on-chain
          deploy and submission are wired through the contract bindings and Launchtube per
          deployment.
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

function WalletView({ credential }: { credential: CreatePasskeyResult }) {
  const address = useMemo(
    () =>
      deriveWalletAddress({
        deployer: DEPLOYER,
        keyId: credential.credentialId,
        networkPassphrase: NETWORK,
      }),
    [credential],
  )

  return (
    <section className="wallet enter">
      <div className="wallet-card">
        <div className="wallet-card__head">
          <span className="wallet-card__title">
            <KeyMark /> Smart wallet
          </span>
          <span className="pill">Testnet</span>
        </div>
        <div className="field">
          <span className="field__label">Smart-wallet address</span>
          <code className="field__value field__value--address" data-field="address">
            {address}
          </code>
        </div>
        <CopyButton value={address} />
      </div>

      <SendPanel credential={credential} />

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

      <details className="drawer">
        <summary>For wallet teams</summary>
        <div className="drawer__body">
          <p className="drawer__note">
            This whole experience is a Stellar Wallets Kit module. Register it next to the kit's
            other wallets:
          </p>
          <ModuleBadge />
          <pre className="code">{REGISTER_SNIPPET}</pre>
        </div>
      </details>
    </section>
  )
}

function SendPanel({ credential }: { credential: CreatePasskeyResult }) {
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
          <dd className="mono">{truncate(DEPLOYER)}</dd>
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
        renderSuccess={(result) => <Receipt result={result} />}
      />
    </div>
  )
}

function Receipt({ result }: { result: SignWithPasskeyResult }) {
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
          {capabilities.browser} · {capabilities.engine}
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

function ModuleBadge() {
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
    <div className="module-badge">
      <img src={module.productIcon} alt="" width={26} height={26} />
      <span>
        <strong>{module.productName}</strong>
        <span className="module-badge__meta"> · {module.productId}</span>
      </span>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="copy"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? 'Copied' : 'Copy address'}
    </button>
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
