import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useServices } from '@/app/services'
import { facilities, boundaryState, distanceMetres } from './world'
import { Button } from '@/components/ui/button'
const configuration = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(20).max(1000),
  capacity: z.number().int().min(1).max(1000),
})
export function RealPresence() {
  const { storage } = useServices()
  const [place, setPlace] = useState('library')
  const [latitude, setLat] = useState('')
  const [longitude, setLon] = useState('')
  const [radius, setRadius] = useState('50')
  const [capacity, setCapacity] = useState('140')
  const [message, setMessage] = useState('Location is off. Configure a boundary before opting in.')
  const [tracking, setTracking] = useState(false)
  const [inside, setInside] = useState(false)
  const [endpoint, setEndpoint] = useState('')
  const [remote, setRemote] = useState<Record<string, number> | null>(null)
  const watch = useRef<number | null>(null),
    presence = useRef(false),
    publish = useRef<(on: boolean) => void>(() => {}),
    candidate = useRef({ value: '', count: 0 })
  const session = useRef(crypto.randomUUID())
  const stop = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    watch.current = null
    presence.current = false
    setTracking(false)
    setInside(false)
    candidate.current = { value: '', count: 0 }
    publish.current(false)
  }
  useEffect(
    () => () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
      publish.current(false)
    },
    [],
  )
  useEffect(() => {
    if (!tracking) return
    const hide = () => {
      if (document.hidden) {
        stop()
        setMessage('Tracking stopped when this page became hidden. Re-enable when you return.')
      }
    }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [tracking])
  useEffect(() => {
    if (!endpoint || !tracking) return
    const heartbeat = setInterval(() => publish.current(presence.current), 15000)
    return () => clearInterval(heartbeat)
  }, [tracking, endpoint])
  const start = () => {
    if (watch.current !== null) return
    const parsed = configuration.safeParse({
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius: Number(radius),
      capacity: Number(capacity),
    })
    if (latitude === '' || longitude === '' || !parsed.success) {
      setMessage('Enter valid coordinates, radius 20–1000 m, and capacity 1–1000.')
      return
    }
    if (!navigator.geolocation) {
      setMessage('This browser does not support location.')
      return
    }
    let url = ''
    if (endpoint) {
      try {
        const u = new URL(endpoint)
        if (
          u.protocol !== 'https:' &&
          !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
        )
          throw Error()
        url = u.href.replace(/\/$/, '')
      } catch {
        setMessage('Use an HTTPS presence server or http://localhost:4180.')
        return
      }
    }
    storage.write(`campusos:geofence:v1:${place}`, parsed.data)
    publish.current = (on) => {
      if (!url) return
      void fetch(url + '/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.current, facilityId: place, present: on }),
      })
        .then((r) => {
          if (!r.ok) throw Error()
          return r.json()
        })
        .then((data) => setRemote(data.counts))
        .catch(() => {
          setRemote(null)
          setMessage(
            'Shared server unavailable; shared count is unknown. Your local state is shown separately.',
          )
        })
    }
    const config = parsed.data
    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        const state = boundaryState(
          distanceMetres(position.coords, config),
          position.coords.accuracy,
          config.radius,
        )
        if (state === 'uncertain') {
          candidate.current = { value: '', count: 0 }
          presence.current = false
          setInside(false)
          publish.current(false)
          setMessage(
            'Location accuracy is insufficient or you are near the boundary. Check-in suspended until two accurate fixes confirm your location.',
          )
          return
        }
        candidate.current =
          candidate.current.value === state
            ? { value: state, count: candidate.current.count + 1 }
            : { value: state, count: 1 }
        if (candidate.current.count >= 2) {
          const on = state === 'inside'
          presence.current = on
          setInside(on)
          publish.current(on)
          setMessage(
            on
              ? 'Two accurate fixes confirm you are inside. Check-in active.'
              : 'Two accurate fixes confirm you are outside. Checked out.',
          )
        }
      },
      () => {
        stop()
        setMessage('Location denied or unavailable. No automatic check-in is active.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    setTracking(true)
    setMessage(
      'Awaiting two accurate location fixes. Coordinates stay on this device; only an anonymous session and facility ID reach your configured server.',
    )
  }
  const changePlace = (v: string) => {
    stop()
    setPlace(v)
    setLat('')
    setLon('')
    setRemote(null)
    setCapacity(String(facilities.find((f) => f.id === v)?.capacity ?? 100))
    const saved = storage.read(`campusos:geofence:v1:${v}`, configuration)
    if (saved.status === 'ok') {
      setLat(String(saved.value.latitude))
      setLon(String(saved.value.longitude))
      setRadius(String(saved.value.radius))
      setCapacity(String(saved.value.capacity))
    }
  }
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="font-semibold">Opt-in location check-in</h3>
      <p className="mt-1 text-sm text-ink-muted">
        GPS can be inaccurate indoors and cannot reliably distinguish nearby rooms. Tracking works
        only while this page is visible. Counted check-ins do not prove total occupancy or
        reservable capacity.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Facility
          <select
            disabled={tracking}
            value={place}
            onChange={(e) => changePlace(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-surface px-2"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {[
          ['Latitude', latitude, setLat],
          ['Longitude', longitude, setLon],
          ['Boundary radius (metres)', radius, setRadius],
          ['Reference capacity', capacity, setCapacity],
          ['Shared server URL (optional)', endpoint, setEndpoint],
        ].map(([label, value, set]) => (
          <label key={String(label)} className="flex flex-col gap-1 text-sm">
            {String(label)}
            <input
              disabled={tracking}
              className="min-h-11 min-w-0 rounded-md border border-border bg-surface px-3"
              value={String(value)}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={start} disabled={tracking}>
          Enable location check-in
        </Button>
        <Button
          variant="outline"
          disabled={!tracking}
          onClick={() => {
            stop()
            setMessage('Location sharing stopped and your session checked out.')
          }}
        >
          Stop and check out
        </Button>
      </div>
      <output aria-live="polite" className="mt-3 block text-sm">
        {message}
      </output>
      <p className="mt-2 text-sm">
        This device: {inside ? 'checked in' : 'not checked in'} · Shared count:{' '}
        {remote?.[place] ?? 'not connected'} · Reference capacity: {capacity}. Only opted-in
        sessions are counted; missing participation is unknown.
      </p>
    </div>
  )
}
