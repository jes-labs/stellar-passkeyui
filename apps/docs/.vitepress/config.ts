import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Stellar Passkey UI',
  description:
    'A minimal, composable passkey SDK and UI components for Stellar smart wallets, built around a maintained compatibility guide.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Compatibility', link: '/compatibility' },
      { text: 'GitHub', link: 'https://github.com/jes-labs/stellar-passkeyui' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
      {
        text: 'Usage',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'API reference', link: '/api' },
        ],
      },
      {
        text: 'Compatibility',
        items: [{ text: 'Compatibility guide', link: '/compatibility' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/jes-labs/stellar-passkeyui' }],
  },
})
