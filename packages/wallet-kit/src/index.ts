// A Stellar Wallets Kit module for passkey smart wallets. Register an instance
// alongside the kit's other modules; it reports availability via passkey
// capability detection and delegates the contract-specific signing to the
// integration that holds the smart-wallet bindings.

export {
  PasskeyModule,
  PASSKEY_MODULE_ID,
  type PasskeyModuleConfig,
} from './passkey-module'
export {
  ModuleType,
  type ModuleInterface,
  type SignOptions,
} from './module-interface'
