import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { sourceLibrary } from '@/data/campus/source-library'
import { sourceGaps } from '@/data/campus/evidence'
import { curriculum, MANUAL } from '@/data/campus/catalogue'
import { useSourceAudit } from './use-source-audit'

export function SourcesPage() {
  const [query, setQuery] = useState('')
  const audit = useSourceAudit()
  const files = sourceLibrary.filter((s) =>
    `${s.title} ${s.summary} ${s.text}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <article className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="Data & Sources"
        description="Every supplied file, what it powers, and what still needs confirmation. Reference week: November 2–8, 2026."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/" className="text-coffee underline">
          Dashboard
        </Link>
        <Link to="/time-tax" className="text-coffee underline">
          Time Tax
        </Link>
        <Link to="/academics" className="text-coffee underline">
          Academics
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Source files', sourceLibrary.length],
          ['App sources read', `${audit.checked - audit.failures.length}/${audit.checked}`],
          ['Gaps / conflicts', sourceGaps.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-border-strong bg-mist p-3 text-sm">
        Supplied data comes from your documents. Adapted dates are planning references. Illustrative
        entries fill missing operational details. Profile switching changes the view; it is not
        authentication. Records saved here stay on this device.
      </p>
      <section aria-labelledby="source-gaps">
        <h2 id="source-gaps" className="font-display text-xl font-semibold">
          Needs confirmation
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {sourceGaps.map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-surface p-3">
              <h3 className="font-semibold">{g.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{g.detail}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="source-files">
        <h2 id="source-files" className="font-display text-xl font-semibold">
          Source register · all {sourceLibrary.length} files
        </h2>
        <label className="mt-3 block text-sm font-medium" htmlFor="source-search">
          Search source files and extracted text
        </label>
        <input
          id="source-search"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface p-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. attendance, lunch, French, grade scale"
        />
        <ul className="mt-3 grid gap-3">
          {files.map((s) => (
            <li
              key={s.id}
              id={s.id}
              className="scroll-mt-24 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <span className="rounded-full bg-mist px-2 py-1 text-xs">
                  {s.status === 'protected'
                    ? 'Protected access needed'
                    : s.status === 'adapted'
                      ? 'Dates adapted'
                      : s.status === 'duplicate'
                        ? 'Duplicate'
                        : 'Imported'}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{s.summary}</p>
              {s.text !== s.summary ? (
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-coffee">
                    Read extracted source
                  </summary>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-mist p-3 font-sans text-sm">
                    {s.text}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        {!files.length ? <output>No source matches your search.</output> : null}
      </section>
      <section id="curriculum" className="scroll-mt-24" aria-labelledby="curriculum-title">
        <h2 id="curriculum-title" className="font-display text-xl font-semibold">
          BMS curriculum · all eight semesters
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {MANUAL}. Differences in the older screenshots are flagged above.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {Object.entries(curriculum).map(([semester, courses]) => (
            <div key={semester} className="rounded-lg border border-border bg-surface p-4">
              <h3 className="font-semibold">
                Semester {semester} · {courses.reduce((sum, c) => sum + c.credits, 0)} credits
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {courses.map((c) => (
                  <li key={c.code} className="flex justify-between gap-3">
                    <span>{c.name}</span>
                    <span>{c.credits}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">BMS office · supplied research</h2>
        <p className="mt-2 text-sm">
          Paonta Sahib temporary campus · Phone: 01704-277313 / 9950606596. The research lists
          ugadmissions@iimsirmaur.ac.in, bmsvlmchair@iimsirmaur.ac.in and
          bmsvlmoffice@iimsirmaur.ac.in; on-campus routing requires confirmation. Office hours and
          room were not supplied.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Chill Spot menu photographs</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Prices transcribed into ordering. Current stock and unlabelled drink-size variants need
          confirmation.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <img
            src="/campus/chill-spot-food-menu.jpg"
            alt="Supplied Chill Spot food menu board"
            loading="lazy"
            className="w-full rounded-lg"
          />
          <img
            src="/campus/chill-spot-drinks-menu.jpg"
            alt="Supplied Chill Spot drinks menu board"
            loading="lazy"
            className="w-full rounded-lg"
          />
        </div>
      </section>
    </article>
  )
}
