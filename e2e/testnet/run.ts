// The on-chain proof: deploy a passkey-kit smart wallet on testnet, fund it,
// and move money out of it with a WebAuthn-shaped secp256r1 signature built by
// this repo's SDK — verified by the real contract's __check_auth, not by us.
//
// The "passkey" here is a software P-256 key standing in for an authenticator
// (the ceremony itself is browser-only); everything the contract checks —
// payload, challenge binding, signature, ScVal layout — is identical.
//
// Run: pnpm --filter @passkey-ui/e2e exec tsx testnet/run.ts

import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2'
import {
  attachSignatureToEntry,
  deriveWalletAddress,
  passkeyKitSignatureScVal,
  payloadForAuthEntry,
  rpcWalletStateReader,
  toBase64Url,
} from '@passkey-ui/core'
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
} from '@stellar/stellar-sdk'
import { basicNodeSigner } from '@stellar/stellar-sdk/contract'
import { Client as PasskeyClient } from './passkey-kit-bindings.gen'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const NETWORK = Networks.TESTNET
// The passkey-kit smart-wallet wasm, built from current source
// (kalepail/passkey-kit contracts/smart-wallet, unmodified) and installed on
// testnet by this project. The hash published in passkey-kit's .env.example
// (ecd990f0…) is an older build whose internals predate the current source.
const WALLET_WASM_HASH = '8991e3262e6099e2a18acb3583af4d9d1da886403609e7170467df4337450dca'
// Native XLM Stellar Asset Contract on testnet.
const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const EXPLORER = 'https://stellar.expert/explorer/testnet'

const server = new rpc.Server(RPC_URL)
const fee = Keypair.random()

const log = (label: string, value = '') => console.log(value ? `${label} ${value}` : label)

async function main() {
  // 1. A funded fee account: pays fees and acts as the wallet deployer.
  log('fee account:', fee.publicKey())
  await fundWithRetries(fee.publicKey())
  log('funded via friendbot')

  // 2. The "passkey": a P-256 key plus a credential id, exactly what an
  //    authenticator would mint.
  const passkeyPriv = p256.utils.randomSecretKey()
  const passkeyPub = p256.getPublicKey(passkeyPriv, false)
  const credentialId = crypto.getRandomValues(new Uint8Array(20))

  // 3. Our SDK predicts the wallet address offline...
  const predicted = deriveWalletAddress({
    deployer: fee.publicKey(),
    keyId: credentialId,
    networkPassphrase: NETWORK,
  })
  log('predicted wallet address:', predicted)

  // 4. ...and the factory deploy must land on exactly that address.
  const signer = basicNodeSigner(fee, NETWORK)
  const deployTx = await PasskeyClient.deploy(
    {
      signer: {
        tag: 'Secp256r1',
        values: [
          Buffer.from(credentialId),
          Buffer.from(passkeyPub),
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
      salt: hash(Buffer.from(credentialId)),
      publicKey: fee.publicKey(),
      signTransaction: signer.signTransaction,
      timeoutInSeconds: 60,
    },
  )
  const deployed = await deployTx.signAndSend()
  const walletAddress = deployed.result.options.contractId as string
  const deployHash = deployed.sendTransactionResponse?.hash ?? '(unknown)'
  log('deploy tx:', `${EXPLORER}/tx/${deployHash}`)
  log('wallet contract:', `${EXPLORER}/contract/${walletAddress}`)

  if (walletAddress !== predicted) {
    throw new Error(`address mismatch: predicted ${predicted}, deployed ${walletAddress}`)
  }
  log('address derivation matches on-chain deployment ✓')

  // The wallet-state reader must see what we just put on-chain.
  const reader = rpcWalletStateReader(server)
  if (!(await reader.contractExists(walletAddress)))
    throw new Error('state reader: contract missing')
  if (!(await reader.hasSecp256r1Signer(walletAddress, credentialId))) {
    throw new Error('state reader: signer not found')
  }
  log('wallet-state reader sees the contract and its signer ✓')

  // 5. Fund the wallet with 100 XLM through the native SAC.
  const fundTx = await buildTx(
    new Contract(NATIVE_SAC).call(
      'transfer',
      Address.fromString(fee.publicKey()).toScVal(),
      Address.fromString(walletAddress).toScVal(),
      nativeToScVal(1_000_000_000n, { type: 'i128' }),
    ),
  )
  const fundHash = await prepareSignSubmit(fundTx)
  log('fund tx:', `${EXPLORER}/tx/${fundHash}`)

  // 6. The proof: move 25 XLM OUT of the wallet, authorized by the passkey.
  const transferOp = new Contract(NATIVE_SAC).call(
    'transfer',
    Address.fromString(walletAddress).toScVal(),
    Address.fromString(fee.publicKey()).toScVal(),
    nativeToScVal(250_000_000n, { type: 'i128' }),
  )

  const unsignedTx = await buildTx(transferOp)
  const sim = await server.simulateTransaction(unsignedTx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(`simulation failed: ${sim.error}`)
  const entry = sim.result?.auth?.[0]
  if (!entry) throw new Error('simulation returned no auth entry for the wallet')

  const latest = await server.getLatestLedger()
  entry
    .credentials()
    .address()
    .signatureExpirationLedger(latest.sequence + 100)

  // The SDK computes the payload the contract verifies, and we sign it the way
  // an authenticator would: over authenticatorData || sha256(clientDataJSON),
  // with the payload as the challenge inside the client data.
  const payload = payloadForAuthEntry(entry, NETWORK)

  const authenticatorData = new Uint8Array(37)
  authenticatorData[32] = 0x05 // user present + verified

  const clientDataJSON = new TextEncoder().encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: toBase64Url(payload),
      origin: 'https://stellar-passkey-ui.testnet-harness',
      crossOrigin: false,
    }),
  )

  const digestPreimage = new Uint8Array(authenticatorData.length + 32)
  digestPreimage.set(authenticatorData)
  digestPreimage.set(sha256(clientDataJSON), authenticatorData.length)
  const signature = p256.sign(sha256(digestPreimage), passkeyPriv).normalizeS().toBytes('compact')

  attachSignatureToEntry(
    entry,
    passkeyKitSignatureScVal({ credentialId, authenticatorData, clientDataJSON, signature }),
  )

  // Rebuild with the signed entry; prepareTransaction re-simulates, which runs
  // the contract's __check_auth over our signature before we ever submit.
  const invokeOp = unsignedTx.operations[0] as Operation.InvokeHostFunction
  const signedTx = await buildTx(
    Operation.invokeHostFunction({ func: invokeOp.func, auth: [entry] }),
  )
  const payHash = await prepareSignSubmit(signedTx)
  log('passkey-signed payment tx:', `${EXPLORER}/tx/${payHash}`)
  log('')
  log('done — 25 XLM left the smart wallet, authorized by a secp256r1 WebAuthn signature.')
}

async function buildTx(operation: ReturnType<Contract['call']>): Promise<Transaction> {
  return new TransactionBuilder(await server.getAccount(fee.publicKey()), {
    fee: '10000000',
    networkPassphrase: NETWORK,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build()
}

async function prepareSignSubmit(tx: Transaction): Promise<string> {
  const ready = (await server.prepareTransaction(tx)) as Transaction
  ready.sign(fee)

  const sent = await server.sendTransaction(ready)
  if (sent.status === 'ERROR') {
    throw new Error(`submit rejected: ${JSON.stringify(sent.errorResult ?? sent)}`)
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const got = await server.getTransaction(sent.hash)
    if (got.status === 'SUCCESS') return sent.hash
    if (got.status === 'FAILED') {
      throw new Error(`tx failed: ${got.resultXdr?.toXDR('base64') ?? 'no result xdr'}`)
    }
  }
  throw new Error(`tx ${sent.hash} did not settle in time`)
}

// Friendbot occasionally drops connections; retry, and accept any outcome that
// leaves the account existing on the network.
async function fundWithRetries(account: string): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${account}`)
      if (response.ok) return
    } catch {
      // fall through to the existence check / retry
    }
    try {
      await server.getAccount(account)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }
  }
  throw new Error('friendbot funding failed after retries')
}

main().catch((e) => {
  console.error('FAILED:', e?.message ?? e)
  process.exit(1)
})
