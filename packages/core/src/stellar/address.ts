import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk'

// A smart wallet's address is derived deterministically from the deployer and a
// salt, so a client can know the address before the wallet is deployed. We use
// the credential id as the salt source, matching the passkey-kit lineage, which
// ties one passkey to one predictable wallet address.
//
// Note: this relies on a global Buffer, which Node provides and Stellar browser
// apps already polyfill (the SDK itself depends on it).
export interface DeriveWalletAddressArgs {
  /** The account or contract that deploys the wallet (G… or C…). */
  deployer: string
  /** The passkey credential id, used as the salt. */
  keyId: Uint8Array
  networkPassphrase: string
}

export function deriveWalletAddress(args: DeriveWalletAddressArgs): string {
  const networkId = hash(Buffer.from(args.networkPassphrase))

  const contractIdPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
    new xdr.ContractIdPreimageFromAddress({
      address: Address.fromString(args.deployer).toScAddress(),
      salt: hash(Buffer.from(args.keyId)),
    }),
  )

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({ networkId, contractIdPreimage }),
  )

  return StrKey.encodeContract(hash(preimage.toXDR()))
}
