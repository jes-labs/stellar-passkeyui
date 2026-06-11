import { execFileSync } from 'node:child_process'
import { webcrypto } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { publicKeyFromSpki } from './public-key'
import { derToCompactSignature } from './signature'

// OpenSSL is a third independent implementation. We let it generate real EC keys
// and DER signatures, then confirm our SPKI parser and DER-to-compact conversion
// produce a signature Web Crypto accepts. Skipped automatically where OpenSSL is
// not installed so CI stays green without it.

function hasOpenssl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const subtle = webcrypto.subtle
const run = (args: string[]) =>
  execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'ignore'] })

describe('OpenSSL cross-check', () => {
  test.skipIf(!hasOpenssl())('SPKI parse + compact signature verify under Web Crypto', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'passkey-ossl-'))

    for (let i = 0; i < 20; i++) {
      const keyPath = join(dir, `key-${i}.pem`)
      const msgPath = join(dir, `msg-${i}.bin`)

      run(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', keyPath])
      const spki = new Uint8Array(run(['ec', '-in', keyPath, '-pubout', '-outform', 'DER']))

      const message = webcrypto.getRandomValues(new Uint8Array(32 + i))
      writeFileSync(msgPath, message)
      const der = new Uint8Array(run(['dgst', '-sha256', '-sign', keyPath, msgPath]))

      const point = publicKeyFromSpki(spki)
      const compact = derToCompactSignature(der)
      expect(compact.length).toBe(64)

      const verifyKey = await subtle.importKey(
        'raw',
        point,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
      const ok = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        verifyKey,
        compact,
        message,
      )
      expect(ok).toBe(true)
    }
  })
})
