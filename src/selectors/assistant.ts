import { academicRecords, attendanceRecords } from '@/data/seeds/demo/academic-records'
import { plan, quality, requiredSgpa } from '@/domain/academic-tools'
import type { SharedStore } from '@/domain/shared'
import { instantMs } from './now'
import { itemsInRange } from './occurrences'
import { isCancelled, isTimed } from './items'
import { examsFor, profileCourseIds, seatText, seatView } from './exams'
import type { ProfileData } from '@/domain/records'
import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * Campus AI, the honest local version: a deterministic helper over recorded CampusOS data. It matches a
 * few supported questions by keyword, reads the owning records and the shared calculators, and says so
 * when it cannot help. It is not a language model and is labelled as a demo assistant. It never
 * performs an action: a booking or request is only a link to the normal, validated screen.
 */
export interface Answer {
  text: string
  /** Where the answer came from, so it can be checked. */
  source: string
  link?: { to: string; label: string }
}

export interface AssistantContext {
  profileId: string
  nowMs: number
  today: DateOnly
  shared: SharedStore | null
  data: ProfileData | null
  openRequests?: number
}

export const SUGGESTIONS = [
  'What is on today?',
  'Show my tasks',
  'Where can I book a court?',
  'Is this live data?',
  'What is my next exam?',
  'Show my seating',
  'What SGPA do I need for a CGPA of 8?',
  'What happens if I miss the next class?',
  'Find a time for my project group',
  'Track my complaint',
  'What is for dinner?',
] as const

const has = (q: string, ...words: RegExp[]) => words.some((w) => w.test(q))

export function answer(raw: string, c: AssistantContext): Answer {
  const q = raw.toLowerCase()
  // The assistant only reads. Anything that would change a record goes to the normal screen, where you confirm it.
  if (
    has(
      q,
      /^\s*(please\s+|can you\s+|could you\s+|go ahead and\s+)?(book|reserve|approve|cancel|send|delete|submit|withdraw)\b/,
      /\b(and|then)\s+(approve|cancel|send|delete|submit|withdraw)\b/,
    )
  )
    return {
      text: 'I can’t book, approve, cancel or send anything for you. Those happen on their own screens, where you review and confirm them.',
      source: 'Demo assistant',
      link: { to: '/bookings/classrooms', label: 'Open Classrooms to book yourself' },
    }
  // Honest framing questions come first, so "is this real?" is never answered with a schedule.
  if (
    has(
      q,
      /\b(live|real|official|genuine|fake|sample|demo|authentic)\b|is this (data|accurate|true)/,
    )
  )
    return {
      text: 'CampusOS is an academic demonstration. Information is sample data or created in this browser; it is not an official campus system or a live service feed.',
      source: 'Demo labels',
      link: { to: '/settings#data-labels', label: 'View data labels' },
    }
  if (has(q, /find a time|meeting time|group (time|meeting)|schedule a meeting/))
    return {
      text: 'I can’t pick a time for you. Find a time compares everyone’s recorded schedules and shows up to three real options, then you review and confirm.',
      source: 'Availability engine (recorded schedules)',
      link: { to: '/calendar/find-a-time', label: 'Open Find a time' },
    }
  if (has(q, /seat|seating/)) {
    const exams = c.shared ? examsFor(c.shared, c.data ? profileCourseIds(c.data) : new Set()) : []
    const upcoming = exams.filter(
      (e) =>
        (e.startTime
          ? instantMs(e.date, e.startTime as LocalTime)
          : instantMs(e.date, '23:59' as LocalTime)) >= c.nowMs,
    )
    const found = upcoming
      .map((e) => ({
        e,
        v: c.shared ? seatView(c.shared, c.profileId, e.id) : { kind: 'none' as const },
      }))
      .find((x) => x.v.kind === 'seat')
    if (found && found.v.kind === 'seat')
      return {
        text: `${found.e.name}: ${seatText(found.v.seat)}. ${found.v.seat.sourceLabel}.`,
        source: 'Your exam record',
        link: { to: `/academics/exams/${found.e.id}`, label: 'Open my seat' },
      }
    return {
      text: 'No seating is recorded for you yet. I don’t guess a seat.',
      source: 'Your exam records',
      link: { to: '/academics/exams', label: 'Open exams' },
    }
  }
  if (has(q, /next exam|exam schedule|when is my exam|exam/)) {
    const exams = c.shared ? examsFor(c.shared, c.data ? profileCourseIds(c.data) : new Set()) : []
    const next = exams.find((e) => e.date >= c.today)
    return next
      ? {
          text: `${next.name} on ${next.date}${next.startTime ? ` at ${next.startTime}` : ' (start time not provided)'}.`,
          source: 'Exam records (demo)',
          link: { to: `/academics/exams/${next.id}`, label: 'Open the exam' },
        }
      : {
          text: 'No upcoming exam is recorded for your courses.',
          source: 'Exam records (demo)',
          link: { to: '/academics/exams', label: 'Open exams' },
        }
  }
  if (
    has(
      q,
      /\b(my|upcoming|active)\b.*\b(bookings?|reservations?)\b|\bhow many (bookings?|reservations?)\b/,
    )
  ) {
    const act =
      c.data?.bookings.filter((b) => b.status === 'active' && (b.endDate ?? b.date) >= c.today)
        .length ?? 0
    return {
      text: `${act} upcoming active booking${act === 1 ? '' : 's'} are recorded for you. A booking is a record, not proof anyone is there.`,
      source: 'Your bookings',
      link: { to: '/bookings/my', label: 'Open My bookings' },
    }
  }
  if (has(q, /sgpa|cgpa|gpa|grade/)) {
    const rec = academicRecords[c.profileId]
    const target = Number(/(\d+(\.\d+)?)/.exec(q.replace(/sgpa|cgpa/g, ''))?.[1] ?? 8)
    if (!rec)
      return {
        text: 'No grades are recorded for this profile, so I can’t calculate.',
        source: 'Demo grade records',
      }
    const q0 = quality(rec.past.flatMap((s) => s.courses))
    if (!q0.ok || q0.value.credits === 0)
      return { text: 'No finalized credits are recorded.', source: 'Demo grade records' }
    const credits = rec.current.courses.reduce((a, x) => a + x.credits, 0)
    const r = requiredSgpa(target, q0.value.points / q0.value.credits, q0.value.credits, credits)
    if (!r.ok) return { text: r.reason, source: 'Shared GPA calculator' }
    return {
      text:
        r.value.feasibility === 'notAchievable'
          ? `A CGPA of ${target} is not achievable with ${credits} credits on the demo scale.`
          : `About ${r.value.required.toFixed(2)} SGPA over ${credits} credits would reach a CGPA of ${target} (demo scale, arithmetic only).`,
      source: 'Shared GPA calculator · demo grade scale',
      link: { to: '/academics/grades', label: 'Open Grades & GPA' },
    }
  }
  if (has(q, /miss|attendance|skip|bunk/)) {
    const list = attendanceRecords[c.profileId]
    const first = list?.[0]
    if (!first)
      return {
        text: 'No attendance sessions are recorded for this profile.',
        source: 'Attendance records (demo)',
      }
    const p = plan({ attended: first.attended, held: first.held, target: first.target })
    if (!p.ok) return { text: p.reason, source: 'Shared attendance calculator' }
    const after = ((100 * first.attended) / (first.held + 1)).toFixed(1)
    return {
      text: `${first.code}: ${p.value.current?.toFixed(1)}% now against a demo target of ${Math.round(first.target * 100)}%. Missing the next session would make it ${after}%. ${p.value.meetsTarget ? 'It meets the configured target today.' : 'It is below the target today.'} Attendance is not exam eligibility.`,
      source: 'Shared attendance calculator · demo counts',
      link: { to: '/academics/attendance', label: 'Open Attendance planner' },
    }
  }
  if (has(q, /\btoday\b|schedule|\bclass(es)?\b|calendar|what.?s on/)) {
    const day =
      c.data && c.today
        ? itemsInRange(c.data, c.today, c.today).filter(
            (i) => isTimed(i) && !isCancelled(i) && i.blocksTime,
          )
        : []
    const first = day[0]
    return first && first.time.kind === 'timed'
      ? {
          text: `Today you have ${day.length} timed commitment${day.length === 1 ? '' : 's'}; the first is ${first.title} at ${first.time.start}. The Calendar has the complete schedule.`,
          source: 'Your Calendar records',
          link: { to: `/calendar?view=day&date=${c.today}`, label: 'Open today in Calendar' },
        }
      : {
          text: 'No timed commitment is recorded for you today in the records loaded for this profile. That is not a promise that you are free.',
          source: 'Your Calendar records',
          link: { to: `/calendar?view=day&date=${c.today}`, label: 'Open Calendar' },
        }
  }
  if (has(q, /\btasks?\b|deadline|assignment|\bdue\b|to.?do/)) {
    const open = c.data?.tasks.filter((x) => x.state !== 'personallyCompleted') ?? []
    const next = open
      .filter((x) => x.dueDate)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0]
    return next
      ? {
          text: `You have ${open.length} open personal task${open.length === 1 ? '' : 's'}. The next dated one is “${next.title}”, due ${next.dueDate}. A personal checkmark is not an official submission.`,
          source: 'Your tasks',
          link: { to: '/calendar?view=agenda&panel=tasks', label: 'Open tasks' },
        }
      : {
          text: 'There are no open personal tasks with a due date in the records loaded for this profile.',
          source: 'Your tasks',
          link: { to: '/calendar?view=agenda&panel=tasks', label: 'Open tasks' },
        }
  }
  if (
    has(q, /court|gym|badminton|sport|library|music|chill zone|classroom|study room/) &&
    !has(q, /fixture|team/)
  )
    return {
      text: 'Bookings holds the local demonstration flows for sports, study spaces and classrooms. Availability and confirmations there are not live campus data.',
      source: 'Bookings (demo)',
      link: { to: '/bookings', label: 'Open Bookings' },
    }
  if (has(q, /laundry|parcel|cafe|café|chill spot|\bservices?\b/))
    return {
      text: 'Campus Services brings together Chill Spot, Laundry, Mess and Parcels. Each uses clearly labelled demo records, not provider or courier integrations.',
      source: 'Services (demo)',
      link: { to: '/services', label: 'Open Campus Services' },
    }
  if (has(q, /course|faculty|mentor|academic|professor/))
    return {
      text: 'Academics includes course material, exams, faculty meeting requests, grades and attendance planners and mentorship as local demonstration workflows.',
      source: 'Academics (demo)',
      link: { to: '/academics', label: 'Open Academics' },
    }
  if (has(q, /club|community|lost|found|fixture|committee/))
    return {
      text: 'Community includes demonstration flows for clubs, Lost & Found and sports teams and fixtures.',
      source: 'Community (demo)',
      link: { to: '/community', label: 'Open Community' },
    }
  if (has(q, /administration|complaint|report|leave|ticket|track/))
    return {
      text: `${c.openRequests ?? 0} open request${c.openRequests === 1 ? '' : 's'} are recorded for you. Statuses come from the demo simulator, not a real office.`,
      source: 'Your requests',
      link: { to: '/administration/requests', label: 'Open My requests' },
    }
  if (has(q, /dinner|lunch|breakfast|menu|mess/))
    return {
      text: 'The menu lives in Mess, and I won’t guess it here.',
      source: 'Mess (owner of the menu)',
      link: { to: '/services/mess', label: 'Open Mess' },
    }
  return {
    text: 'I can’t answer that yet. I can help with finding a group time, your next exam and seat, bookings, SGPA targets, attendance, your requests and the menu.',
    source: 'Demo assistant',
  }
}
