import type { ManualSession } from '../schema'

// Real-hardware test sessions against the deployed demo. Each entry records
// only what the tester actually confirmed — no extrapolation. These are the
// first cells of the manual device lab; the list grows as devices are covered.

const DEMO_URL = 'https://stellar-passkey-demo.vercel.app'

export const sessions: readonly ManualSession[] = [
  {
    id: 'macos-brave-touchid-2026-06-11',
    date: '2026-06-11',
    device: 'MacBook Pro',
    os: 'macos',
    browser: 'Brave',
    authenticator: 'Touch ID',
    outcome: 'works',
    confirmed:
      'Passkey created and a transaction payload signed end to end. Note: Brave reports a Chrome user agent; the brand is only visible through client hints.',
    url: 'http://localhost:4173',
  },
  {
    id: 'macos-safari-touchid-2026-06-12',
    date: '2026-06-12',
    device: 'MacBook Pro',
    os: 'macos',
    browser: 'Safari',
    authenticator: 'Touch ID',
    outcome: 'works',
    confirmed: 'Passkey created and a transaction payload signed on the deployed demo.',
    url: DEMO_URL,
  },
  {
    id: 'ios-safari-faceid-2026-06-12',
    date: '2026-06-12',
    device: 'iPhone',
    os: 'ios',
    browser: 'Safari',
    authenticator: 'Face ID',
    outcome: 'works',
    confirmed: 'Face ID prompt completed and the passkey flow finished on the deployed demo.',
    url: DEMO_URL,
  },
  {
    id: 'android-chrome-fingerprint-2026-06-12',
    date: '2026-06-12',
    device: 'Android phone',
    os: 'android',
    browser: 'Chrome',
    authenticator: 'Fingerprint',
    outcome: 'works',
    confirmed: 'Passkey flow completed on the deployed demo.',
    url: DEMO_URL,
  },
  {
    id: 'android-operamini-fingerprint-2026-06-12',
    date: '2026-06-12',
    device: 'Android phone',
    os: 'android',
    browser: 'Opera Mini',
    authenticator: 'Fingerprint',
    outcome: 'works',
    confirmed:
      'Passkey flow completed on the deployed demo. Opera on Android runs on the Blink engine, which matches the behavior the matrix predicts for Chromium-family browsers.',
    url: DEMO_URL,
  },
  {
    id: 'macos-firefox-touchid-2026-06-12',
    date: '2026-06-12',
    device: 'MacBook Pro',
    os: 'macos',
    browser: 'Firefox',
    authenticator: 'Touch ID',
    outcome: 'works',
    confirmed:
      'Passkey flow completed on the deployed demo. All capability lights on, including conditional mediation.',
    url: DEMO_URL,
  },
  {
    id: 'android-firefox-fingerprint-2026-06-12',
    date: '2026-06-12',
    device: 'Android phone',
    os: 'android',
    browser: 'Firefox',
    authenticator: 'Fingerprint',
    outcome: 'partial',
    confirmed:
      'Create and sign completed, but conditional mediation (passkey autofill) is unavailable; the SDK surfaced the documented advisory and fell back to the explicit button. First on-device confirmation of the conditional-mediation finding.',
    url: DEMO_URL,
  },
  {
    id: 'android-edge-fingerprint-2026-06-12',
    date: '2026-06-12',
    device: 'Android phone',
    os: 'android',
    browser: 'Edge',
    authenticator: 'Fingerprint',
    outcome: 'works',
    confirmed: 'Passkey flow completed on the deployed demo.',
    url: DEMO_URL,
  },
]
