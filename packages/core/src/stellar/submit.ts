// Transaction submission. Smart-wallet UX needs no XLM and no manual sequence
// management because a submission service (Launchtube) pays the fee and manages
// the source account. Submission is an interface so a wallet can swap services
// or point at its own relayer.

export interface SubmitResult {
  hash?: string
  status?: string
  raw: unknown
}

export interface Submitter {
  submit(signedTransactionXdr: string): Promise<SubmitResult>
}

export interface FetchResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<FetchResponse>

export interface LaunchtubeConfig {
  /** The Launchtube endpoint URL. */
  url: string
  /** Bearer token for the service, when required. */
  jwt?: string
  /** Override the fetch implementation, mainly for testing. */
  fetch?: FetchLike
}

export function launchtubeSubmitter(config: LaunchtubeConfig): Submitter {
  const doFetch: FetchLike =
    config.fetch ?? ((url, init) => (globalThis.fetch as unknown as FetchLike)(url, init))

  return {
    async submit(signedTransactionXdr) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
      if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`

      const response = await doFetch(config.url, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ xdr: signedTransactionXdr }).toString(),
      })

      const raw = await response.json().catch(() => null)
      if (!response.ok)
        throw new Error(`Launchtube submission failed with status ${response.status}`)

      const result: SubmitResult = { raw }
      if (raw && typeof raw === 'object') {
        const fields = raw as Record<string, unknown>
        if (typeof fields.hash === 'string') result.hash = fields.hash
        if (typeof fields.status === 'string') result.status = fields.status
      }
      return result
    },
  }
}
