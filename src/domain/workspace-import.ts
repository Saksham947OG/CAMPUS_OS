import type { Block, BlockType } from './workspace'

/**
 * Import (spec §13): files are read here into a PREVIEW. Nothing is written until the user has seen
 * the column mapping or the page list, any duplicates and any problems, and chosen append or update.
 */
export interface ParsedNote {
  title: string
  blocks: Block[]
  /** Formatting the importer does not carry over, said plainly in the preview. */
  unsupported: string[]
}

const UNSUPPORTED: [RegExp, string][] = [
  [/!\[[^\]]*\]\([^)]*\)/, 'images are not imported (add them as files)'],
  [/^\|.+\|\s*$/m, 'tables become plain text lines'],
  [/<[a-z][^>]*>/i, 'HTML is removed, not run'],
  [/\[\^[^\]]+\]/, 'footnotes become plain text'],
]

const stripInline = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')

export function parseMarkdown(
  text: string,
  fileName: string,
  newId: (p: string) => string,
): ParsedNote {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let title = ''
  let para: string[] = []
  let code: string[] | null = null
  const push = (type: BlockType, t: string, extra: Partial<Block> = {}) =>
    blocks.push({ id: newId('b'), type, text: t.slice(0, 6000), ...extra })
  const flush = () => {
    if (para.length) push('paragraph', stripInline(para.join(' ').trim()))
    para = []
  }
  for (const raw of lines) {
    if (code) {
      if (/^```/.test(raw)) {
        push('code', code.join('\n'))
        code = null
      } else code.push(raw)
      continue
    }
    if (/^```/.test(raw)) {
      flush()
      code = []
      continue
    }
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      const level = h[1]!.length
      const body = stripInline(h[2]!.trim())
      if (level === 1 && !title && !blocks.length) title = body
      else push(level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', body)
      continue
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flush()
      push('divider', '')
      continue
    }
    const todo = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
    if (todo) {
      flush()
      push('todo', stripInline(todo[2]!), { checked: todo[1] !== ' ' })
      continue
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      flush()
      push('bullet', stripInline(bullet[1]!))
      continue
    }
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (num) {
      flush()
      push('numbered', stripInline(num[1]!))
      continue
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flush()
      push('quote', stripInline(quote[1]!))
      continue
    }
    para.push(line.trim())
  }
  if (code) push('code', code.join('\n'))
  flush()
  return {
    title: (title || fileName.replace(/\.(md|markdown|txt)$/i, '')).slice(0, 120),
    blocks: blocks.length ? blocks : [{ id: newId('b'), type: 'paragraph', text: '' }],
    unsupported: UNSUPPORTED.filter(([re]) => re.test(text)).map(([, msg]) => msg),
  }
}

/* ---------- CSV into the evidence register ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

export const EVIDENCE_FIELDS = [
  'claim',
  'source',
  'method',
  'observedOn',
  'finding',
  'limitations',
] as const
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number]
export const FIELD_LABEL: Record<EvidenceField, string> = {
  claim: 'Claim',
  source: 'Source',
  method: 'Method',
  observedOn: 'Date observed',
  finding: 'Finding',
  limitations: 'Limitations',
}
const GUESS: Record<EvidenceField, RegExp> = {
  claim: /^(claim|statement|title|argument)$/i,
  source: /^(source|reference|citation|where)$/i,
  method: /^(method|approach|how)$/i,
  observedOn: /^(date|observed|observed on|date observed)$/i,
  finding: /^(finding|result|observation|evidence)$/i,
  limitations: /^(limitations?|caveats?|weakness)$/i,
}

/** Guesses which CSV column feeds which field. The user can change every guess before importing. */
export function guessMapping(header: readonly string[]): Record<number, EvidenceField | ''> {
  const out: Record<number, EvidenceField | ''> = {}
  const used = new Set<EvidenceField>()
  header.forEach((h, i) => {
    const hit = EVIDENCE_FIELDS.find((f) => !used.has(f) && GUESS[f].test(h.trim()))
    if (hit) used.add(hit)
    out[i] = hit ?? ''
  })
  return out
}

export interface EvidencePreviewRow {
  line: number
  values: Partial<Record<EvidenceField, string>>
  problems: string[]
  duplicateOf?: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function previewEvidence(
  rows: readonly string[][],
  mapping: Record<number, EvidenceField | ''>,
  existingClaims: ReadonlyMap<string, string>,
): EvidencePreviewRow[] {
  return rows.slice(1).map((r, k) => {
    const values: Partial<Record<EvidenceField, string>> = {}
    Object.entries(mapping).forEach(([col, f]) => {
      if (f) values[f] = (r[Number(col)] ?? '').trim()
    })
    const problems: string[] = []
    if (!values.claim) problems.push('No claim, so this row cannot be imported.')
    if (values.observedOn && !ISO.test(values.observedOn))
      problems.push('Date must be YYYY-MM-DD (date-only), so it is left out.')
    for (const f of EVIDENCE_FIELDS)
      if ((values[f] ?? '').length > 600)
        problems.push(`${FIELD_LABEL[f]} is too long and will be cut.`)
    return {
      line: k + 2,
      values,
      problems,
      ...(values.claim && existingClaims.has(values.claim.toLowerCase())
        ? { duplicateOf: existingClaims.get(values.claim.toLowerCase())! }
        : {}),
    }
  })
}
