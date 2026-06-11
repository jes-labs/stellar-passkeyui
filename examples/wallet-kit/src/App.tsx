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
import { createCreatePasskeyFlow, createSignFlow } from '@passkey-ui/ui'
import { CreatePasskey, SignTransaction, useFlow } from '@passkey-ui/ui/react'
import { PasskeyModule } from '@passkey-ui/wallet-kit'
import { Networks } from '@stellar/stellar-sdk'
import { useEffect, useMemo, useState } from 'react'

const NETWORK = Networks.TESTNET
// A fixed demo "factory" account, so the derived wallet address is stable.
const DEPLOYER = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'

// The library defaults to a light theme; override the tokens for this dark demo.
const DARK_THEME = {
  foreground: '#e7e9ee',
  muted: '#9aa3b2',
  accent: '#6d8bff',
  accentForeground: '#0b0d12',
  advisory: '#f0c987',
  blocker: '#f87171',
}

const createInput = {
  rp: { name: 'Stellar Passkey Demo' },
  user: {
    id: new TextEncoder().encode('demo-user'),
    name: 'demo@stellar',
    displayName: 'Demo User',
  },
}

// Stands in for a Soroban authorization payload to sign.
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
        createPasskey,
        input: createInput,
      }),
    [],
  )
  const { state } = useFlow(createFlow, { autoStart: true })

  return (
    <main className="page">
      <header className="page__header">
        <h1 className="page__title">Stellar Passkey UI</h1>
        <p className="page__sub">
          A reference integration — passkey smart wallets for Stellar, packaged as a Stellar Wallets
          Kit module.
        </p>
        <p className="banner">
          Passkey creation, address derivation, and signing all run in your browser. On-chain deploy
          and submission are wired through the contract bindings and Launchtube per deployment.
        </p>
      </header>

      <div className="grid">
        <CapabilitiesCard />

        <section className="card">
          <h2 className="card__title">Create a passkey wallet</h2>
          <p className="card__hint">
            Runs a real WebAuthn ceremony and derives the deterministic smart-wallet address.
          </p>
          <CreatePasskey
            flow={createFlow}
            theme={DARK_THEME}
            renderSuccess={(result) => <WalletResult result={result} />}
          />
        </section>

        {state.phase === 'success' && state.result && <SignCard credential={state.result} />}

        <ModuleCard />
      </div>

      <footer className="page__footer">
        Built on @passkey-ui/core, @passkey-ui/ui, and @passkey-ui/wallet-kit.
      </footer>
    </main>
  )
}

function CapabilitiesCard() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  useEffect(() => {
    void detectCapabilities().then(setCapabilities)
  }, [])

  if (!capabilities)
    return (
      <section className="card">
        <h2 className="card__title">Your device</h2>
        <p className="muted">Checking…</p>
      </section>
    )

  const notices = selectFallbacks(capabilities)

  return (
    <section className="card">
      <h2 className="card__title">Your device</h2>
      <ul className="badges">
        <Badge ok={capabilities.webauthnAvailable} label="WebAuthn" />
        <Badge ok={capabilities.secureContext} label="Secure context" />
        <Badge ok={capabilities.platformAuthenticator} label="Platform authenticator" />
        <Badge ok={capabilities.conditionalMediation} label="Autofill" />
      </ul>
      <p className="muted">
        {capabilities.browser} · {capabilities.engine}
      </p>
      {notices.length > 0 && (
        <ul className="notices">
          {notices.map((notice) => (
            <li key={notice.id} className="notice">
              {notice.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SignCard({ credential }: { credential: CreatePasskeyResult }) {
  const flow = useMemo(
    () =>
      createSignFlow({
        detectCapabilities,
        selectFallbacks,
        sign: () =>
          signWithPasskey({
            challenge: DEMO_PAYLOAD,
            allowCredentials: [credential.credentialId],
          }),
      }),
    [credential],
  )

  return (
    <section className="card">
      <h2 className="card__title">Sign a transaction</h2>
      <p className="card__hint">
        Signs a demo payload with your passkey and produces the contract-ready signature.
      </p>
      <SignTransaction
        flow={flow}
        theme={DARK_THEME}
        autoStart={false}
        renderSuccess={(result) => <SignResult result={result} />}
      />
    </section>
  )
}

function ModuleCard() {
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
    <section className="card">
      <h2 className="card__title">Stellar Wallets Kit module</h2>
      <div className="module-head">
        <img src={module.productIcon} alt="" width={28} height={28} />
        <div>
          <strong>{module.productName}</strong>
          <span className="muted"> · {module.moduleType}</span>
        </div>
      </div>
      <p className="card__hint">Register it alongside the kit's other modules:</p>
      <pre className="code">{REGISTER_SNIPPET}</pre>
    </section>
  )
}

function WalletResult({ result }: { result: CreatePasskeyResult }) {
  const address = useMemo(
    () =>
      deriveWalletAddress({
        deployer: DEPLOYER,
        keyId: result.credentialId,
        networkPassphrase: NETWORK,
      }),
    [result],
  )

  return (
    <div className="result">
      <Field label="Smart-wallet address" value={address} />
      <Field label="Credential ID" value={result.credentialIdBase64Url} />
      <Field label="Public key" value={bytesToHex(result.publicKey)} truncate />
    </div>
  )
}

function SignResult({ result }: { result: SignWithPasskeyResult }) {
  return (
    <div className="result">
      <Field label="Signature (64-byte compact)" value={bytesToHex(result.signature)} truncate />
    </div>
  )
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return <li className={`badge ${ok ? 'badge--ok' : 'badge--no'}`}>{label}</li>
}

function Field({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <code className={`field__value${truncate ? ' field__value--truncate' : ''}`}>{value}</code>
    </div>
  )
}
