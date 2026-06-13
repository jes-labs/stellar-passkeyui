// The chain-setup state machine, outside React on purpose. React renders this
// store; it never drives the network. That makes the flow immune to double
// effects (StrictMode runs effects twice in dev), remounts, and re-renders:
// no matter how many times the UI asks, there is exactly one setup in flight,
// and every stage is idempotent against actual chain state.
import { createStore } from '@passkey-ui/ui'
import {
  type Session,
  contractExists,
  deployWallet,
  fundWallet,
  getSession,
  walletAddressFor,
} from './testnet'

/**
 * Who the wallet belongs to. A freshly created passkey carries its public key
 * (needed to deploy); a reconnected one does not, and never needs it — its
 * wallet already exists on-chain.
 */
export interface WalletIdentity {
  credentialId: Uint8Array
  credentialIdBase64Url: string
  publicKey?: Uint8Array | undefined
}

export type ChainPhase = 'idle' | 'session' | 'deploying' | 'funding' | 'ready' | 'error'

export interface ChainSetupState {
  phase: ChainPhase
  address?: string | undefined
  session?: Session | undefined
  deployHash?: string | undefined
  fundHash?: string | undefined
  error?: string | undefined
}

export const chainStore = createStore<ChainSetupState>({ phase: 'idle' })

let inFlight: Promise<void> | undefined

/**
 * Bring the credential's wallet on-chain. Single-flight: concurrent calls join
 * the run already in progress, and a completed setup is never repeated. Safe to
 * call from anywhere, any number of times — including as a retry after an
 * error, where the idempotent stages skip whatever already happened on-chain.
 */
export function startChainSetup(identity: WalletIdentity): void {
  if (inFlight || chainStore.getState().phase === 'ready') return
  inFlight = run(identity).finally(() => {
    inFlight = undefined
  })
}

async function run(identity: WalletIdentity): Promise<void> {
  const patch = (next: Partial<ChainSetupState>) =>
    chainStore.setState({ ...chainStore.getState(), ...next })

  try {
    patch({ phase: 'session', error: undefined })
    const session = await getSession()
    const address = walletAddressFor(session, identity.credentialId)

    patch({ phase: 'deploying', session, address })
    let deployHash = ''
    if (await contractExists(address)) {
      // Reconnect, or a previous deploy that landed: nothing to do.
    } else if (identity.publicKey) {
      deployHash = (await deployWallet(session, identity.credentialId, identity.publicKey))
        .deployHash
    } else {
      throw new Error(
        'No wallet exists for this passkey on this browser. Create a new wallet instead.',
      )
    }
    // Idempotent stages return an empty hash when the work already happened;
    // never let that erase a link we showed the user.
    patch({ phase: 'funding', ...(deployHash ? { deployHash } : {}) })

    const fundHash = await fundWallet(session, address)
    patch({ phase: 'ready', ...(fundHash ? { fundHash } : {}) })
  } catch (e) {
    console.error('chain setup failed:', e)
    patch({ phase: 'error', error: friendlyError(e) })
  }
}

// Host errors arrive as multi-line diagnostic dumps; show one readable line and
// leave the full detail in the console.
function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  const firstLine = raw.split('\n')[0] ?? raw
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine
}
