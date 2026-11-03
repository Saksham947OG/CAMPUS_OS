import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useClassroomState } from '@/app/classrooms-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'
import { roomsInUse } from '@/selectors/classrooms'
import { advanceWorld, facilities, initialWorld } from './world'
import { WorldContext, type FacilityLoad, type WorldValue } from './use-campus-world'

/** Which row of the owner capacity table describes each simulated place. */
const CAPACITY_KEY: Record<string, string | undefined> = {
  library: 'library',
  mess: 'mess',
  gym: 'gym',
  classrooms: 'classroom',
  laundry: 'laundry',
  cafe: 'chillSpot',
}

/** The visible 300-student simulation (DEC-159), shared by the strip and the Services capacity board. */
export function CampusWorldProvider({ children }: { children: ReactNode }) {
  const { sourceData } = useServices()
  const [world, setWorld] = useState(initialWorld)
  const [paused, setPaused] = useState(false)
  const tick = useRef(0)
  const now = useNow()
  const classrooms = useClassroomState((s) => s.classrooms)
  useEffect(() => {
    if (paused || !sourceData) return
    const interval = setInterval(() => {
      if (!document.hidden) setWorld((w) => advanceWorld(w, ++tick.current))
    }, 8000)
    return () => clearInterval(interval)
  }, [paused, sourceData])
  const value = useMemo<WorldValue | null>(() => {
    if (!sourceData) return null
    const rooms = classrooms ? roomsInUse(classrooms, now.today, now.minutes) : null
    const loads = facilities.map((f, i): FacilityLoad => {
      const people = world.filter((p) => p.place === i).length
      const useRooms = f.id === 'classrooms' && rooms !== null
      return {
        id: f.id,
        label: useRooms ? 'Classrooms booked' : f.label,
        icon: f.icon,
        path: f.path,
        count: useRooms ? rooms.inUse : people,
        capacity: useRooms ? rooms.total : f.capacity,
        unit: useRooms ? 'rooms' : f.id === 'laundry' ? 'machines' : 'people',
        capacityKey: CAPACITY_KEY[f.id],
        simulated: !useRooms,
      }
    })
    return { world, loads, paused, setPaused }
  }, [sourceData, world, classrooms, now.today, now.minutes, paused])
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
}
