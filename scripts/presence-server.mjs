// Optional shared anonymous-presence backend for a trusted local network / reverse proxy.
// No coordinates, names, grades or identity records are accepted or stored.
import http from 'node:http'
const sessions = new Map()
const facilities = new Set(['library', 'mess', 'gym', 'classrooms', 'laundry', 'cafe', 'campus'])
const ttl = 60000
const origins = new Set(
  (
    process.env.PRESENCE_ORIGINS ??
    'http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173'
  ).split(','),
)
const counts = () => {
  const now = Date.now()
  for (const [id, s] of sessions) if (s.expires <= now) sessions.delete(id)
  return Object.fromEntries(
    [...facilities].map((f) => [
      f,
      [...sessions.values()].filter((s) => s.facilityId === f).length,
    ]),
  )
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !origins.has(origin)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.url !== '/presence') {
    res.writeHead(404)
    res.end('{}')
    return
  }
  if (req.method === 'GET') {
    res.end(JSON.stringify({ counts: counts(), ttlSeconds: ttl / 1000 }))
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end('{}')
    return
  }
  try {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 2048) throw Error('Request too large')
    }
    const { sessionId, facilityId, present, ...rest } = JSON.parse(body)
    if (
      Object.keys(rest).length ||
      typeof sessionId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(sessionId) ||
      !facilities.has(facilityId) ||
      typeof present !== 'boolean'
    )
      throw Error('Invalid presence report')
    if (present) {
      if (!sessions.has(sessionId) && sessions.size >= 10000) throw Error('Server full')
      sessions.set(sessionId, { facilityId, expires: Date.now() + ttl })
    } else sessions.delete(sessionId)
    res.end(JSON.stringify({ counts: counts(), ttlSeconds: ttl / 1000 }))
  } catch {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Invalid presence report' }))
  }
})
server.listen(Number(process.env.PORT ?? 4180), process.env.PRESENCE_HOST ?? '127.0.0.1', () =>
  console.log('Presence server ready. Sessions expire after 60 seconds without a heartbeat.'),
)
