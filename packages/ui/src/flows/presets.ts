import type {
  Capabilities,
  CompatRule,
  CreatePasskeyInput,
  CreatePasskeyResult,
} from '@passkey-ui/core'
import { type Flow, createFlow } from './flow'

interface CapabilityDeps {
  detectCapabilities: () => Promise<Capabilities>
  selectFallbacks: (capabilities: Capabilities) => CompatRule[]
}

export interface CreatePasskeyFlowDeps extends CapabilityDeps {
  createPasskey: (input: CreatePasskeyInput) => Promise<CreatePasskeyResult>
  input: CreatePasskeyInput
}

export function createCreatePasskeyFlow(deps: CreatePasskeyFlowDeps): Flow<CreatePasskeyResult> {
  return createFlow({
    detectCapabilities: deps.detectCapabilities,
    selectFallbacks: deps.selectFallbacks,
    run: () => deps.createPasskey(deps.input),
  })
}

export interface SignFlowDeps<Result> extends CapabilityDeps {
  // The caller wires up what to sign (the transaction and its payload live in
  // their code); the flow only governs the capability gating and the states.
  sign: () => Promise<Result>
}

export function createSignFlow<Result>(deps: SignFlowDeps<Result>): Flow<Result> {
  return createFlow({
    detectCapabilities: deps.detectCapabilities,
    selectFallbacks: deps.selectFallbacks,
    run: deps.sign,
  })
}

export interface RecoverFlowDeps extends CapabilityDeps {
  // Recovery is: enroll a passkey on the new device, then authorize adding it as
  // a signer. The add-signer step is the contract-binding operation, injected by
  // the integration.
  enrollPasskey: (input: CreatePasskeyInput) => Promise<CreatePasskeyResult>
  input: CreatePasskeyInput
  addSigner: (enrolled: CreatePasskeyResult) => Promise<void>
}

export function createRecoverFlow(deps: RecoverFlowDeps): Flow<CreatePasskeyResult> {
  return createFlow({
    detectCapabilities: deps.detectCapabilities,
    selectFallbacks: deps.selectFallbacks,
    run: async () => {
      const enrolled = await deps.enrollPasskey(deps.input)
      await deps.addSigner(enrolled)
      return enrolled
    },
  })
}
