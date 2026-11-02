import { useEffect, useState } from 'react'
import { useServices } from '@/app/services'
import { useAppStore } from '@/app/app-store'
/** Re-read all canonical sources on any service action; a failed source is visible, never a zero. */
export function useSourceAudit() {
  const services = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const [audit, setAudit] = useState<{
    checked: number
    failures: string[]
    activity: Record<string, number>
  }>({ checked: 0, failures: [], activity: {} })
  useEffect(() => {
    let active = true,
      revision = 0
    const update = async () => {
      const current = ++revision
      const results = await Promise.allSettled([
        services.campus.load(profileId),
        services.ess.load(),
        services.sports.load(),
        services.shared.load(),
        services.academics.load(),
        services.community.load(),
        services.classrooms.load(),
        services.chill.load(),
        services.admin.load(),
        services.mail.load(),
        services.meetings.load(),
      ])
      if (!active || current !== revision) return
      const labels = [
        'Calendar',
        'Campus Essentials',
        'Sports',
        'Exams',
        'Academics',
        'Community',
        'Classrooms',
        'Chill Spot',
        'Administration',
        'Campus Mail',
        'Meetings',
      ]
      const failures = results.flatMap((r, i) => (r.status === 'rejected' ? [labels[i]!] : []))
      const ess = results[1],
        sports = results[2],
        rooms = results[6],
        chill = results[7]
      setAudit({
        checked: results.length,
        failures,
        activity: {
          machines:
            ess?.status === 'fulfilled'
              ? 'reservations' in ess.value
                ? ess.value.reservations.filter((r) => r.ownerProfileId === profileId).length
                : 0
              : 0,
          parcels:
            ess?.status === 'fulfilled'
              ? 'parcels' in ess.value
                ? ess.value.parcels.filter(
                    (r) => r.recipientProfileId === profileId && r.state === 'collected',
                  ).length
                : 0
              : 0,
          gym:
            sports?.status === 'fulfilled'
              ? 'gymSessions' in sports.value
                ? sports.value.gymSessions.filter((r) => r.profileId === profileId).length
                : 0
              : 0,
          classrooms:
            rooms?.status === 'fulfilled'
              ? 'reservations' in rooms.value
                ? rooms.value.reservations.filter((r) => r.ownerProfileId === profileId).length
                : 0
              : 0,
          'chill-spot':
            chill?.status === 'fulfilled'
              ? 'orders' in chill.value
                ? chill.value.orders.filter((r) => r.ownerProfileId === profileId).length
                : 0
              : 0,
        },
      })
    }
    void update()
    const repos = [
      services.ess,
      services.sports,
      services.shared,
      services.academics,
      services.community,
      services.classrooms,
      services.chill,
      services.admin,
      services.mail,
      services.meetings,
    ]
    const unsub = repos.map((repo) => repo.subscribe(() => void update()))
    unsub.push(services.campus.subscribe(() => void update()))
    return () => {
      active = false
      unsub.forEach((fn) => fn())
    }
  }, [services, profileId])
  return audit
}
