// Theme tokens as CSS custom properties. The components ship structure and these
// variables, not a design system: a consumer overrides any of them to match their
// own look. Defaults are sober and neutral.

export const TOKEN_NAMES = {
  background: '--pk-background',
  foreground: '--pk-foreground',
  muted: '--pk-muted',
  accent: '--pk-accent',
  accentForeground: '--pk-accent-foreground',
  advisory: '--pk-advisory',
  blocker: '--pk-blocker',
  radius: '--pk-radius',
  fontFamily: '--pk-font-family',
} as const

export type ThemeTokens = Partial<Record<keyof typeof TOKEN_NAMES, string>>

export const defaultTheme: Required<ThemeTokens> = {
  background: '#ffffff',
  foreground: '#16181d',
  muted: '#6b7280',
  accent: '#3b5bdb',
  accentForeground: '#ffffff',
  advisory: '#b45309',
  blocker: '#b91c1c',
  radius: '10px',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
}

/** Turn a theme into a style object of CSS variables for a wrapping element. */
export function themeToCssVariables(theme: ThemeTokens = {}): Record<string, string> {
  const merged = { ...defaultTheme, ...theme }
  const style: Record<string, string> = {}
  for (const key of Object.keys(TOKEN_NAMES) as Array<keyof typeof TOKEN_NAMES>)
    style[TOKEN_NAMES[key]] = merged[key]
  return style
}
