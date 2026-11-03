import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { SCENARIOS, fixture, scenarioLabel, type Scenario } from '@/data/seeds/demo/mail-fixtures'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { OpsCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useMail } from './mail-hooks'

/**
 * The Mail operations view. A button here is the only way a message "arrives": nothing is fetched,
 * no account is connected, and no real push is sent. The lock-screen text below is a preview only.
 */
export function MailLab() {
  const { mail, repo, profileId } = useMail()
  const { act, message } = useAction()
  const [target, setTarget] = useState<string>('')
  const [preview, setPreview] = useState('')
  if (!mail) return null
  const who = target || profileId
  const key = mail.studentKeys[who]
  const send = (s: Scenario) =>
    void act(async () => {
      const r = await repo.receive(who === 'broadcast' ? null : who, fixture(s, key))
      setPreview(r.ok && r.value.alerted ? 'Quiz seating has been updated — open CampusOS' : '')
      return r
    }, r_done(s))
  return (
    <OpsCard id="ops-mail-h" title="Mail operations view" message={message}>
      <p className="text-xs">
        Each button delivers one synthetic message with a stable fake id. Replaying one is a true
        duplicate. The student key used is made up and belongs to the chosen mailbox.
      </p>
      <Field label="Deliver to mailbox">
        {(a) => (
          <select
            {...a}
            className={`${inputClass} w-72`}
            value={who}
            onChange={(e) => setTarget(e.target.value)}
          >
            {demoProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({mail.studentKeys[p.id] ?? 'no student key'})
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <Button
            key={s}
            variant={s === 'seat-v1' ? 'default' : 'outline'}
            className="min-h-11"
            onClick={() => send(s)}
          >
            {scenarioLabel[s]}
          </Button>
        ))}
      </div>
      {preview ? (
        <p
          className="rounded-md border border-border-strong bg-surface p-3 text-sm"
          data-testid="push-preview"
        >
          <strong>Lock-screen preview (simulated, nothing was sent):</strong> {preview}
          <span className="block text-xs text-ink-muted">
            Seat details stay inside the unlocked app by default.
          </span>
        </p>
      ) : null}
    </OpsCard>
  )
}

const r_done = (s: Scenario) => `${scenarioLabel[s]}: delivered.`
