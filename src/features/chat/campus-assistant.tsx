import { Bot, ChevronRight, MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAdminState } from '@/app/admin-store'
import { useAppStore } from '@/app/app-store'
import { useSharedState } from '@/app/shared-store'
import { Button } from '@/components/ui/button'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { myRequests } from '@/selectors/admin'
import { SUGGESTIONS, answer, type Answer } from '@/selectors/assistant'

/** Anything (for example the top-bar button) opens the assistant by dispatching this event. */
export const OPEN_ASSISTANT_EVENT = 'campusos:open-assistant'

/**
 * The CampusOS Assistant (COS-CHAT-001): one bottom-right panel for the whole shell. It is deterministic
 * and local: it applies fixed rules to the active profile's records, makes no network request, uses no
 * key, never claims demo data is live or official, and never takes an action. It answers with a source
 * and a link to the screen that owns the information.
 */
export function CampusAssistant() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<readonly { question: string; answer: Answer }[]>([])
  const inputId = useId()
  const headingId = `assistant-h-${inputId}`
  const inputRef = useRef<HTMLInputElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const profileId = useAppStore((s) => s.activeProfileId)
  const shared = useSharedState((s) => s.shared)
  const admin = useAdminState((s) => s.admin)
  const { data, status } = useCampusData()
  const now = useNow()
  const disabled = status !== 'ready'

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_ASSISTANT_EVENT, show)
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, show)
  }, [])

  const close = () => {
    setOpen(false)
    launcher.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        launcher.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const ask = (raw: string) => {
    const clean = raw.trim()
    if (!clean || disabled) return
    const openRequests = admin ? myRequests(admin, profileId).filter((r) => r.open).length : 0
    setMessages((m) => [
      ...m,
      {
        question: clean,
        answer: answer(clean, {
          profileId,
          nowMs: now.ms,
          today: now.today,
          shared,
          data,
          openRequests,
        }),
      },
    ])
    setQuestion('')
  }

  return (
    <section
      className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6"
      aria-labelledby={open ? headingId : undefined}
      aria-label={open ? undefined : 'CampusOS Assistant'}
    >
      {open ? (
        <div className="w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-xl">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-5 text-teal" aria-hidden="true" />
              <div>
                <h2 id={headingId} className="font-semibold text-ink">
                  CampusOS Assistant
                </h2>
                <p className="text-xs text-ink-muted">
                  Demo assistant · uses recorded CampusOS data · not a language model
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Close CampusOS Assistant"
              onClick={close}
            >
              <X aria-hidden="true" />
            </Button>
          </header>
          <div
            className="max-h-80 space-y-3 overflow-y-auto p-4"
            aria-live="polite"
            data-testid="assistant-log"
          >
            {messages.length === 0 ? (
              <p className="rounded-lg bg-teal-tint p-3 text-sm text-ink">
                Ask me where to find something, what is scheduled today, or about a CampusOS
                service. I only read; I never book, approve or send anything.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={`${m.question}-${i}`} className="space-y-2">
                  <p className="ml-8 rounded-lg bg-ink px-3 py-2 text-sm text-surface">
                    {m.question}
                  </p>
                  <div className="rounded-lg bg-teal-tint p-3 text-sm text-ink">
                    <p>{m.answer.text}</p>
                    <p className="mt-1 text-xs text-ink-muted">Source: {m.answer.source}</p>
                    {m.answer.link ? (
                      <Link
                        className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold text-teal-strong underline underline-offset-2"
                        to={m.answer.link.to}
                        onClick={() => setOpen(false)}
                      >
                        {m.answer.link.label}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <ul
            className="flex gap-2 overflow-x-auto border-t border-border px-4 py-2"
            aria-label="Suggested questions"
          >
            {SUGGESTIONS.map((s) => (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-border px-3 text-xs text-ink hover:border-teal disabled:opacity-50"
                  onClick={() => ask(s)}
                  disabled={disabled}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              ask(question)
            }}
          >
            <label className="sr-only" htmlFor={inputId}>
              Ask CampusOS Assistant
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 text-sm text-ink"
              value={question}
              maxLength={200}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={disabled ? 'Loading records…' : 'Ask a question'}
              disabled={disabled}
            />
            <Button
              type="submit"
              size="icon"
              className="size-11"
              aria-label="Send question"
              disabled={disabled || !question.trim()}
            >
              <Send aria-hidden="true" />
            </Button>
          </form>
          <p className="border-t border-border px-4 py-2 text-xs text-ink-muted">
            Wrong answer?{' '}
            <Link
              to="/help/report?from=assistant"
              onClick={() => setOpen(false)}
              className="underline"
            >
              Report an issue
            </Link>
          </p>
        </div>
      ) : null}
      <Button
        ref={launcher}
        // On phones the top-bar button opens the assistant, so the floating one never covers the cart bar,
        // booking bars or bottom navigation. It appears there only while the panel is open, to close it.
        className={`min-h-11 rounded-full shadow-lg ${open ? '' : 'max-md:hidden'}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? headingId : undefined}
      >
        <MessageCircle aria-hidden="true" />
        {open ? 'Hide assistant' : 'Ask CampusOS'}
      </Button>
    </section>
  )
}
