// Consumer-grade smoke test: import each package the way an installer would
// (via its dist entry points) and exercise the API surface for real. Run with
// `node scripts/dist-smoke.mjs` after `pnpm build`. Catches packaging breakage
// the unit tests (which run against src) cannot see.
import { strict as assert } from 'node:assert'

const dist = (path) => new URL(`../packages/${path}`, import.meta.url).href

let checks = 0
const ok = (cond, name) => {
  assert.ok(cond, name)
  checks++
}

// --- @passkey-ui/core ---
const core = await import(dist('core/dist/index.js'))
ok(typeof core.createPasskey === 'function', 'core.createPasskey')
ok(typeof core.signWithPasskey === 'function', 'core.signWithPasskey')
ok(typeof core.detectCapabilities === 'function', 'core.detectCapabilities')
ok(typeof core.selectFallbacks === 'function', 'core.selectFallbacks')
ok(typeof core.deriveWalletAddress === 'function', 'core.deriveWalletAddress')
ok(typeof core.payloadForAuthEntry === 'function', 'core.payloadForAuthEntry')
ok(typeof core.launchtubeSubmitter === 'function', 'core.launchtubeSubmitter')

// Real behavior through dist: detection degrades safely outside a browser...
const caps = await core.detectCapabilities()
ok(caps.webauthnAvailable === false, 'detection degrades in Node')
const rules = core.selectFallbacks(caps)
ok(
  rules.some((rule) => rule.action === 'require-secure-context'),
  'fallback rules fire',
)

// ...address derivation works and is deterministic...
const addressArgs = {
  deployer: 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57',
  keyId: new Uint8Array([1, 2, 3]),
  networkPassphrase: 'Test SDF Network ; September 2015',
}
const address = core.deriveWalletAddress(addressArgs)
ok(/^C[A-Z2-7]{55}$/.test(address), 'derived address is a valid contract id')
ok(core.deriveWalletAddress(addressArgs) === address, 'derivation is deterministic')

// ...and the crypto primitives work through the bundle.
const der = Uint8Array.from(
  Buffer.from(
    '3045022100e5482c5c0d316289b6f0d22b71c8986803a5142020c4ba34b0e496b9b04bd96802201e2a2204e2faedfdc5ec0e2af7e16ef36b94d3939183a5db1a35f3918f526d59',
    'hex',
  ),
)
ok(core.derToCompactSignature(der).length === 64, 'derToCompactSignature on dist')

// --- @passkey-ui/compat ---
const compat = await import(dist('compat/dist/index.js'))
ok(Array.isArray(compat.findings) && compat.findings.length >= 11, 'compat.findings')
ok(compat.validateFindings(compat.findings).length === 0, 'shipped findings validate')
ok(
  compat.generateGuide(compat.findings, { asOf: '2026-06-11' }).includes('# Stellar Passkey'),
  'guide generates',
)

// --- @passkey-ui/ui (the framework-agnostic root must import without react) ---
const ui = await import(dist('ui/dist/index.js'))
ok(typeof ui.createFlow === 'function', 'ui.createFlow')
ok(typeof ui.createSignFlow === 'function', 'ui.createSignFlow')
const flow = ui.createFlow({
  detectCapabilities: () => Promise.resolve(caps),
  selectFallbacks: () => [],
  run: () => Promise.resolve('done'),
})
await flow.start()
// WebAuthn is unavailable in Node, so blocked is the documented state here.
ok(flow.store.getState().phase === 'blocked', 'flow reaches the documented blocked state')

// --- @passkey-ui/ui/react (subpath export) ---
const uiReact = await import(dist('ui/dist/react/index.js'))
ok(typeof uiReact.PasskeyFlow === 'function', 'ui/react.PasskeyFlow')
ok(typeof uiReact.CreatePasskey === 'function', 'ui/react.CreatePasskey')

// --- @passkey-ui/wallet-kit ---
const kit = await import(dist('wallet-kit/dist/index.js'))
const moduleInstance = new kit.PasskeyModule({
  network: 'TESTNET',
  networkPassphrase: 'Test SDF Network ; September 2015',
  getWalletAddress: () => 'CADDR',
})
ok((await moduleInstance.getAddress()).address === 'CADDR', 'wallet-kit module getAddress')
ok((await moduleInstance.getNetwork()).network === 'TESTNET', 'wallet-kit module getNetwork')
ok(moduleInstance.productId === 'passkey', 'wallet-kit module metadata')

console.log(`dist smoke: ${checks} checks passed`)
