import { Address, xdr } from '@stellar/stellar-sdk'
import { describe, expect, test } from 'vitest'
import { attachSignatureToEntry, passkeyKitSignatureScVal } from './encoder'

const parts = {
  credentialId: new Uint8Array(20).fill(1),
  authenticatorData: new Uint8Array(37).fill(2),
  clientDataJSON: new Uint8Array(80).fill(3),
  signature: new Uint8Array(64).fill(4),
}

describe('passkeyKitSignatureScVal', () => {
  const scval = passkeyKitSignatureScVal(parts)

  test('builds the Vec-wrapped Map<SignerKey, Signature> layout the contract deserializes', () => {
    // Signatures is a one-field tuple struct: Vec wraps the map. Verified
    // byte-for-byte against the Rust SDK and by a testnet transaction.
    const entries = scval.vec()?.[0]?.map()
    expect(entries).toHaveLength(1)

    const keyVec = entries![0]!.key().vec()!
    expect(keyVec[0]!.sym().toString()).toBe('Secp256r1')
    expect(new Uint8Array(keyVec[1]!.bytes())).toEqual(parts.credentialId)

    const valVec = entries![0]!.val().vec()!
    expect(valVec[0]!.sym().toString()).toBe('Secp256r1')
    const structKeys = valVec[1]!.map()!.map((field) => field.key().sym().toString())
    expect(structKeys).toEqual(['authenticator_data', 'client_data_json', 'signature'])
  })

  test('round-trips through XDR', () => {
    const decoded = xdr.ScVal.fromXDR(scval.toXDR())
    expect(decoded.vec()?.[0]?.map()).toHaveLength(1)
  })
})

describe('attachSignatureToEntry', () => {
  test('sets the signature on address credentials', () => {
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.contract(Buffer.alloc(32, 7)).toScAddress(),
          nonce: new xdr.Int64(1n),
          signatureExpirationLedger: 100,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: Address.contract(Buffer.alloc(32, 7)).toScAddress(),
            functionName: 'hello',
            args: [],
          }),
        ),
        subInvocations: [],
      }),
    })

    attachSignatureToEntry(entry, passkeyKitSignatureScVal(parts))
    expect(entry.credentials().address().signature().vec()?.[0]?.map()).toHaveLength(1)
  })
})
