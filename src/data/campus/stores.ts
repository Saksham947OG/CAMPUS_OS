import type { EssStore } from '@/domain/ess'
import type { SportsStore } from '@/domain/sports'
import type { AcademicsStore } from '@/domain/academics'
import type { CommunityStore, Club } from '@/domain/community'
import type { SharedStore } from '@/domain/shared'
import type { ClassroomStore } from '@/domain/classrooms'
import { initialEssStore } from '@/data/seeds/demo/ess-data'
import { initialSportsStore } from '@/data/seeds/demo/sports-data'
import { initialAcademicsStore } from '@/data/seeds/demo/academics-data'
import { initialCommunityStore } from '@/data/seeds/demo/community-data'
import { initialSharedStore } from '@/data/seeds/demo/shared-data'
import { initialClassroomStore } from '@/data/seeds/demo/classroom-data'
import { initialChillStore, emptyChillStore } from '@/data/seeds/demo/chill-data'
import { initialMailStore } from '@/data/seeds/demo/mail-data'
import { initialAdminStore } from '@/data/seeds/demo/admin-data'
import { buildCampusDataset, currentClasses } from './dataset'
import {
  campusProfiles,
  courseId,
  curriculum,
  supplied,
  illustrative,
  t,
  MANUAL,
  TIMETABLE,
  proposedEvents,
  CLUB_CALENDAR,
} from './catalogue'

export const SOURCE_AS_OF = '2026-11-02T12:30:00Z'
const NOW = Date.parse(SOURCE_AS_OF)
const source = 'Illustrative service scenario · supplied personas; verify current status'
const audit = (entityId: string) => [
  {
    id: `${entityId}-import`,
    entityId,
    actorKind: 'import' as const,
    action: 'IMPORTED_SCENARIO',
    at: SOURCE_AS_OF,
    dataMode: 'demoSeed' as const,
    note: 'Persona-based illustrative activity, not a provider update.',
  },
]

export function campusEss(): EssStore {
  const s = initialEssStore(NOW)
  s.machines = s.machines.slice(0, 2).map((m, i) => ({
    ...m,
    label: `Hostel washer ${i + 1}`,
    location: 'Hostel laundry area',
    operationalStatus: 'working',
    physicalStatus: 'unknown',
    sourceLabel: 'Persona chart: two washers; operating status illustrative',
    provenance: illustrative('Persona chart · two washers; current state unknown'),
  }))
  s.loads = campusProfiles.map((p, i) => ({
    id: `campus-load-${p.id}`,
    ownerProfileId: p.id,
    reference: `LAUNDRY-${i + 1}`,
    handedOverDate: '2026-11-02' as EssStore['loads'][number]['handedOverDate'],
    itemCount: 6 + i,
    collectionPoint: 'Hostel laundry collection point (illustrative)',
    stage: i === 2 ? 'readyForCollection' : 'processing',
    delayFlag: false,
    discrepancyFlag: false,
    underReview: false,
    expectedReturnDate: '2026-11-03' as EssStore['loads'][number]['handedOverDate'],
    expectedReturnConfidence: 'tentative',
    studentReportedCollected: false,
    cancelled: false,
    createdAt: SOURCE_AS_OF,
    updatedAt: SOURCE_AS_OF,
    version: 1,
    provenance: illustrative(source),
    history: audit(`campus-load-${p.id}`),
  }))
  s.parcels = campusProfiles.map((p, i) => ({
    id: `campus-parcel-${p.id}`,
    recipientProfileId: p.id,
    collectionPoint: 'Guard room',
    referenceSuffix: `P0${i + 1}`,
    loggedAt: SOURCE_AS_OF,
    state: 'logged',
    version: 1,
    updatedAt: SOURCE_AS_OF,
    provenance: illustrative(
      'Parcel collection from Aanya persona; parcel arrival is illustrative',
    ),
    history: audit(`campus-parcel-${p.id}`),
  }))
  return s
}
export function campusSports(): SportsStore {
  const s = initialSportsStore(NOW)
  s.resources = s.resources.map((r) => ({
    ...r,
    label: r.label
      .replace(/^Demo /, '')
      .replace('Demo', '')
      .trim(),
    location: r.activity === 'gym' ? 'Campus gym' : 'Campus facility · location to confirm',
    sourceLabel:
      r.activity === 'gym'
        ? 'Owner-supplied 06:00–22:00 · 30-minute slots'
        : r.activity === 'library'
          ? 'Persona chart: library capacity 130; booking rules illustrative'
          : source,
    provenance:
      r.activity === 'gym'
        ? supplied('Owner-supplied gym hours and slot duration')
        : illustrative(source),
    ...(r.id === 'DEMO-LIBRARY'
      ? { referenceCapacity: 130 }
      : r.id === 'DEMO-GYM'
        ? { referenceCapacity: 20, referenceCapacityApproximate: true }
        : {}),
  }))
  s.equipment = s.equipment.map((e) => ({
    ...e,
    label: e.label.replace(/^Sample /, ''),
    sourceLabel: source,
    provenance: illustrative(source),
  }))
  s.catalogue = s.catalogue.map((b, i) => ({
    ...b,
    title: [
      'Principles of Economics · study copy',
      'Organizational Behaviour · study copy',
      'Operations Management · study copy',
      'French language workbook',
      'Quantitative Methods · study copy',
    ][i]!,
    author: 'Author not supplied',
    sourceLabel: 'Illustrative library catalogue · titles for study planning',
    provenance: illustrative('Library catalogue not supplied; illustrative study titles'),
  }))
  return s
}

const facultyRows: [string, string[]][] = [
  ['Dr. Safiul Alom', ['IBO']],
  ['Dr. Pradipta Patra', ['IO', 'FMS']],
  ['Dr. Vinay Goyal', ['FA']],
  ['Dr. Aishwarya Harichandan', ['ME']],
  ['Dr. Sonakshi Gupta', ['OB']],
  ['Dr. Sumagna Bhowmick', ['OB']],
  ['Dr. Lakshmi Parvathy', ['SC']],
  ['Dr. Vibhu Gautam', ['IPL-II']],
  ['Dr. Srishti Mishra', ['ED']],
  ['Dr. Vanessa Gaitree Gowreesunkar', ['FI']],
  ['Dr. Shashi Kant Srivastava', ['IIS']],
  ['Dr. Srikanta Kundu', ['PoE']],
  ['Dr. Sanjay Singh', ['PSY', 'IKS', 'PHI-I']],
  ['Dr. Parul Malik', ['PSY']],
]
export function campusAcademics(): AcademicsStore {
  const s = initialAcademicsStore(NOW)
  s.faculty = facultyRows.map(([displayName, codes], i) => ({
    id: `campus-faculty-${i}`,
    displayName,
    courseIds: codes.map(courseId),
    sourceLabel: 'Supplied class / quiz schedules · course association; current role to confirm',
    provenance: supplied(TIMETABLE),
  }))
  s.resources = Object.values(curriculum)
    .flat()
    .map((c, i) => ({
      id: `campus-resource-${i}`,
      courseId: courseId(c.code),
      title: `${c.name} · programme outline`,
      kind: 'reading',
      uri: '/sources#curriculum',
      accessLabel: 'Supplied programme manual',
      sourceLabel: MANUAL,
    }))
  s.announcements = [
    {
      id: 'campus-announcement',
      courseId: courseId('IBO'),
      title: 'IBO presentation planning',
      body: 'Prepare the group outline and use shared availability to protect a meeting time. Submission deadline and rubric were not supplied.',
      noticeType: 'general',
      publishedOn: '2026-11-02' as AcademicsStore['announcements'][number]['publishedOn'],
      authorLabel: 'CampusOS planning note',
      audienceLabel: 'Year 2 BMS',
      sourceLabel: 'Persona-derived planning assumption',
    },
  ]
  s.office = {
    ...s.office,
    name: 'BMS Programme Office',
    hoursText: 'Office hours not supplied',
    locationText: 'Paonta Sahib temporary campus · office room unconfirmed',
    sourceLabel: 'Supplied BMS data research · office email routing needs confirmation',
    provenance: supplied('CampusOS IIM Sirmaur BMS Data Research'),
  }
  s.availability = [] // Faculty names do not establish permission to invent their availability.
  return s
}
const clubRows: [string, string, string, Club['type']][] = [
  ['atithya', 'Atithya', 'Tourism', 'club'],
  ['capital-51', 'Capital 51', 'Trading and investment', 'club'],
  ['consulere', 'Consulere', 'Consulting', 'club'],
  ['sapient', 'Sapient', 'Consulting and strategy', 'club'],
  ['darpan', 'Darpan', 'Literary', 'club'],
  ['datonics', 'Datonics', 'IT and analytics', 'club'],
  ['ebsb', 'EBSB', 'Culture', 'club'],
  ['finserve', 'Finserve', 'Finance', 'club'],
  ['horizon', 'Horizon', 'Human resources', 'club'],
  ['markaizen', 'Markaizen', 'Marketing', 'club'],
  ['prodman', 'ProdMan', 'Product management', 'club'],
  ['quizzar', 'Quizzar', 'Quizzing', 'club'],
  ['rangmanch', 'RangManch', 'Arts', 'club'],
  ['scope', 'Scope', 'Operations and supply chain', 'club'],
  ['vibgyor', 'Vibgyor', 'Photography', 'club'],
  ['alumni', 'Alumni Cell', 'Alumni relations', 'committee'],
  ['ei', 'E&I Cell', 'Entrepreneurship and incubation', 'committee'],
  ['infra-it', 'Infra & IT Committee', 'Infrastructure and IT', 'committee'],
  ['irs', 'IRS', 'Industry relations and sponsorship', 'committee'],
  ['media', 'Media Cell', 'Communications', 'committee'],
  ['naivedyam', 'Naivedyam', 'Mess committee', 'committee'],
  ['placement', 'Placement Committee', 'Placement and internships', 'committee'],
  ['sankalp', 'Sankalp', 'CSR', 'committee'],
  ['sanskriti', 'Sanskriti', 'Cultural committee', 'committee'],
  ['sports-committee', 'Sports Committee', 'Sports', 'committee'],
  ['sac', 'Student Academic Committee', 'Academics', 'committee'],
  ['student-council', 'Student Council', 'Student representation', 'committee'],
  ['td', 'T&D Cell', 'Training and development', 'committee'],
  ['tedx', 'TEDx IIM Sirmaur', 'Ideas and talks', 'committee'],
  ['kalakriti', 'Kalakriti', 'Cultural planning proposal', 'committee'],
  ['econyx', 'Econyx', 'Economics planning proposal', 'club'],
  ['dialectical', 'The Dialectical Society', 'Debating planning proposal', 'club'],
  ['jal', 'Jal Club', 'Persona meeting; remit unconfirmed', 'club'],
]
export function campusCommunity(): CommunityStore {
  const s = initialCommunityStore(NOW)
  s.clubs = clubRows.map(([id, name, category, type]) => ({
    id: `campus-${id}`,
    name,
    type,
    category: category.includes('Sports')
      ? 'Sports'
      : category.includes('Cultur') || category === 'Arts'
        ? 'Cultural'
        : category.includes('IT')
          ? 'Technical'
          : 'Academic',
    purpose: `${category}. Listed in supplied research or event proposal; BMS activity and contacts need confirmation.`,
    roles: [],
    recruitment: { state: 'notAnnounced' },
    sourceLabel: 'Supplied research / proposed calendar · BMS applicability unverified',
    provenance: supplied('BMS data research and club event proposal'),
  }))
  s.clubEvents = proposedEvents.map(([date, clubId, title]) => ({
    id: `campus-event-${clubId}-${date}`,
    clubId: `campus-${clubId}`,
    title,
    date: date as CommunityStore['clubEvents'][number]['date'],
    status: 'scheduled',
    version: 1,
    history: [],
    sourceLabel: CLUB_CALENDAR,
    provenance: supplied(CLUB_CALENDAR),
  }))
  s.reports = s.reports.map((r) => ({
    ...r,
    provenance: illustrative('Illustrative Lost & Found examples; no real item report supplied'),
  }))
  s.teams = s.teams.map((r, i) => ({
    ...r,
    name: ['Hostel Strikers', 'Campus Shuttlers', 'Evening Hoopers'][i] ?? `Campus Team ${i + 1}`,
    captainLabel: 'Captain not supplied',
    provenance: illustrative('Illustrative sports roster; verify committee and eligibility'),
  }))
  s.fixtures = []
  s.needs = []
  return s
}
export function campusShared(): SharedStore {
  const s = initialSharedStore(NOW)
  s.exams = buildCampusDataset('2026-11-03' as Parameters<typeof buildCampusDataset>[0])
    .events.filter((e) => e.category === 'exam')
    .map((e) => ({
      id: e.id,
      courseId: e.courseId!,
      name: e.title,
      date: e.date,
      ...(e.timing.kind === 'timed' ? { startTime: e.timing.start } : {}),
      venue: e.location,
      status: 'scheduled',
      version: 1,
      sourceLabel: e.provenance.sourceLabel!,
      provenance: e.provenance,
    }))
  s.seats = [] // Hall lists are not individual seat assignments.
  return s
}
export function campusClassrooms(): ClassroomStore {
  const s = initialClassroomStore(NOW)
  s.rooms = s.rooms.map((r) => ({
    ...r,
    knownWindow: r.id === 'G12' ? r.knownWindow : { from: t('08:00'), to: t('22:00') },
    sourceLabel: 'Owner-supplied room name; reservable window illustrative',
    provenance: illustrative('Classroom planning configuration; official approval rules missing'),
  }))
  for (const id of ['CR-04', 'CR-05'])
    s.rooms.push({
      id,
      displayName: id,
      kindLabel: 'Classroom',
      bookingMode: 'instant',
      knownWindow: { from: t('08:00'), to: t('22:00') },
      sourceLabel: TIMETABLE,
      provenance: supplied(TIMETABLE),
    })
  s.blockers = currentClasses.map(([date, start, end, code, section], i) => ({
    id: `campus-room-block-${i}`,
    roomId: section === 'A' ? 'CR-04' : 'CR-05',
    kind: 'class',
    date: date as ClassroomStore['blockers'][number]['date'],
    start: t(start),
    end: t(end),
    label: `${code} · Section ${section}`,
    provenance: supplied(TIMETABLE),
  }))
  s.config = { ...s.config, slotMinutes: 15, maxActivePerStudent: 3 }
  const id = 'campus-aanya-evening-room'
  s.reservations = [
    {
      id,
      ownerProfileId: 'demo-student-empty',
      roomId: 'CR1',
      date: '2026-11-03' as ClassroomStore['reservations'][number]['date'],
      start: t('20:30'),
      end: t('21:45'),
      purpose: 'Study group',
      groupName: 'Club planning group',
      state: 'confirmedDemo',
      version: 1,
      createdAt: SOURCE_AS_OF,
      updatedAt: SOURCE_AS_OF,
      provenance: illustrative('Aanya persona evening meeting; room assignment illustrative'),
      history: [{ id: `${id}-import`, actor: 'student', type: 'created', at: SOURCE_AS_OF }],
    },
  ]
  return s
}
export const sourceStoreBuilders = {
  ess: campusEss,
  sports: campusSports,
  academics: campusAcademics,
  community: campusCommunity,
  shared: campusShared,
  classrooms: campusClassrooms,
  chill: emptyChillStore,
  admin: initialAdminStore,
  mail: () => {
    const s = initialMailStore(NOW)
    s.emails = []
    s.notices = []
    s.studentKeys = {}
    s.examIndex = {}
    return s
  },
}
export const oldStoreBuilders = {
  ess: () => initialEssStore(NOW),
  sports: () => initialSportsStore(NOW, true),
  academics: () => initialAcademicsStore(NOW),
  community: () => initialCommunityStore(NOW),
  shared: () => initialSharedStore(NOW),
  classrooms: () => initialClassroomStore(NOW),
  chill: () => initialChillStore(NOW),
  admin: initialAdminStore,
  mail: () => initialMailStore(NOW),
}
