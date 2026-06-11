import type { BrowserEngine, BrowserFamily } from './types'

// Identify the browser family and, more importantly, the rendering engine. The
// engine is what actually decides WebAuthn behavior: on iOS every browser is
// WebKit, so iOS Chrome and Firefox inherit Safari's iframe restrictions even
// though they are branded differently.
//
// Order matters here. Edge, Chrome, and Safari all appear in each other's user
// agent strings, so the more specific tokens are matched first.
export function detectBrowser(userAgent: string): {
  family: BrowserFamily
  engine: BrowserEngine
} {
  const ua = userAgent

  if (/EdgiOS\//.test(ua)) return { family: 'edge', engine: 'webkit' }
  if (/Edg(A)?\//.test(ua)) return { family: 'edge', engine: 'blink' }
  if (/FxiOS\//.test(ua)) return { family: 'firefox', engine: 'webkit' }
  if (/Firefox\//.test(ua)) return { family: 'firefox', engine: 'gecko' }
  if (/CriOS\//.test(ua)) return { family: 'chrome', engine: 'webkit' }
  if (/Chrome\//.test(ua) && !/Edg/.test(ua)) return { family: 'chrome', engine: 'blink' }
  if (/AppleWebKit\//.test(ua) && /Safari\//.test(ua)) return { family: 'safari', engine: 'webkit' }
  if (/AppleWebKit\//.test(ua)) return { family: 'safari', engine: 'webkit' }

  return { family: 'other', engine: 'unknown' }
}
