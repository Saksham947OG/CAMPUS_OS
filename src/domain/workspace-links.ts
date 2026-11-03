import type { Block } from './workspace'

/**
 * Wiki links. Stored text holds `[[<pageId>]]`; the editor shows `[[Title]]`. Links therefore keep
 * working after a rename, and a title the reader may not open is never shown (spec §4.3, §9.1).
 */
const TOKEN = /\[\[([^\]\n]+)\]\]/g
export const PAGE_ID = /^pg-[\w-]+$/

export const linkTargets = (text: string): string[] => {
  const ids: string[] = []
  for (const m of text.matchAll(TOKEN))
    if (PAGE_ID.test(m[1]!) && !ids.includes(m[1]!)) ids.push(m[1]!)
  return ids
}

export const blockLinks = (blocks: readonly Block[]): string[] => [
  ...new Set(blocks.flatMap((b) => linkTargets(b.text))),
]

/** Stored → editable. `titleOf` returns undefined for a page the reader cannot open. */
export const toDisplay = (text: string, titleOf: (id: string) => string | undefined) =>
  text.replace(TOKEN, (whole, inner: string) =>
    PAGE_ID.test(inner) ? `[[${titleOf(inner) ?? 'a page you cannot open'}]]` : whole,
  )

/** Editable → stored. A title that matches no page stays as typed, so it shows up as an unresolved link. */
export const toStored = (text: string, idOf: (title: string) => string | undefined) =>
  text.replace(TOKEN, (whole, inner: string) => {
    if (PAGE_ID.test(inner)) return whole
    const id = idOf(inner.trim())
    return id ? `[[${id}]]` : whole
  })

/** Titles written as `[[Title]]` that point at nothing yet. */
export const unresolvedTitles = (blocks: readonly Block[]): string[] => [
  ...new Set(
    blocks.flatMap((b) =>
      [...b.text.matchAll(TOKEN)].map((m) => m[1]!.trim()).filter((t) => !PAGE_ID.test(t)),
    ),
  ),
]
