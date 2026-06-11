import { describe, expect, test } from 'vitest'
import { detectBrowser } from './browser'

// Real-world user agent strings. The engine column is what the fallback engine
// actually cares about, so each case asserts both family and engine.
const cases: ReadonlyArray<{
  name: string
  ua: string
  family: string
  engine: string
}> = [
  {
    name: 'Chrome on macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    family: 'chrome',
    engine: 'blink',
  },
  {
    name: 'Chrome on Android',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    family: 'chrome',
    engine: 'blink',
  },
  {
    name: 'Safari on macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    family: 'safari',
    engine: 'webkit',
  },
  {
    name: 'Safari on iOS',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    family: 'safari',
    engine: 'webkit',
  },
  {
    name: 'Chrome on iOS (CriOS) is WebKit underneath',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
    family: 'chrome',
    engine: 'webkit',
  },
  {
    name: 'Firefox on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    family: 'firefox',
    engine: 'gecko',
  },
  {
    name: 'Firefox on iOS (FxiOS) is WebKit underneath',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
    family: 'firefox',
    engine: 'webkit',
  },
  {
    name: 'Edge on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    family: 'edge',
    engine: 'blink',
  },
]

describe('detectBrowser', () => {
  for (const { name, ua, family, engine } of cases) {
    test(name, () => {
      expect(detectBrowser(ua)).toEqual({ family, engine })
    })
  }

  test('unknown user agent', () => {
    expect(detectBrowser('some-bot/1.0')).toEqual({ family: 'other', engine: 'unknown' })
  })
})
