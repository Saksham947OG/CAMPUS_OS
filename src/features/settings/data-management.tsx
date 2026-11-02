import { RotateCcw } from 'lucide-react'
import { useServices } from '@/app/services'
import { DataModeBadge } from '@/components/data-mode-badge'
import { useConfirm } from '@/components/confirm-context'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { resetDemoData } from '@/data/reset'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { useCampusData } from '@/hooks/use-campus-data'

/** Counts of the records this profile can see, by origin — a plain, factual "what is this data?" view. */
export function DataSources() {
  const { data } = useCampusData()
  const provenances = [
    ...data.events,
    ...data.series,
    ...data.exceptions,
    ...data.deadlines,
    ...data.tasks,
    ...data.focusBlocks,
    ...data.birthdays,
    ...data.mess,
    ...data.bookings,
    ...data.announcements,
    ...data.courses,
  ].map((r) => r.provenance.dataMode)
  const count = (m: string) => provenances.filter((p) => p === m).length
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {(['provided', 'demoSeed', 'userCreated'] as const).map((m) => (
          <li key={m} className="flex items-center gap-3">
            <span className="w-32 shrink-0">
              <DataModeBadge mode={m} />
            </span>
            <span>
              {count(m)} record{count(m) === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      {count('provided') === 0 ? (
        <p>
          No supplied data has been imported yet. Everything shown as sample data is fictional and
          is not an institutional record.
        </p>
      ) : null}
      {data.importWarnings.length > 0 ? (
        <div>
          <p className="font-medium text-ink">Records that were not shown</p>
          <ul className="list-disc pl-5">
            {data.importWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No import warnings.</p>
      )}
    </div>
  )
}

/** Reset demo: separate from "Reset layout" and "Clear filters", always confirmed, never automatic. */
export function ResetDemo() {
  const services = useServices()
  const confirm = useConfirm()
  const toast = useToast()

  const reset = async () => {
    const choice = await confirm({
      title: 'Reset all reference data on this device?',
      description: (
        <>
          <p>
            This restores the sample data and removes, for <strong>every</strong> persona on this
            device:
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>events, recurring events and occurrence changes you created</li>
            <li>tasks, checklists, focus blocks and birthday reminders you created or edited</li>
            <li>your reminder settings and reminder inbox</li>
            <li>demo café orders, carts and the simulated café state</li>
            <li>Sports bookings, waitlists, gym check-ins and equipment reports</li>
            <li>Leave requests, complaints and teaching-aid reports, with their histories</li>
            <li>Simulated Campus Mail messages and the seats they produced</li>
            <li>App issue reports you filed</li>
            <li>Group meetings, invitations and time polls</li>
            <li>Classroom reservations, requests and simulated closures</li>
            <li>
              Lost &amp; Found reports and claims, followed clubs, sports teams and join requests
            </li>
            <li>
              Faculty, office and club meeting requests, project groups and mentorship invitations
            </li>
            <li>Demo exam seating and your saved Time Tax what-if scenarios</li>
            <li>
              Campus Essentials demo records: laundry loads, machine reservations, mess check-ins
              and feedback, the illustrative fee and parcels
            </li>
            <li>saved layouts, calendar views and filters</li>
          </ul>
          <p className="mt-2">It cannot be undone. Nothing outside this browser is affected.</p>
        </>
      ),
      confirmLabel: 'Reset reference data',
      danger: true,
    })
    if (choice !== 'confirm') return
    await resetDemoData(
      demoProfiles,
      services.campus,
      services.prefs,
      services.chill,
      services.ess,
      services.sports,
      services.admin,
      services.shared,
      services.academics,
      services.community,
      services.classrooms,
      services.mail,
      services.meetings,
      services.reports,
    )
    demoProfiles.forEach((p) => services.observations.reset(p.id))
    toast.notify('success', 'Reference data was reset on this device.')
  }

  return (
    <div className="flex flex-col gap-3">
      <p>
        Use this to return the starting dataset to its starting state. It is different from “Reset
        layout” on Home or “Clear filters” in the Calendar, which never delete anything you created.
      </p>
      <Button
        variant="outline"
        className="min-h-11 gap-2 self-start border-danger text-danger"
        onClick={() => void reset()}
      >
        <RotateCcw aria-hidden="true" /> Reset reference data…
      </Button>
    </div>
  )
}
