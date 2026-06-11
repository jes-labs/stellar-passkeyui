import {
  Networks,
  type Operation,
  TransactionBuilder,
  authorizeEntry,
  hash,
  type xdr,
} from '@stellar/stellar-sdk'
import { describe, expect, test } from 'vitest'
import { payloadForAuthEntry } from './challenge'

// A real transaction with a smart-wallet authorization entry, from passkey-kit's
// fixtures. It gives us a genuine SorobanAuthorizationEntry to test against.
const REAL_TXN_XDR =
  'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACZ2gAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABm9cbgAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAADAAAAEgAAAAHEqqtef1h9hZOQyrCuQRtZ3o8DHtvuSRoq1C8mc+UHHAAAABIAAAABStcRNXctVBwYQExJdAWbrBC3X+B3Ue9QkP4MJ8nhD7UAAAAKAAAAAAAAAAAAAAAAAJiWgAAAAAEAAAABAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccVuXL7MuknWEAAkrxAAAAEQAAAAEAAAACAAAAEAAAAAEAAAACAAAADwAAAAdFZDI1NTE5AAAAAA0AAAAgawYrFjEXTyFLVqniIQebbdWimEk+WkHm4UAdwhtQENIAAAAQAAAAAQAAAAIAAAAPAAAAB0VkMjU1MTkAAAAADQAAAEB4a0Pf3RTJS6TOa69dJ7TG5noSSX3OiRRk8xucLNsxgkckcRyeWr18ir8EgFATxz4X2WvJGLMYNDu11ScujcANAAAAEAAAAAEAAAACAAAADwAAAAZQb2xpY3kAAAAAABIAAAABa07R4ERvYHyHhguMb1H1ScVe13IWchSNA5oUEwVRrK8AAAABAAAAAAAAAAHXkotywnA8z+r365/0701QSlWouXn8m0UOoshCtNHOYQAAAAh0cmFuc2ZlcgAAAAMAAAASAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccAAAAEgAAAAFK1xE1dy1UHBhATEl0BZusELdf4HdR71CQ/gwnyeEPtQAAAAoAAAAAAAAAAAAAAAAAmJaAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAMAAAAGAAAAAcSqq15/WH2Fk5DKsK5BG1nejwMe2+5JGirULyZz5QccAAAAFVbly+zLpJ1hAAAAAAAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAQAAAAAQAAAAIAAAAPAAAAB0JhbGFuY2UAAAAAEgAAAAFK1xE1dy1UHBhATEl0BZusELdf4HdR71CQ/gwnyeEPtQAAAAEAAAAGAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAAEAAAAAEAAAACAAAADwAAAAdCYWxhbmNlAAAAABIAAAABxKqrXn9YfYWTkMqwrkEbWd6PAx7b7kkaKtQvJnPlBxwAAAABAAWL7QAAArgAAAIIAAAAAAACZwQAAAAA'

function firstAuthEntry(): xdr.SorobanAuthorizationEntry {
  const tx = TransactionBuilder.fromXDR(REAL_TXN_XDR, Networks.TESTNET)
  if ('operations' in tx === false) throw new Error('not a regular transaction')
  const op = tx.operations[0] as Operation.InvokeHostFunction
  const entry = op.auth?.[0]
  if (!entry) throw new Error('fixture has no auth entry')
  return entry
}

describe('payloadForAuthEntry', () => {
  const entry = firstAuthEntry()

  test('produces a 32-byte payload', () => {
    expect(payloadForAuthEntry(entry, Networks.TESTNET).length).toBe(32)
  })

  // Cross-check against stellar-sdk's own preimage construction. authorizeEntry
  // builds the HashIdPreimage internally and hands it to the signer; we capture
  // it, hash it the same way, and confirm our standalone payload matches.
  test('matches the preimage stellar-sdk builds in authorizeEntry', async () => {
    const address = entry.credentials().address()
    const validUntil = address.signatureExpirationLedger()

    let captured: xdr.HashIdPreimage | undefined
    await authorizeEntry(
      entry,
      (preimage) => {
        captured = preimage
        return Promise.resolve(Buffer.alloc(64))
      },
      validUntil,
      Networks.TESTNET,
    ).catch(() => {
      // authorizeEntry may reject after the signer runs (the dummy signature is
      // not a valid contract signature); we only need the captured preimage.
    })

    expect(captured).toBeDefined()
    const expected = new Uint8Array(hash(captured!.toXDR()))
    expect(payloadForAuthEntry(entry, Networks.TESTNET)).toEqual(expected)
  })
})
