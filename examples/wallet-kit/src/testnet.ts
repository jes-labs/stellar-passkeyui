// The bindings want Buffer instances; the buffer package serves the browser.
// biome-ignore lint/style/useNodejsImportProtocol: bundlers must resolve the browser package
import { Buffer } from 'buffer'
// The live-testnet side of the demo, framework-free. Everything runs in the
// browser: an ephemeral session account funded by friendbot pays the fees and
// deploys the wallet; the user's real passkey authorizes the payment; the
// contract's __check_auth verifies it on-chain. No server, no stored secrets —
// testnet XLM is free and the session key dies with the tab.
import {
  attachSignatureToEntry,
  deriveWalletAddress,
  passkeyKitSignatureScVal,
  payloadForAuthEntry,
  toBase64Url,
} from '@passkey-ui/core'
import type { SignWithPasskeyResult } from '@passkey-ui/core'
import {
  Address,
  Contract,
  Keypair,
  Networks,
  Operation,
  type Transaction,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { basicNodeSigner } from '@stellar/stellar-sdk/contract'
import { Client as PasskeyClient } from './passkey-kit-bindings.gen'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const NETWORK = Networks.TESTNET
// passkey-kit smart-wallet wasm, built unmodified from source and installed on
// testnet by this project (see e2e/testnet in the repo).
const WALLET_WASM_HASH = '8991e3262e6099e2a18acb3583af4d9d1da886403609e7170467df4337450dca'
const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

export const EXPLORER = 'https://stellar.expert/explorer/testnet'

const server = new rpc.Server(RPC_URL)

export interface Session {
  keypair: Keypair
  publicKey: string
}

// One session per page load; the same account deploys and pays for everything.
let sessionPromise: Promise<Session> | undefined

export function getSession(): Promise<Session> {
  if (!sessionPromise) sessionPromise = createSession()
  return sessionPromise
}

async function createSession(): Promise<Session> {
  const keypair = Keypair.random()
  const publicKey = keypair.publicKey()

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`)
      if (response.ok) return { keypair, publicKey }
    } catch {
      // retry below
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
  }
  throw new Error('Could not fund the session account via friendbot. Try reloading.')
}

export function walletAddressFor(session: Session, credentialId: Uint8Array): string {
  return deriveWalletAddress({
    deployer: session.publicKey,
    keyId: credentialId,
    networkPassphrase: NETWORK,
  })
}

export interface DeployResult {
  walletAddress: string
  deployHash: string
}

/**
 * Deploy the smart wallet for a passkey at its pre-derived address. Idempotent:
 * the address is deterministic, so if the wallet already exists (a previous
 * attempt landed after its poll window, or the user retried) this succeeds
 * immediately instead of failing with "contract already exists".
 */
export async function deployWallet(
  session: Session,
  credentialId: Uint8Array,
  publicKey: Uint8Array,
): Promise<DeployResult> {
  const walletAddress = walletAddressFor(session, credentialId)

  if (await contractExists(walletAddress)) return { walletAddress, deployHash: '' }

  const signer = basicNodeSigner(session.keypair, NETWORK)
  const deployTx = await PasskeyClient.deploy(
    {
      signer: {
        tag: 'Secp256r1',
        values: [
          bufferFrom(credentialId),
          bufferFrom(publicKey),
          [undefined],
          [undefined],
          { tag: 'Persistent', values: undefined },
        ],
      },
    },
    {
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK,
      wasmHash: WALLET_WASM_HASH,
      salt: hash(bufferFrom(credentialId)),
      publicKey: session.publicKey,
      signTransaction: signer.signTransaction,
      // The bindings default to a 100-stroop inclusion fee, which strands the
      // transaction in the queue whenever testnet is busy. Bid properly.
      fee: '1000000',
      timeoutInSeconds: 120,
    },
  )

  let deployHash = ''
  try {
    const sent = await deployTx.signAndSend()
    deployHash = sent.sendTransactionResponse?.hash ?? ''
  } catch (e) {
    // The library gives up polling after its window even when the transaction
    // is still pending. The contract-existence poll below is the real check.
    console.warn('deploy signAndSend did not confirm; polling for the contract', e)
  }

  for (let i = 0; i < 45; i++) {
    if (await contractExists(walletAddress)) return { walletAddress, deployHash }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(
    'The wallet deployment has not confirmed yet. Testnet may be congested; try again in a moment.',
  )
}

async function contractExists(contractId: string): Promise<boolean> {
  try {
    await server.getContractData(
      contractId,
      xdr.ScVal.scvLedgerKeyContractInstance(),
      rpc.Durability.Persistent,
    )
    return true
  } catch {
    return false
  }
}

/**
 * Send 100 XLM from the session account into the wallet. Idempotent: when a
 * previous attempt landed after its poll window (or the user retried), the
 * balance is already there and no second transfer is sent.
 */
export async function fundWallet(session: Session, walletAddress: string): Promise<string> {
  if ((await walletBalance(session, walletAddress)) >= 1_000_000_000n) return ''

  const tx = await buildTx(
    session,
    new Contract(NATIVE_SAC).call(
      'transfer',
      Address.fromString(session.publicKey).toScVal(),
      Address.fromString(walletAddress).toScVal(),
      nativeToScVal(1_000_000_000n, { type: 'i128' }),
    ),
  )
  return prepareSignSubmit(session, tx)
}

export interface PaymentResult {
  hash: string
  signatureHex: string
  signedEntryXdr: string
}

/**
 * Move 25 XLM out of the wallet, authorized by the passkey. The caller supplies
 * the ceremony: given the 32-byte payload, run WebAuthn and return the result.
 */
export async function sendPayment(
  session: Session,
  walletAddress: string,
  signPayload: (payload: Uint8Array) => Promise<SignWithPasskeyResult>,
): Promise<PaymentResult> {
  const transferOp = new Contract(NATIVE_SAC).call(
    'transfer',
    Address.fromString(walletAddress).toScVal(),
    Address.fromString(session.publicKey).toScVal(),
    nativeToScVal(250_000_000n, { type: 'i128' }),
  )

  const unsignedTx = await buildTx(session, transferOp)
  const sim = await server.simulateTransaction(unsignedTx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(`simulation failed: ${sim.error}`)
  const entry = sim.result?.auth?.[0]
  if (!entry) throw new Error('simulation returned no auth entry for the wallet')

  const latest = await server.getLatestLedger()
  entry
    .credentials()
    .address()
    .signatureExpirationLedger(latest.sequence + 100)

  const payload = payloadForAuthEntry(entry, NETWORK)
  const assertion = await signPayload(payload)

  // The challenge the authenticator signed must be this exact payload.
  const clientData = JSON.parse(new TextDecoder().decode(assertion.clientDataJSON))
  if (clientData.challenge !== toBase64Url(payload)) {
    throw new Error('the signed challenge does not match the authorization payload')
  }

  attachSignatureToEntry(
    entry,
    passkeyKitSignatureScVal({
      credentialId: assertion.credentialId,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
    }),
  )

  const invokeOp = unsignedTx.operations[0] as Operation.InvokeHostFunction
  const signedTx = await buildTx(
    session,
    Operation.invokeHostFunction({ func: invokeOp.func, auth: [entry] }),
  )
  const txHash = await prepareSignSubmit(session, signedTx)

  return {
    hash: txHash,
    signatureHex: toHex(assertion.signature),
    signedEntryXdr: entry.toXDR('base64'),
  }
}

async function walletBalance(session: Session, walletAddress: string): Promise<bigint> {
  try {
    const tx = await buildTx(
      session,
      new Contract(NATIVE_SAC).call('balance', Address.fromString(walletAddress).toScVal()),
    )
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) return 0n
    return scValToNative(sim.result.retval) as bigint
  } catch {
    return 0n
  }
}

async function buildTx(
  session: Session,
  operation: ReturnType<Contract['call']>,
): Promise<Transaction> {
  return new TransactionBuilder(await server.getAccount(session.publicKey), {
    fee: '10000000',
    networkPassphrase: NETWORK,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build()
}

async function prepareSignSubmit(session: Session, tx: Transaction): Promise<string> {
  const ready = (await server.prepareTransaction(tx)) as Transaction
  ready.sign(session.keypair)

  const sent = await server.sendTransaction(ready)
  if (sent.status === 'ERROR') {
    throw new Error(`submission rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`)
  }

  for (let i = 0; i < 90; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const got = await server.getTransaction(sent.hash)
    if (got.status === 'SUCCESS') return sent.hash
    if (got.status === 'FAILED') {
      throw new Error('the transaction failed on-chain')
    }
  }
  throw new Error('the transaction did not settle in time')
}

function bufferFrom(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
