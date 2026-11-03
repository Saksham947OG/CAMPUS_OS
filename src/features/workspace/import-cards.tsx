import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { importEvidence, importPages } from '@/domain/workspace-ext'
import {
  EVIDENCE_FIELDS,
  FIELD_LABEL,
  guessMapping,
  parseCsv,
  parseMarkdown,
  previewEvidence,
  type EvidenceField,
  type ParsedNote,
} from '@/domain/workspace-import'
import { can, roleOf } from '@/domain/workspace-access'
import { spacesFor } from '@/selectors/workspace'
import type { WorkspaceApi } from './use-workspace'
import { Empty, fieldClass, WsCard } from './ws-ui'

const MAX_IMPORT = 1024 * 1024

/** Markdown files become pages, after a preview that shows duplicates and what is not carried over. */
export function ImportNotes({ w }: { w: WorkspaceApi }) {
  const { ws, actor, act } = w
  const writable = spacesFor(ws, actor).filter((s) => can(roleOf(ws, s.id, actor), 'edit'))
  const [chosenSpace, setSpaceId] = useState('')
  // The personal space is made when Workspace opens, so the default is worked out each render, not once.
  const spaceId = writable.some((s) => s.id === chosenSpace)
    ? chosenSpace
    : (writable.find((s) => s.type === 'personal')?.id ?? writable[0]?.id ?? '')
  const [notes, setNotes] = useState<(ParsedNote & { fileName: string })[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [mode, setMode] = useState<'append' | 'update'>('append')
  const [op, setOp] = useState(() => w.services.newId('imp'))

  const read = async (list: FileList | null) => {
    if (!list) return
    const out: typeof notes = []
    const bad: string[] = []
    for (const f of list) {
      if (!/\.(md|markdown|txt)$/i.test(f.name))
        bad.push(`${f.name}: only .md, .markdown and .txt files can be imported.`)
      else if (f.size > MAX_IMPORT) bad.push(`${f.name}: larger than 1 MB.`)
      else
        out.push({ ...parseMarkdown(await f.text(), f.name, w.services.newId), fileName: f.name })
    }
    setNotes(out)
    setErrors(bad)
  }
  const dupes = notes.filter((n) =>
    ws.pages.some((p) => p.spaceId === spaceId && !p.trashedAt && p.title === n.title),
  )

  return (
    <WsCard title="Import Markdown notes" id="ws-import">
      <p className="mb-2 text-sm text-ink-muted">
        Choose .md files, look at the preview, then import. Nothing is written until you confirm,
        and existing pages change only if you pick “Update”.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Markdown files
          <input
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            onChange={(e) => void read(e.target.files)}
            className={`${fieldClass} py-2`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Into space
          <select
            className={fieldClass}
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            {writable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {errors.map((e) => (
        <p key={e} role="alert" className="mt-2 text-sm text-danger">
          {e}
        </p>
      ))}
      {notes.length ? (
        <div className="mt-3" aria-label="Import preview">
          <h3 className="font-semibold text-ink">Preview</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {notes.map((n) => (
              <li key={n.fileName}>
                <strong>{n.title}</strong> · {n.blocks.length} blocks from {n.fileName}
                {dupes.includes(n) ? (
                  <span className="text-warning"> · a page with this title already exists</span>
                ) : null}
                {n.unsupported.length ? (
                  <span className="text-ink-muted">
                    {' '}
                    · not carried over: {n.unsupported.join('; ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {dupes.length ? (
            <fieldset className="mt-2">
              <legend className="text-sm font-medium text-ink">
                {dupes.length} title{dupes.length === 1 ? '' : 's'} already exist
                {dupes.length === 1 ? 's' : ''}
              </legend>
              {(['append', 'update'] as const).map((m) => (
                <label key={m} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="imp-mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  {m === 'append'
                    ? 'Add as new pages (keep the existing ones)'
                    : 'Update the existing pages with the imported text (history is kept)'}
                </label>
              ))}
            </fieldset>
          ) : null}
          <Button
            type="button"
            className="mt-2 min-h-11"
            onClick={() =>
              void act(
                (s, c) => importPages(s, c, actor, { spaceId, notes, mode, opId: op }),
                `Imported ${notes.length} ${notes.length === 1 ? 'page' : 'pages'}.`,
              ).then((r) => {
                if (r.ok) {
                  setNotes([])
                  setOp(w.services.newId('imp'))
                }
              })
            }
          >
            Import {notes.length} {notes.length === 1 ? 'page' : 'pages'}
          </Button>
        </div>
      ) : (
        <div className="mt-2">
          <Empty>No file chosen yet.</Empty>
        </div>
      )}
    </WsCard>
  )
}

/** A CSV becomes rows of the evidence register, with a column-mapping step and duplicate detection. */
export function ImportEvidence({ w, projectId }: { w: WorkspaceApi; projectId: string }) {
  const { ws, actor, act } = w
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, EvidenceField | ''>>({})
  const [mode, setMode] = useState<'append' | 'update'>('append')
  const [error, setError] = useState('')
  const existing = new Map(
    ws.sources
      .filter((s) => s.projectId === projectId)
      .map((s) => [s.claim.toLowerCase(), s.claim]),
  )
  const preview = rows.length ? previewEvidence(rows, mapping, existing) : []
  const importable = preview.filter((p) => p.values.claim)

  const read = async (f: File | undefined) => {
    setError('')
    if (!f) return
    if (!/\.csv$/i.test(f.name)) return setError('Choose a .csv file.')
    if (f.size > MAX_IMPORT) return setError('That file is larger than 1 MB.')
    const parsed = parseCsv(await f.text())
    if (parsed.length < 2) return setError('The file needs a header row and at least one data row.')
    setRows(parsed)
    setMapping(guessMapping(parsed[0]!))
  }
  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="min-h-9 cursor-pointer text-sm font-medium text-ink">
        Import evidence from a CSV file
      </summary>
      <div className="mt-2">
        <label className="flex flex-col gap-1 text-sm text-ink">
          CSV file with a header row
          <input
            type="file"
            accept=".csv"
            onChange={(e) => void read(e.target.files?.[0])}
            className={`${fieldClass} py-2`}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {rows.length ? (
          <>
            <h3 className="mt-3 font-semibold text-ink">Match your columns</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows[0]!.map((h, i) => (
                <li key={i}>
                  <label className="flex flex-col gap-1 text-sm text-ink">
                    Column “{h || `#${i + 1}`}” goes to
                    <select
                      className={fieldClass}
                      value={mapping[i] ?? ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [i]: e.target.value as EvidenceField | '' })
                      }
                    >
                      <option value="">Ignore this column</option>
                      {EVIDENCE_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABEL[f]}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            <h3 className="mt-3 font-semibold text-ink">Preview of {preview.length} rows</h3>
            <ul className="max-h-60 overflow-y-auto text-sm">
              {preview.map((p) => (
                <li key={p.line} className="border-b border-border py-1">
                  Row {p.line}: {p.values.claim || <em>no claim</em>}
                  {p.duplicateOf ? (
                    <span className="text-warning"> · same claim as an existing row</span>
                  ) : null}
                  {p.problems.map((m) => (
                    <span key={m} className="block text-xs text-danger">
                      {m}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <fieldset className="mt-2">
              <legend className="text-sm font-medium text-ink">If a claim already exists</legend>
              {(['append', 'update'] as const).map((m) => (
                <label key={m} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="ev-mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  {m === 'append' ? 'Skip it (never add a duplicate)' : 'Update the existing row'}
                </label>
              ))}
            </fieldset>
            <Button
              type="button"
              className="mt-2 min-h-11"
              disabled={!importable.length || !mapping || !Object.values(mapping).includes('claim')}
              onClick={() =>
                void act(
                  (s, c) => importEvidence(s, c, actor, projectId, importable, mode),
                  'Evidence imported.',
                ).then((r) => r.ok && setRows([]))
              }
            >
              Import {importable.length} rows
            </Button>
          </>
        ) : null}
      </div>
    </details>
  )
}
