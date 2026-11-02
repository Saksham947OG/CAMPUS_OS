import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/app/app-store'
import { useSharedState } from '@/app/shared-store'
import { startsIn } from '@/domain/mail-logic'
import { urgentSignal } from '@/selectors/mail'
import { useNow } from '@/hooks/use-now'

/**
 * "Urgent Campus Signal": a seat that arrived by simulated email for an exam starting within a day.
 * It appears only when such a seat really exists in the profile's own exam record, so it never
 * invents an urgency and never shows another student's seat.
 */
export function UrgentSignalBanner() {
  const shared = useSharedState((s) => s.shared)
  const profileId = useAppStore((s) => s.activeProfileId)
  const now = useNow()
  const sig = shared ? urgentSignal(shared, profileId, now.ms) : null
  if (!sig) return null
  return (
    <section
      aria-label="Urgent campus signal"
      className="rounded-lg border-2 border-terracotta bg-terracotta-tint p-4"
      data-testid="urgent-signal"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle className="size-4" aria-hidden="true" /> Urgent campus signal · simulated
        email, not an official allotment
      </p>
      <p className="mt-1 text-lg font-semibold text-ink">
        {sig.examName}: {sig.seat}
      </p>
      <p className="text-sm text-ink">This quiz {startsIn(sig.startMs, now.ms)}.</p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm font-medium">
        <Link to={`/academics/exams/${sig.examId}`} className="min-h-11 py-2 text-coffee underline">
          View my seat
        </Link>
        {sig.emailId ? (
          <Link
            to={`/notifications/mail/${sig.emailId}`}
            className="min-h-11 py-2 text-coffee underline"
          >
            View original mail
          </Link>
        ) : null}
      </div>
    </section>
  )
}
