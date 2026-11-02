// Validates WCAG contrast for the foreground/background pairs the UI actually uses.
// Reads hex values from src/design/tokens.css so tokens stay the single source of truth.
// Exit code 1 if any pair is below its required ratio.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/design/tokens.css', import.meta.url), 'utf8')
const hexes = (text) =>
  Object.fromEntries(
    [...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, hex]) => [
      name,
      hex,
    ]),
  )
const between = (a, b) => css.slice(css.indexOf(a) + a.length, css.indexOf(b))
const lightCss = css.slice(0, css.indexOf('/* DARK:START */'))
const darkCss = between('/* DARK:START */', '/* DARK:END */')
const darkMediaCss = between('/* DARK-MEDIA:START */', '/* DARK-MEDIA:END */')
const lightTokens = hexes(lightCss)
const darkTokens = { ...lightTokens, ...hexes(darkCss) }
// The "System" dark block must carry exactly the same values as the chosen-Dark block.
const sameDark = JSON.stringify(hexes(darkCss)) === JSON.stringify(hexes(darkMediaCss))

const channel = (hex, i) => {
  const c = parseInt(hex.slice(i, i + 2), 16) / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (hex) =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEXT = 4.5 // WCAG 1.4.3 normal text
const NON_TEXT = 3 // WCAG 1.4.11 UI components / graphical objects

/** [foreground token, background token, required ratio, what it is used for] */
const pairs = [
  ['ink', 'canvas', TEXT, 'body text on page'],
  ['ink', 'surface', TEXT, 'body text on cards'],
  ['ink', 'mist', TEXT, 'text on secondary surface'],
  ['ink-muted', 'canvas', TEXT, 'secondary text on page'],
  ['ink-muted', 'surface', TEXT, 'secondary text on cards'],
  ['ink-muted', 'mist', TEXT, 'secondary text on secondary surface'],
  ['accent-teal', 'surface', TEXT, 'teal links / text on cards'],
  ['accent-teal', 'canvas', TEXT, 'teal links / text on page'],
  ['surface', 'accent-teal', TEXT, 'primary button label'],
  ['teal-strong', 'mist', TEXT, 'teal text on mist'],
  ['terracotta-text', 'surface', TEXT, 'terracotta text on cards'],
  ['terracotta-text', 'canvas', TEXT, 'terracotta text on page'],
  ['ink', 'accent-terracotta', TEXT, 'label on terracotta fill'],
  ['ink', 'terracotta-tint', TEXT, 'label on terracotta tint'],
  ['ink', 'teal-tint', TEXT, 'label on teal tint'],
  ['coffee', 'surface', TEXT, 'café accent text on cards'],
  ['coffee', 'canvas', TEXT, 'café accent text on page'],
  ['ink', 'coffee-tint', TEXT, 'label on café tint'],
  ['ink-muted', 'coffee-tint', TEXT, 'secondary text on café tint'],
  ['status-success', 'surface', TEXT, 'success text'],
  ['status-warning', 'surface', TEXT, 'warning text'],
  ['status-danger', 'surface', TEXT, 'danger text'],
  ['status-info', 'surface', TEXT, 'info text'],
  ['border-strong', 'surface', NON_TEXT, 'input/control outline on cards'],
  ['border-strong', 'canvas', NON_TEXT, 'input/control outline on page'],
  ['focus-ring', 'surface', NON_TEXT, 'focus ring on cards'],
  ['focus-ring', 'canvas', NON_TEXT, 'focus ring on page'],
  ...[
    'cat-class',
    'cat-exam',
    'cat-assignment',
    'cat-project',
    'cat-birthday',
    'cat-campus',
    'cat-sports',
    'cat-personal',
    'cat-booking',
    'cat-admin',
  ].map((t) => [t, 'surface', NON_TEXT, 'category mark on cards']),
]

let failures = 0
if (!sameDark) {
  console.error('FAIL  the System-dark block differs from the chosen-Dark block in tokens.css')
  failures++
}
let total = 0
for (const [theme, tokens] of [
  ['light', lightTokens],
  ['dark', darkTokens],
]) {
  for (const [fg, bg, min, use] of pairs) {
    total++
    const f = tokens[fg]
    const b = tokens[bg]
    if (!f || !b) {
      console.error(`MISSING TOKEN  ${fg} / ${bg}`)
      failures++
      continue
    }
    const r = ratio(f, b)
    const ok = r >= min
    if (!ok) failures++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1 (need ${min})  ${fg} on ${bg} — ${use}`,
    )
  }
}
console.log(`\n${total - failures}/${total} pairs pass`)
process.exit(failures ? 1 : 0)
