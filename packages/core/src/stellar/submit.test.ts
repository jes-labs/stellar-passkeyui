import { describe, expect, test } from 'vitest'
import { type FetchLike, launchtubeSubmitter } from './submit'

function recordingFetch(response: {
  ok: boolean
  status: number
  body: unknown
}): { fetch: FetchLike; calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> } {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = []
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init })
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(''),
    })
  }
  return { fetch, calls }
}

describe('launchtubeSubmitter', () => {
  test('posts the xdr form-encoded with a bearer token', async () => {
    const { fetch, calls } = recordingFetch({
      ok: true,
      status: 200,
      body: { hash: 'deadbeef', status: 'success' },
    })
    const submitter = launchtubeSubmitter({
      url: 'https://launchtube.example',
      jwt: 'token',
      fetch,
    })

    const result = await submitter.submit('AAAA==')

    expect(result.hash).toBe('deadbeef')
    expect(result.status).toBe('success')

    const call = calls[0]
    expect(call?.url).toBe('https://launchtube.example')
    expect(call?.init.method).toBe('POST')
    expect(call?.init.headers.Authorization).toBe('Bearer token')
    expect(call?.init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(call?.init.body).toContain('xdr=AAAA')
  })

  test('omits the Authorization header when no token is given', async () => {
    const { fetch, calls } = recordingFetch({ ok: true, status: 200, body: {} })
    await launchtubeSubmitter({ url: 'https://launchtube.example', fetch }).submit('x')
    expect(calls[0]?.init.headers.Authorization).toBeUndefined()
  })

  test('throws on a non-ok response', async () => {
    const { fetch } = recordingFetch({ ok: false, status: 500, body: null })
    await expect(
      launchtubeSubmitter({ url: 'https://launchtube.example', fetch }).submit('x'),
    ).rejects.toThrow(/500/)
  })
})
