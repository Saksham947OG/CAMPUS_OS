import type { ProfileData } from '@/domain/records'
import type { WorkspaceStore } from '@/domain/workspace'
import { addDays, formatTime, timeToMinutes, type DateOnly, type LocalTime } from '@/lib/time'
import { isCancelled, isTimed } from './items'
import { instantMs } from './now'
import { itemsOnDate } from './occurrences'
import { assignedTo, nameOf, readablePages, threadsFor, upcomingMeetings } from './workspace'
import type { Profile } from '@/domain/profile'
import { calendarLink } from '@/features/calendar/calendar-url'

/** The afternoon window in which CampusOS raises live alerts: 4:00 pm to 5:30 pm, campus time. */
export const ALERT_WINDOW = { from: '16:00' as LocalTime, to: '17:30' as LocalTime }

export interface LiveAlert {
  key: string
  atMs: number
  title: string
  body: string
  href: string
}

const inWindow = (t: string) =>
  timeToMinutes(t as LocalTime) >= timeToMinutes(ALERT_WINDOW.from) &&
  timeToMinutes(t as LocalTime) <= timeToMinutes(ALERT_WINDOW.to)

/**
 * Alerts for one person today: a heads-up 15 minutes before anything on their calendar that starts in the
 * window, and what is waiting on them in shared projects (an open decision, a due task, a reply, a vote, a
 * review). Each is true of the records at that moment. Only alerts whose time has come are returned.
 */
export function liveAlerts(i: {
  data: ProfileData
  ws: WorkspaceStore
  profiles: readonly Profile[]
  profileId: string
  today: DateOnly
  nowMs: number
}): LiveAlert[] {
  const { data, ws, profileId, today, nowMs } = i
  const out: LiveAlert[] = []
  for (const item of itemsOnDate(data, today)) {
    if (!isTimed(item) || isCancelled(item) || item.time.kind !== 'timed') continue
    const start = timeToMinutes(item.time.start)
    const lead = start - 15
    const leadTime = `${String(Math.floor(lead / 60)).padStart(2, '0')}:${String(lead % 60).padStart(2, '0')}`
    if (!inWindow(leadTime) && !inWindow(item.time.start)) continue
    out.push({
      key: `live|${profileId}|${today}|start|${item.key}`,
      atMs: instantMs(today, leadTime as LocalTime),
      title: `${item.title} starts in 15 minutes`,
      body: `${formatTime(item.time.start)}${item.location ? ` · ${item.location}` : ''}`,
      href: calendarLink({ date: today, event: item.key }),
    })
  }
  // Work in the shared projects that is waiting on this person, each raised at its own time in the window.
  const at = (hhmm: string) => instantMs(today, hhmm as LocalTime)
  const spaces = new Set(
    ws.spaces
      .filter((s) =>
        ws.members.some((m) => m.spaceId === s.id && m.userId === profileId && !m.invitation),
      )
      .map((s) => s.id),
  )
  const projects = ws.projects.filter((p) => spaces.has(p.spaceId))
  const pids = new Set(projects.map((p) => p.id))
  const open = ws.decisions.find((d) => pids.has(d.projectId) && !d.outcome)
  if (open)
    out.push({
      key: `live|${profileId}|${today}|decision|${open.id}`,
      atMs: at('16:10'),
      title: 'A decision is waiting for your group',
      body: `“${open.question}” in ${projects.find((p) => p.id === open.projectId)?.title}`,
      href: `/workspace/projects/${open.projectId}?tab=decisions`,
    })
  const task = assignedTo(ws, profileId).find((x) => x.dueDate && x.dueDate <= addDays(today, 1))
  if (task)
    out.push({
      key: `live|${profileId}|${today}|task|${task.id}`,
      atMs: at('16:25'),
      title: task.dueDate === today ? 'A team task is due today' : 'A team task is due tomorrow',
      body: `“${task.title}”`,
      href: `/workspace/projects/${task.projectId}?tab=tasks`,
    })
  for (const page of readablePages(ws, profileId).filter(
    (p) => p.projectId && pids.has(p.projectId),
  )) {
    const thread = threadsFor(ws, page).find(
      (th) => !th.root.resolvedAt && (th.replies.at(-1) ?? th.root).authorId !== profileId,
    )
    if (!thread) continue
    out.push({
      key: `live|${profileId}|${today}|thread|${thread.root.id}`,
      atMs: at('16:40'),
      title: `${nameOf(ws, i.profiles, (thread.replies.at(-1) ?? thread.root).authorId)} is waiting for your reply`,
      body: `On “${page.title}”: ${(thread.replies.at(-1) ?? thread.root).body.slice(0, 80)}`,
      href: `/workspace/pages/${page.id}`,
    })
    break
  }
  const poll = ws.polls.find(
    (p) =>
      pids.has(p.projectId) &&
      p.status === 'open' &&
      p.voters.some((v) => v.userId === profileId) &&
      !p.votes.some((v) => v.userId === profileId),
  )
  if (poll)
    out.push({
      key: `live|${profileId}|${today}|poll|${poll.id}`,
      atMs: at('16:55'),
      title: 'A meeting poll needs your vote',
      body: `“${poll.title}”: ${poll.candidates.length} times to choose from`,
      href: `/workspace/projects/${poll.projectId}?tab=calendar`,
    })
  const review = ws.reviews.find((r) => r.reviewerId === profileId && r.state === 'requested')
  if (review) {
    const page = ws.pages.find((p) => p.id === review.pageId)
    if (page)
      out.push({
        key: `live|${profileId}|${today}|review|${review.id}`,
        atMs: at('17:10'),
        title: 'A review is waiting for you',
        body: `“${page.title}”${review.dueDate ? `, due ${review.dueDate}` : ''}`,
        href: `/workspace/pages/${page.id}`,
      })
  }
  const next = upcomingMeetings(ws, profileId, today).find(
    (m) => m.date === today && timeToMinutes(m.start) > timeToMinutes('17:30' as LocalTime),
  )
  if (next)
    out.push({
      key: `live|${profileId}|${today}|meeting|${next.id}`,
      atMs: at('17:20'),
      title: `${next.title} is later today`,
      body: `${formatTime(next.start)} to ${formatTime(next.end)}`,
      href: `/workspace/projects/${next.projectId}?tab=calendar`,
    })
  return out.filter((a) => a.atMs <= nowMs).sort((a, b) => a.atMs - b.atMs)
}
