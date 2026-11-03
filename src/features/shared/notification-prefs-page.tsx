import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { usePrefs } from '@/hooks/use-prefs'
import { categoryName, NOTIFICATION_CATEGORIES } from '@/domain/shared'
import { categoryOf, isHiddenByMute } from '@/selectors/notifications'
import { Link } from 'react-router'
import { Loading, Pill, SectionCard } from '../essentials/ess-common'

export function NotificationPrefsPage() {
  const prefs = usePrefs('notificationPrefs')
  const inbox = usePrefs('notifications')
  if (!prefs.ready || !inbox.ready) return <Loading />
  const muted = prefs.value.muted
  const toggle = (c: (typeof NOTIFICATION_CATEGORIES)[number]) =>
    void prefs.update((p) => ({
      ...p,
      muted: p.muted.includes(c) ? p.muted.filter((x) => x !== c) : [...p.muted, c],
    }))
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Notification preferences"
        description="Choose which kinds of in-app message you see. These settings are saved for this persona on this device."
        badge={<Pill tone="demo">In-app only · no email, SMS or push</Pill>}
      />
      <SectionCard id="np-rules-h" title="How muting works">
        <ul className="list-disc pl-5">
          <li>
            Muting a category hides its <strong>standard and optional</strong> messages from your
            inbox and the unread count.
          </li>
          <li>
            <strong>Important and critical</strong> messages always stay visible, such as exam
            changes, leave decisions and changes to your own bookings.
          </li>
          <li>
            Nothing is deleted: unmuting brings every hidden message back, and the underlying
            records are never changed.
          </li>
          <li>
            Messages appear only while CampusOS is open. Nothing is sent by email, SMS, WhatsApp or
            phone push.
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          Which messages count as critical is a default setting, not a campus policy.
        </p>
      </SectionCard>
      <SectionCard id="np-cats-h" title="Categories">
        <ul className="flex flex-col gap-2">
          {NOTIFICATION_CATEGORIES.map((c) => {
            const hidden = inbox.value.items.filter(
              (n) => categoryOf(n) === c && isHiddenByMute(n, { schemaVersion: 1, muted: [c] }),
            ).length
            return (
              <li
                key={c}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="flex min-h-11 items-center gap-3">
                  <input
                    id={`mute-${c}`}
                    type="checkbox"
                    className="size-5"
                    checked={!muted.includes(c)}
                    onChange={() => toggle(c)}
                  />
                  <label htmlFor={`mute-${c}`}>
                    <span className="font-medium">{categoryName[c]}</span>
                    <span className="block text-xs text-ink-muted">
                      {muted.includes(c)
                        ? `Muted: ${hidden} standard or optional ${hidden === 1 ? 'message is' : 'messages are'} hidden`
                        : 'Showing everything'}
                    </span>
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => void prefs.reset()}>
            Show every category again
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link to="/notifications">Back to the inbox</Link>
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Reminder timing for the Calendar is set in Settings, separately.
        </p>
      </SectionCard>
    </article>
  )
}
