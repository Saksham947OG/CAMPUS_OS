import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { attach, loadBlob, removeBlob } from '@/data/evidence/evidence-store'
import { EVIDENCE_LIMITS, validateEvidence, type EvidenceMeta } from '@/domain/evidence'
import {
  REPORT_CATEGORIES,
  reportStatusLabel,
  REPORT_STATUSES,
  type Issue,
  type ReportStore,
} from '@/domain/reports'
import { formatInstant, isoFromMs } from '@/lib/time'
import { Empty, OpsCard, Pill, SectionCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'

/** A saved file, shown from local storage. The preview URL is made fresh and revoked when it goes. */
export function EvidencePreview({ meta }: { meta: EvidenceMeta | Issue['attachments'][number] }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let made: string | null = null
    let live = true
    void loadBlob(meta.id)
      .then((b) => {
        if (!live) return
        if (!b) return setMissing(true)
        made = URL.createObjectURL(b)
        setUrl(made)
      })
      .catch(() => live && setMissing(true))
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [meta.id])
  if (missing) return <span className="text-xs">The saved file is no longer on this device.</span>
  if (!url) return <span className="text-xs text-ink-muted">Loading preview…</span>
  if (meta.type.startsWith('video/'))
    // The student's own evidence clip, played muted: there is no spoken content to caption.
    // oxlint-disable-next-line jsx-a11y/media-has-caption
    return (
      <video
        src={url}
        controls
        muted
        className="max-h-40 rounded-md"
        aria-label={`Preview of ${meta.name}`}
      />
    )
  return <img src={url} alt={`Preview of ${meta.name}`} className="max-h-40 rounded-md" />
}

/** Photo and video evidence with limits, validation, preview, removal and retry. Saved on this device only. */
export function EvidencePicker({
  value,
  onChange,
}: {
  value: EvidenceMeta[]
  onChange: (v: EvidenceMeta[]) => void
}) {
  const { newId, clock } = useServices()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const add = async (files: FileList | null) => {
    setError('')
    if (!files) return
    let list = value
    setBusy(true)
    for (const f of Array.from(files)) {
      try {
        const head = new Uint8Array(await f.slice(0, 16).arrayBuffer())
        const bad = validateEvidence(f, head, list.length)
        if (bad) {
          setError(bad)
          continue
        }
        list = [...list, await attach(f, newId, isoFromMs(clock.now().epochMilliseconds))]
        onChange(list)
      } catch (e) {
        setError(
          e instanceof Error
            ? `${e.message} Your other answers are kept. Try again.`
            : 'The file could not be saved.',
        )
      }
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Photo or video evidence (optional)</legend>
      <p className="text-xs text-ink-muted">
        Up to {EVIDENCE_LIMITS.maxFiles} files. JPEG, PNG, WebP, MP4 or WebM; videos up to 25 MB.
        Saved on this device only: nobody receives them.
      </p>
      <input
        className="w-full max-w-full text-sm"
        ref={input}
        type="file"
        multiple
        accept={EVIDENCE_LIMITS.types.join(',')}
        aria-label="Add photo or video"
        disabled={busy || value.length >= EVIDENCE_LIMITS.maxFiles}
        onChange={(e) => void add(e.target.files)}
      />
      {busy ? <output className="text-xs">Saving on this device…</output> : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {value.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2 text-sm"
          >
            <EvidencePreview meta={m} />
            <span>
              {m.name} · {(m.size / 1024 / 1024).toFixed(1)} MB · saved on this device
            </span>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void removeBlob(m.id).catch(() => undefined)
                onChange(value.filter((x) => x.id !== m.id))
              }}
            >
              Remove<span className="sr-only"> {m.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

export function ReportPage() {
  const { reports, newId } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const showOps = useAppStore((s) => s.showDemoOps)
  const [params] = useSearchParams()
  const { act, message } = useAction()
  const [store, setStore] = useState<ReportStore | null>(null)
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>(REPORT_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [contact, setContact] = useState('')
  const [files, setFiles] = useState<EvidenceMeta[]>([])
  const [error, setError] = useState('')
  const [opId] = useState(() => newId('op'))
  const from = params.get('from') ?? '/'
  useEffect(() => {
    let live = true
    const read = () => void reports.load().then((s) => live && setStore(s))
    read()
    const off = reports.subscribe(read)
    return () => {
      live = false
      off()
    }
  }, [reports])
  const mine = store?.issues.filter((i) => i.ownerProfileId === profileId) ?? []
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Report an issue"
        description="Tell us about a bug, wrong timetable or room data, a design problem or an idea. It is saved on this device with a status you can follow."
        badge={<Pill tone="demo">Local · not sent to developers</Pill>}
      />
      <SectionCard id="rp-form-h" title="New report">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            const r = await act(
              () =>
                reports.submit(profileId, {
                  category,
                  description,
                  steps,
                  contact,
                  route: from,
                  attachments: files,
                  opId,
                }),
              'Report recorded on this device.',
            )
            if (r.ok) {
              setDescription('')
              setSteps('')
              setFiles([])
            } else setError(r.error.message)
          }}
        >
          <Field label="Category">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="What happened?">
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={1000}
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <Field label="Steps to reproduce (optional)">
            {(a) => (
              <textarea
                {...a}
                rows={2}
                maxLength={1000}
                className={inputClass}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            )}
          </Field>
          <Field label="Contact (optional)">
            {(a) => (
              <input
                {...a}
                className={inputClass}
                maxLength={120}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            )}
          </Field>
          <p className="rounded-md bg-mist p-2 text-xs">
            Attached with the report: the screen you came from (
            <code className="break-all">{from}</code>). Your grades, attendance, mail and seating
            are never attached.
          </p>
          <EvidencePicker value={files} onChange={setFiles} />
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11 self-start">
            Save report
          </Button>
        </form>
      </SectionCard>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard id="rp-mine-h" title={`My reports (${mine.length})`}>
        {mine.length === 0 ? (
          <Empty>You have not filed a report.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((i) => (
              <li
                key={i.id}
                className="rounded-md border border-border p-3 text-sm"
                data-report={i.id}
              >
                <p>
                  <strong>{i.id}</strong> · {i.category} ·{' '}
                  <Pill>{reportStatusLabel[i.status]}</Pill>
                </p>
                <p>{i.description}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {i.attachments.map((a) => (
                    <li key={a.id}>
                      <EvidencePreview meta={a} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-muted">
                  {formatInstant(i.createdAt)} · from {i.route}
                </p>
                <ol className="mt-1 text-xs">
                  {i.history.map((h, n) => (
                    <li key={n}>
                      {formatInstant(h.at)} · {h.actor === 'student' ? 'You' : 'Simulated reviewer'}{' '}
                      · {reportStatusLabel[h.status]}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {showOps ? (
        <OpsCard id="ops-reports-h" title="Local Operations: report review" message="">
          <ul className="flex flex-col gap-2">
            {(store?.issues ?? []).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                {i.id} · {i.category} · {reportStatusLabel[i.status]}
                {REPORT_STATUSES.filter((s) => s !== i.status && s !== 'RECEIVED').map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(() => reports.review(i.id, s), `${i.id}: ${reportStatusLabel[s]}`)
                    }
                  >
                    {reportStatusLabel[s]}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
        </OpsCard>
      ) : null}
    </article>
  )
}
