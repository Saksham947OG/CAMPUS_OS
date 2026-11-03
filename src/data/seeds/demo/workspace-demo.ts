import { curriculum, courseId } from '@/data/campus/catalogue'
import { personaEvidence } from '@/data/campus/evidence'
import { sourceLibrary } from '@/data/campus/source-library'
import type { DateOnly, LocalTime } from '@/lib/time'
import type { Interval } from '@/domain/availability'
import { instantMs } from '@/selectors/now'
import type {
  Block,
  Capture,
  Canvas,
  Comment,
  Decision,
  EvidenceSource,
  Member,
  Page,
  Person,
  Project,
  Review,
  Role,
  Space,
  WorkTask,
  WorkspaceStore,
  WsMeeting,
  WsPoll,
} from '@/domain/workspace'

/**
 * The isolated, removable demonstration team (spec §12). Everything here is FICTIONAL planning data:
 * the people are invented, the dates are illustrative (not a professor's deadlines), and no record
 * claims a measurement. Real CampusOS profiles are not members unless somebody adds them.
 */
export const DEMO_PEOPLE: Person[] = [
  { id: 'demo-u1', name: 'Aarav Mehta', focus: 'Coordination and analysis', dataMode: 'demoSeed' },
  { id: 'demo-u2', name: 'Meera Nair', focus: 'Fieldwork and evidence', dataMode: 'demoSeed' },
  { id: 'demo-u3', name: 'Kabir Sethi', focus: 'Product workflows', dataMode: 'demoSeed' },
  { id: 'demo-u4', name: 'Tara Sen', focus: 'Presentation and visual story', dataMode: 'demoSeed' },
  { id: 'demo-u5', name: 'Rohan Das', focus: 'Peer review', dataMode: 'demoSeed' },
]

/** The date the fictional availability below is complete for (spec §12.5). */
export const DEMO_AVAILABILITY_DATE = '2026-11-11' as DateOnly
export const DEMO_ROOM = {
  label: 'Demo Study Room A',
  seats: 6,
  from: '12:00' as LocalTime,
  to: '17:00' as LocalTime,
}

const BUSY: Record<string, [string, string][]> = {
  'demo-u1': [
    ['09:00', '11:00'],
    ['14:00', '15:00'],
  ],
  'demo-u2': [['10:00', '12:00']],
  'demo-u3': [
    ['09:00', '10:00'],
    ['13:00', '14:00'],
  ],
  'demo-u4': [
    ['11:00', '12:00'],
    ['15:00', '16:00'],
  ],
}

/** Known busy time for a demo person. Rohan has no recorded coverage, so he stays UNKNOWN, never free. */
export function demoAvailability(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): { busy: Interval[]; coverage: 'known' | 'unknown' } {
  const rows = BUSY[userId]
  const onlyThatDay = from === DEMO_AVAILABILITY_DATE && to === DEMO_AVAILABILITY_DATE
  if (!rows || !onlyThatDay) return { busy: [], coverage: 'unknown' }
  return {
    busy: rows.map(([a, b]) => ({
      start: instantMs(DEMO_AVAILABILITY_DATE, a as LocalTime),
      end: instantMs(DEMO_AVAILABILITY_DATE, b as LocalTime),
    })),
    coverage: 'known',
  }
}

const at = (day: number, hh = '10:00') => `2026-11-${String(day).padStart(2, '0')}T${hh}:00+05:30`
const SEED_AT = at(2)

const blk = (id: string, type: Block['type'], text: string, extra: Partial<Block> = {}): Block => ({
  id,
  type,
  text,
  ...extra,
})

const page = (
  id: string,
  spaceId: string,
  title: string,
  authorId: string,
  blocks: Block[],
  extra: Partial<Page> = {},
): Page => ({
  id,
  spaceId,
  title,
  blocks,
  authorId,
  audience: 'space',
  lifecycle: 'draft',
  tags: [],
  noteType: 'note',
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  revision: 1,
  dataMode: 'demoSeed',
  ...extra,
})

const SP_TT = 'sp-demo-tt'
const SP_OPS = 'sp-demo-ops'
const SP_CLUB = 'sp-demo-club'
export const DEMO_SPACE_IDS = [SP_TT, SP_OPS, SP_CLUB]
export const DEMO_PROJECT_ID = 'prj-demo-tt'

const spaces: Space[] = [
  {
    id: SP_TT,
    type: 'project',
    title: 'Time Tax investigation',
    ownerId: 'demo-u1',
    purpose:
      'Research, measurement, process analysis and prototype evaluation. Fictional demonstration team.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  },
  {
    id: SP_OPS,
    type: 'project',
    title: 'Operations case presentation',
    ownerId: 'demo-u1',
    purpose:
      'Theory notes, discussion questions and slide preparation. Fictional demonstration team.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  },
  {
    id: SP_CLUB,
    type: 'club',
    title: 'Student club showcase',
    ownerId: 'demo-u4',
    purpose: 'Event checklist, sessions and resource planning. Fictional demonstration team.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  },
]

const mem = (spaceId: string, userId: string, role: Role): Member => ({
  spaceId,
  userId,
  role,
  joinedAt: SEED_AT,
})
const members: Member[] = [
  mem(SP_TT, 'demo-u1', 'owner'),
  mem(SP_TT, 'demo-u2', 'editor'),
  mem(SP_TT, 'demo-u3', 'editor'),
  mem(SP_TT, 'demo-u4', 'editor'),
  mem(SP_TT, 'demo-u5', 'commenter'),
  mem(SP_OPS, 'demo-u1', 'owner'),
  mem(SP_OPS, 'demo-u4', 'editor'),
  mem(SP_OPS, 'demo-u3', 'editor'),
  mem(SP_OPS, 'demo-u5', 'viewer'),
  mem(SP_CLUB, 'demo-u4', 'owner'),
  mem(SP_CLUB, 'demo-u2', 'editor'),
  mem(SP_CLUB, 'demo-u3', 'editor'),
  mem(SP_CLUB, 'demo-u5', 'viewer'),
]

const projects: Project[] = [
  {
    id: DEMO_PROJECT_ID,
    spaceId: SP_TT,
    title: 'Time Tax investigation',
    purpose:
      'Compare avoidable effort across selected campus journeys and test whether linked project records cut coordination effort.',
    ownerId: 'demo-u1',
    targetDate: '2026-11-16' as DateOnly,
    status: 'active',
    homePageId: 'pg-tt-home',
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  },
  {
    id: 'prj-demo-ops',
    spaceId: SP_OPS,
    title: 'Operations case presentation',
    purpose: 'Prepare the theory notes and slides for the case presentation.',
    ownerId: 'demo-u1',
    targetDate: '2026-11-16' as DateOnly,
    status: 'active',
    homePageId: 'pg-ops-theory',
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  },
  {
    id: 'prj-demo-club',
    spaceId: SP_CLUB,
    title: 'Club showcase',
    purpose: 'Plan the showcase evening, resources and run sheet.',
    ownerId: 'demo-u4',
    targetDate: '2026-11-20' as DateOnly,
    status: 'planning',
    homePageId: 'pg-club-run',
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  },
]

const pages: Page[] = [
  page(
    'pg-tt-home',
    SP_TT,
    'Time Tax project home',
    'demo-u1',
    [
      blk('h1', 'paragraph', 'Scope: compare avoidable effort across selected campus journeys.'),
      blk(
        'h2',
        'paragraph',
        'Open question: which friction is information-related, and which is capacity-related?',
      ),
      blk('h3', 'h2', 'Start here'),
      blk('h4', 'bullet', 'Idea behind the work: [[pg-tt-bottleneck]]'),
      blk('h5', 'bullet', 'How we will observe: [[pg-tt-mess-plan]]'),
      blk('h6', 'bullet', 'What we will and will not claim: [[pg-tt-estimates]]'),
      blk('h7', 'bullet', 'The second experiment: [[pg-tt-retrieval]]'),
      blk(
        'h8',
        'paragraph',
        'Tasks, decisions and the evidence register live in the project tabs.',
      ),
    ],
    { lifecycle: 'approved', noteType: 'note', icon: '⏳', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-bottleneck',
    SP_TT,
    'Bottleneck vs visible queue',
    'demo-u1',
    [
      blk(
        'b1',
        'paragraph',
        'A visible line may be downstream of the real capacity constraint. The queue you can see is not always the step that limits throughput.',
      ),
      blk('b2', 'callout', 'Record station completion rates before choosing an intervention.'),
      blk(
        'b3',
        'paragraph',
        'Applied to the mess: see [[pg-tt-mess-plan]] for how we separate arrival, service start and service end.',
      ),
    ],
    { noteType: 'concept', tags: ['theory', 'queue'], projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-mess-plan',
    SP_TT,
    'Mess observation plan',
    'demo-u2',
    [
      blk(
        'm1',
        'paragraph',
        'Record arrival, service start and service end separately. Keep meal duration outside queue time.',
      ),
      blk('m2', 'h2', 'Windows'),
      blk('m3', 'bullet', 'Peak window and an off-peak window, observed on the same weekday.'),
      blk('m4', 'bullet', 'Two observers per window so each reading can be cross-checked.'),
      blk('m5', 'paragraph', 'Sheet: [[pg-tt-sheet]]. Known gaps: [[pg-tt-limits]].'),
    ],
    { noteType: 'field', tags: ['fieldwork'], projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-sheet',
    SP_TT,
    'Observation sheet',
    'demo-u2',
    [
      blk(
        's1',
        'paragraph',
        'Columns: observer, date, window, arrival time, service start, service end, notes.',
      ),
      blk(
        's2',
        'quote',
        'Leave a cell empty when it was not observed. An empty cell is not a zero.',
      ),
    ],
    { noteType: 'field', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-limits',
    SP_TT,
    'Trial limitations',
    'demo-u2',
    [
      blk(
        'l1',
        'bullet',
        'Small number of observers and windows; results describe those windows only.',
      ),
      blk('l2', 'bullet', 'People who notice the observer may change their behaviour.'),
      blk('l3', 'bullet', 'Self-reported waits and timed waits are kept in separate columns.'),
    ],
    { noteType: 'research', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-meeting1',
    SP_TT,
    'Coordination meeting',
    'demo-u1',
    [
      blk(
        'c1',
        'paragraph',
        'Agenda: agree observation windows, assign roles, resolve missing data.',
      ),
      blk('c2', 'h2', 'Actions'),
      blk('c3', 'todo', 'Meera to confirm the two observer pairs for the peak window'),
      blk('c4', 'todo', 'Kabir to draft the meeting-to-room journey for the walkthrough'),
      blk('c5', 'todo', 'Aarav to write up how we separate meal time from queue time'),
      blk('c6', 'paragraph', 'Decision D01 covers which meals we observe first.'),
    ],
    { noteType: 'meeting', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-estimates',
    SP_TT,
    'Why we separated estimates',
    'demo-u1',
    [
      blk('e1', 'paragraph', 'Planning targets cannot be reported as measured savings.'),
      blk(
        'e2',
        'paragraph',
        'We keep three labels apart: measured, self-reported, and modelled potential. See decision D02.',
      ),
      blk('e3', 'paragraph', 'Argument for the presentation: [[pg-tt-bottleneck]].'),
    ],
    { noteType: 'decision', lifecycle: 'inReview', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-retrieval',
    SP_TT,
    'Retrieval experiment',
    'demo-u3',
    [
      blk(
        'r1',
        'paragraph',
        'Compare finding a decision in scattered messages versus in linked project records.',
      ),
      blk('r2', 'h2', 'Protocol (draft)'),
      blk('r3', 'numbered', 'Give each participant a question whose answer exists in both places.'),
      blk(
        'r4',
        'numbered',
        'Time from starting to a correct answer, including any time spent finding where to look.',
      ),
      blk('r5', 'numbered', 'Swap which method each participant uses first.'),
      blk(
        'r6',
        'paragraph',
        'Needs confirmed participants first (task: Confirm test participants).',
      ),
    ],
    { noteType: 'research', projectId: DEMO_PROJECT_ID },
  ),
  page(
    'pg-tt-private',
    SP_TT,
    "Aarav's private scratchpad",
    'demo-u1',
    [
      blk(
        'p1',
        'paragraph',
        'Private worry: not sure we have enough observers. Check against [[pg-tt-home]] before the meeting.',
      ),
    ],
    { audience: 'private', noteType: 'note', projectId: DEMO_PROJECT_ID },
  ),

  page(
    'pg-ops-theory',
    SP_OPS,
    'Theory notes: constraints and buffers',
    'demo-u4',
    [
      blk(
        'o1',
        'paragraph',
        'The constraint sets the pace of the whole process; protect it with a buffer rather than speeding up other steps.',
      ),
      blk(
        'o2',
        'paragraph',
        'Discussion questions: [[pg-ops-questions]]. Slides: [[pg-ops-slides]].',
      ),
    ],
    { noteType: 'lecture', courseCode: 'IBO', projectId: 'prj-demo-ops' },
  ),
  page(
    'pg-ops-questions',
    SP_OPS,
    'Discussion questions',
    'demo-u3',
    [
      blk('q1', 'numbered', 'Where is the real constraint in a service with a visible queue?'),
      blk('q2', 'numbered', 'What would you measure first, and why?'),
    ],
    { noteType: 'revision', projectId: 'prj-demo-ops' },
  ),
  page(
    'pg-ops-slides',
    SP_OPS,
    'Slide plan',
    'demo-u4',
    [
      blk('sl1', 'bullet', 'Problem and the Time Tax idea'),
      blk('sl2', 'bullet', 'What we measured versus what we estimated'),
      blk('sl3', 'bullet', 'What the software changes'),
    ],
    { noteType: 'note', projectId: 'prj-demo-ops' },
  ),

  page(
    'pg-club-run',
    SP_CLUB,
    'Event run sheet',
    'demo-u4',
    [
      blk('rs1', 'paragraph', 'Purpose: a short evening where clubs show what they do.'),
      blk('rs2', 'h2', 'Run sheet (draft)'),
      blk('rs3', 'bullet', 'Setup and sound check'),
      blk('rs4', 'bullet', 'Club slots, five minutes each'),
      blk('rs5', 'bullet', 'Open floor and wrap-up'),
      blk('rs6', 'paragraph', 'Resources: [[pg-club-checklist]]'),
    ],
    { noteType: 'note', projectId: 'prj-demo-club' },
  ),
  page(
    'pg-club-checklist',
    SP_CLUB,
    'Resource checklist',
    'demo-u2',
    [
      blk('rc1', 'todo', 'Microphones and a speaker'),
      blk('rc2', 'todo', 'Seating plan'),
      blk('rc3', 'todo', 'Signage'),
    ],
    { noteType: 'note', projectId: 'prj-demo-club' },
  ),
]

const task = (
  n: string,
  projectId: string,
  title: string,
  assigneeId: string,
  status: WorkTask['status'],
  dueDay: number,
  dependsOn: string[] = [],
  extra: Partial<WorkTask> = {},
): WorkTask => ({
  id: n,
  projectId,
  title,
  assigneeId,
  status,
  priority: 'normal',
  dueDate: `2026-11-${String(dueDay).padStart(2, '0')}` as DateOnly,
  dependsOn,
  createdBy: 'demo-u1',
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  revision: 1,
  dataMode: 'demoSeed',
  ...(status === 'done' ? { completedAt: at(3, '09:30') } : {}),
  ...extra,
})
const T = DEMO_PROJECT_ID
const tasks: WorkTask[] = [
  task('tsk-demo-t01', T, 'Finalize observation sheet', 'demo-u2', 'done', 9),
  task('tsk-demo-t02', T, 'Record mess peak window', 'demo-u2', 'ready', 10, ['tsk-demo-t01'], {
    pageId: 'pg-tt-mess-plan',
  }),
  task('tsk-demo-t03', T, 'Record mess off-peak window', 'demo-u1', 'ready', 10, ['tsk-demo-t01'], {
    pageId: 'pg-tt-mess-plan',
  }),
  task('tsk-demo-t04', T, 'Clean paired observations', 'demo-u1', 'backlog', 11, [
    'tsk-demo-t02',
    'tsk-demo-t03',
  ]),
  task(
    'tsk-demo-t05',
    T,
    'Identify likely bottleneck',
    'demo-u1',
    'backlog',
    12,
    ['tsk-demo-t04'],
    { priority: 'high', pageId: 'pg-tt-bottleneck' },
  ),
  task('tsk-demo-t06', T, 'Draft meeting-to-room journey', 'demo-u3', 'inProgress', 11),
  task('tsk-demo-t07', T, 'Review source labels', 'demo-u5', 'inReview', 12, ['tsk-demo-t06']),
  task('tsk-demo-t08', T, 'Prepare evidence slide', 'demo-u4', 'backlog', 13, ['tsk-demo-t04']),
  task('tsk-demo-t09', T, 'Confirm test participants', 'demo-u2', 'backlog', 12, [], {
    blockedReason: 'Waiting on external confirmation',
  }),
  task('tsk-demo-t10', T, 'Run retrieval trial', 'demo-u3', 'backlog', 13, ['tsk-demo-t09'], {
    pageId: 'pg-tt-retrieval',
  }),
  task('tsk-ops-1', 'prj-demo-ops', 'Draft theory summary', 'demo-u4', 'inProgress', 12),
  task('tsk-ops-2', 'prj-demo-ops', 'Write discussion questions', 'demo-u3', 'ready', 13),
  task('tsk-ops-3', 'prj-demo-ops', 'Rehearse the presentation', 'demo-u1', 'backlog', 16, [
    'tsk-ops-1',
  ]),
  task('tsk-club-1', 'prj-demo-club', 'Confirm the run sheet', 'demo-u4', 'ready', 14),
  task('tsk-club-2', 'prj-demo-club', 'List resources needed', 'demo-u2', 'ready', 13),
  task('tsk-club-3', 'prj-demo-club', 'Find a rehearsal room', 'demo-u3', 'backlog', 17),
]

const meeting = (
  id: string,
  projectId: string,
  title: string,
  date: string,
  start: string,
  end: string,
  organizerId: string,
  who: string[],
  room?: string,
): WsMeeting => ({
  id,
  projectId,
  title,
  date: date as DateOnly,
  start: start as LocalTime,
  end: end as LocalTime,
  attendees: who.map((userId) => ({
    userId,
    required: userId !== 'demo-u5',
    rsvp: userId === organizerId ? 'YES' : 'INVITED',
  })),
  ...(room ? { roomLabel: room } : {}),
  status: 'confirmed',
  organizerId,
  createdAt: SEED_AT,
  revision: 1,
  dataMode: 'demoSeed',
})
const all5 = ['demo-u1', 'demo-u2', 'demo-u3', 'demo-u4', 'demo-u5']
const meetings: WsMeeting[] = [
  meeting(
    'mtg-tt-1',
    T,
    'Kick-off',
    '2026-11-09',
    '12:00',
    '12:45',
    'demo-u1',
    all5,
    DEMO_ROOM.label,
  ),
  meeting(
    'mtg-tt-2',
    T,
    'Coordination meeting',
    '2026-11-10',
    '16:00',
    '16:45',
    'demo-u1',
    all5,
    DEMO_ROOM.label,
  ),
  meeting('mtg-tt-3', T, 'Observation prep', '2026-11-12', '12:00', '12:45', 'demo-u2', [
    'demo-u1',
    'demo-u2',
    'demo-u3',
  ]),
  meeting('mtg-ops-1', 'prj-demo-ops', 'Slide review', '2026-11-13', '16:00', '16:45', 'demo-u4', [
    'demo-u1',
    'demo-u3',
    'demo-u4',
  ]),
  meeting(
    'mtg-club-1',
    'prj-demo-club',
    'Run sheet check',
    '2026-11-14',
    '12:00',
    '12:45',
    'demo-u4',
    ['demo-u2', 'demo-u3', 'demo-u4'],
  ),
  meeting(
    'mtg-club-2',
    'prj-demo-club',
    'Resources review',
    '2026-11-16',
    '12:00',
    '12:45',
    'demo-u4',
    ['demo-u2', 'demo-u3', 'demo-u4'],
  ),
]

const dec = (
  id: string,
  projectId: string,
  question: string,
  extra: Partial<Decision> = {},
): Decision => ({
  id,
  projectId,
  question,
  options: [],
  evidenceIds: [],
  createdAt: SEED_AT,
  dataMode: 'demoSeed',
  ...extra,
})
const decided = { decidedBy: 'demo-u1', decidedOn: '2026-11-04' as DateOnly }
const decisions: Decision[] = [
  dec('dec-d01', T, 'Which meals do we observe first?', {
    options: ['Lunch', 'Dinner', 'Both'],
    outcome: 'Lunch first: it has the longest reported queue.',
    rationale:
      'Supplied reports name lunch as the busiest. We widen to dinner only if time allows.',
    ...decided,
    evidenceIds: ['src-02'],
  }),
  dec('dec-d02', T, 'Do we report estimates as measured savings?', {
    options: ['Yes', 'No, label as planning estimates'],
    outcome: 'No. Estimates are labelled as planning estimates.',
    rationale: 'Nothing has been timed before and after, so a saving has not been measured.',
    ...decided,
    evidenceIds: ['src-03'],
    revisitWhen: 'After the first paired observation',
  }),
  dec('dec-d03', T, 'How many participants for the retrieval trial?', {
    options: ['4', '6', '8'],
    evidenceIds: [],
    revisitWhen: 'Once participants are confirmed',
  }),
  dec('dec-d04', T, 'Where do team meetings happen?', {
    options: ['Demo Study Room A', 'Online'],
    outcome: 'Demo Study Room A when it is free.',
    ...decided,
  }),
  dec('dec-d05', T, 'How do we separate meal time from queue time?', {
    outcome: 'Record arrival, service start and service end as three separate readings.',
    ...decided,
    evidenceIds: ['src-04'],
  }),
  dec('dec-d06', T, 'Do we share the trial design with a mentor?', {
    options: ['Yes, after the first draft', 'No'],
    revisitWhen: 'When the draft is reviewed',
  }),
]

const src = (
  id: string,
  claim: string,
  source: string,
  method: string,
  finding: string,
  limitations: string,
  pageId?: string,
): EvidenceSource => ({
  id,
  projectId: T,
  claim,
  source,
  method,
  finding,
  limitations,
  ...(pageId ? { pageId } : {}),
  createdBy: 'demo-u2',
  createdAt: SEED_AT,
  dataMode: 'demoSeed',
})
const sources: EvidenceSource[] = [
  src(
    'src-01',
    'A visible queue can sit downstream of the real constraint',
    'Operations course notes',
    'Lecture / theory',
    'Measure station completion rates before choosing a fix.',
    'Not yet observed on this campus.',
    'pg-tt-bottleneck',
  ),
  src(
    'src-02',
    'Lunch is the longest reported wait',
    'Supplied student reports',
    'Self-report',
    'Reports name lunch as the busiest meal.',
    'Reported, not timed; different days.',
  ),
  src(
    'src-03',
    'Planning targets are not measured savings',
    'Project method note',
    'Method',
    'Keep measured, self-reported and modelled labels apart.',
    'A rule of the project, not a finding.',
    'pg-tt-estimates',
  ),
  src(
    'src-04',
    'Meal duration must stay out of queue time',
    'Mess observation plan',
    'Method',
    'Three separate readings per person.',
    'Plan only; no readings recorded yet.',
    'pg-tt-mess-plan',
  ),
  src(
    'src-05',
    'Finding a decision is slower in scattered messages',
    'Retrieval experiment (planned)',
    'Paired trial (planned)',
    'Not yet run.',
    'Depends on confirmed participants.',
    'pg-tt-retrieval',
  ),
  src(
    'src-06',
    'Observers may change behaviour',
    'Trial limitations',
    'Method note',
    'Use two observers and note when people notice them.',
    'Cannot be removed, only recorded.',
    'pg-tt-limits',
  ),
]

const comments: Comment[] = [
  {
    id: 'cmt-1',
    pageId: 'pg-tt-mess-plan',
    blockId: 'm1',
    quote:
      'Record arrival, service start and service end separately. Keep meal duration outside queue time.',
    authorId: 'demo-u5',
    body: 'Who times the service end when two people finish together?',
    createdAt: at(3, '15:00'),
    dataMode: 'demoSeed',
  },
  {
    id: 'cmt-2',
    pageId: 'pg-tt-mess-plan',
    blockId: 'm1',
    quote:
      'Record arrival, service start and service end separately. Keep meal duration outside queue time.',
    parentId: 'cmt-1',
    authorId: 'demo-u2',
    body: 'The second observer. I will add a line to the sheet.',
    createdAt: at(3, '16:10'),
    dataMode: 'demoSeed',
  },
  {
    id: 'cmt-3',
    pageId: 'pg-tt-bottleneck',
    blockId: 'b2',
    quote: 'Record station completion rates before choosing an intervention.',
    authorId: 'demo-u3',
    body: 'Add one example from another service?',
    createdAt: at(3, '11:00'),
    resolvedAt: at(3, '12:00'),
    dataMode: 'demoSeed',
  },
]
const reviews: Review[] = [
  {
    id: 'rvw-1',
    pageId: 'pg-tt-estimates',
    revision: 1,
    requestedBy: 'demo-u4',
    reviewerId: 'demo-u5',
    requestedAt: at(3, '17:00'),
    dueDate: '2026-11-10' as DateOnly,
    state: 'requested',
  },
]

const act = (n: number, actorId: string, text: string, href: string, day: number, hh: string) => ({
  id: `act-demo-${n}`,
  actorId,
  spaceId: SP_TT,
  entityId: `demo-${n}`,
  type: 'seed',
  text,
  href,
  at: at(day, hh),
  dataMode: 'demoSeed' as const,
})
const activity = [
  act(
    1,
    'demo-u2',
    'Added the observation-sheet draft',
    '/workspace/pages/pg-tt-sheet',
    3,
    '10:20',
  ),
  act(
    2,
    'demo-u3',
    'Linked the booking journey to the retrieval experiment',
    '/workspace/pages/pg-tt-retrieval',
    3,
    '13:40',
  ),
  act(
    3,
    'demo-u4',
    'Requested review of the estimates narrative',
    '/workspace/pages/pg-tt-estimates',
    3,
    '17:00',
  ),
].reverse()

/** Adds the demo team to a store. Re-running it changes nothing (the demo IDs are fixed). */
export function withDemo(s: WorkspaceStore): WorkspaceStore {
  if (s.spaces.some((x) => x.id === SP_TT)) return s
  return {
    ...s,
    people: DEMO_PEOPLE,
    spaces: [...s.spaces, ...spaces],
    members: [...s.members, ...members],
    pages: [...s.pages, ...pages],
    projects: [...s.projects, ...projects],
    tasks: [...s.tasks, ...tasks],
    meetings: [...s.meetings, ...meetings],
    decisions: [...s.decisions, ...decisions],
    sources: [...s.sources, ...sources],
    comments: [...s.comments, ...comments],
    reviews: [...s.reviews, ...reviews],
    activity: [...activity, ...s.activity],
  }
}

/* ---------- a shared project for the three real CampusOS profiles ---------- */

export const TEAM_SPACE_ID = 'sp-team3'
export const TEAM_PROJECT_ID = 'prj-team3'
export const TEAM_MEMBERS: [string, Role][] = [
  ['demo-student-a', 'owner'],
  ['demo-student-b', 'editor'],
  ['demo-student-empty', 'editor'],
]
const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'

/**
 * Sample content for a project the three CampusOS profiles share. The people are the real personas
 * (switch the persona in the top bar to act as each); the notes, tasks and dates are illustrative
 * planning data. Meetings are NOT seeded: each persona books a real one from Find a team time.
 */
export function withTeamProject(s: WorkspaceStore): WorkspaceStore {
  if (s.spaces.some((x) => x.id === TEAM_SPACE_ID)) return s
  const space: Space = {
    id: TEAM_SPACE_ID,
    type: 'project',
    title: 'Time Tax group project',
    ownerId: A,
    purpose:
      'A shared space for the three personas. Switch persona in the top bar to collaborate as each one. Sample planning content.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  }
  const mems = TEAM_MEMBERS.map(([userId, role]) => mem(TEAM_SPACE_ID, userId, role))
  const project: Project = {
    id: TEAM_PROJECT_ID,
    spaceId: TEAM_SPACE_ID,
    title: 'Time Tax group project',
    purpose:
      'Agree who observes what, pool the evidence and prepare one shared story for the presentation.',
    ownerId: A,
    targetDate: '2026-11-16' as DateOnly,
    status: 'active',
    homePageId: 'pg-t3-home',
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  }
  const P = (
    id: string,
    title: string,
    author: string,
    blocks: Block[],
    extra: Partial<Page> = {},
  ) => page(id, TEAM_SPACE_ID, title, author, blocks, { projectId: TEAM_PROJECT_ID, ...extra })
  const pages = [
    P(
      'pg-t3-home',
      'Group project home',
      A,
      [
        blk(
          'a1',
          'paragraph',
          'Goal: one shared account of where students lose time, with each persona contributing what they see.',
        ),
        blk('a2', 'h2', 'Start here'),
        blk('a3', 'bullet', 'Who does what: [[pg-t3-work]]'),
        blk('a4', 'bullet', 'Coordination notes: [[pg-t3-notes]]'),
      ],
      { icon: '👥', lifecycle: 'approved' },
    ),
    P('pg-t3-work', 'Division of work', B, [
      blk(
        'w1',
        'paragraph',
        'Each of us covers the journeys we use most, so the evidence comes from real routines.',
      ),
      blk('w2', 'bullet', 'Ananya: mess queues and laundry waits'),
      blk('w3', 'bullet', 'Abeer: gym, lunch and committee follow-ups'),
      blk('w4', 'bullet', 'Myra: rooms, library seats and parcels'),
    ]),
    P(
      'pg-t3-notes',
      'Coordination notes',
      C,
      [
        blk(
          'n1',
          'paragraph',
          'Agenda: agree what counts as a wait, then who writes which section.',
        ),
        blk('n2', 'h2', 'Actions'),
        blk('n3', 'todo', 'Agree one definition of “queue time”'),
        blk('n4', 'todo', 'Pool our evidence into the register'),
      ],
      { noteType: 'meeting' },
    ),
  ]
  const T3 = TEAM_PROJECT_ID
  const t = (
    id: string,
    title: string,
    who: string,
    status: WorkTask['status'],
    day: number,
    deps: string[] = [],
  ) => task(id, T3, title, who, status, day, deps, { createdBy: A })
  const tasks = [
    t('tsk-t3-1', 'Write down our shared definition of queue time', A, 'inProgress', 4),
    t('tsk-t3-2', 'Collect mess and laundry waits', A, 'ready', 6, ['tsk-t3-1']),
    t('tsk-t3-3', 'Collect gym and lunch waits', B, 'ready', 6, ['tsk-t3-1']),
    t('tsk-t3-4', 'Collect room and library waits', C, 'ready', 6, ['tsk-t3-1']),
    t('tsk-t3-5', 'Merge everyone’s evidence into one table', B, 'backlog', 9, [
      'tsk-t3-2',
      'tsk-t3-3',
      'tsk-t3-4',
    ]),
    t('tsk-t3-6', 'Draft the presentation story', C, 'backlog', 10, ['tsk-t3-5']),
  ]
  const decisions: Decision[] = [
    dec('dec-t3-1', T3, 'Do we pool waits as ranges or single numbers?', {
      options: ['Ranges', 'Single numbers'],
      revisitWhen: 'Once everyone has collected evidence',
    }),
  ]
  return {
    ...s,
    spaces: [...s.spaces, space],
    members: [...s.members, ...mems],
    projects: [...s.projects, project],
    pages: [...s.pages, ...pages],
    tasks: [...s.tasks, ...tasks],
    decisions: [...s.decisions, ...decisions],
  }
}

/* ---------- sample content for the three personas, built from their own records ---------- */

export const SEED_VERSION = 'personas-v1'
const CLUB_SPACE_ID = 'sp-club3'
const CLUB_PROJECT_ID = 'prj-club3'
const PERSONAS = [
  { id: A, name: 'Ananya', full: 'Ananya Sharma', sem: 1 },
  { id: B, name: 'Abeer', full: 'Abeer Sethi', sem: 3 },
  { id: C, name: 'Myra', full: 'Myra Kapoor', sem: 3 },
] as const

const add = <T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] => [
  ...list,
  ...items.filter((x) => !list.some((y) => y.id === x.id)),
]
const range = (r: [number, number] | null) =>
  r ? (r[0] === r[1] ? `${r[0]} min` : `${r[0]}–${r[1]} min`) : 'not recorded'

/** One evidence row per supplied or estimated wait in the three personas' Time Tax records. */
function evidenceRows(): EvidenceSource[] {
  const rows: EvidenceSource[] = []
  for (const p of PERSONAS)
    for (const e of personaEvidence(p.id)) {
      if (!e.baseline || (e.basis !== 'reported' && e.basis !== 'estimated')) continue
      const doc = sourceLibrary.find((d) => d.id === e.sourceIds[0])
      rows.push({
        id: `src-t3-${p.id}-${e.id}`,
        projectId: TEAM_PROJECT_ID,
        claim: `${p.name}: ${e.label.toLowerCase()} takes about ${range(e.baseline)}`,
        source: doc?.title ?? e.sourceIds[0] ?? '',
        method:
          e.basis === 'reported'
            ? 'Reported in the persona document'
            : 'Estimate stated in the source',
        finding: `Baseline ${range(e.baseline)}.`,
        limitations: e.note.slice(0, 300),
        createdBy: p.id,
        createdAt: SEED_AT,
        dataMode: 'demoSeed',
      })
    }
  return rows
}

function extendTeam(s: WorkspaceStore): WorkspaceStore {
  const T = TEAM_PROJECT_ID
  const pages = [
    page(
      'pg-t3-evidence',
      TEAM_SPACE_ID,
      'What the three personas report',
      B,
      [
        blk(
          'v1',
          'paragraph',
          'Each of us brings the waits our own routine reports. The evidence register in the Docs tab holds one row per wait, with its source and its limits.',
        ),
        blk(
          'v2',
          'callout',
          'Reported and estimated figures are kept apart from planning assumptions. None of them is a measured saving.',
        ),
        blk(
          'v3',
          'paragraph',
          'How the argument uses it: [[pg-t3-work]]. How we agreed to meet: [[pg-t3-notes]].',
        ),
      ],
      { projectId: T, noteType: 'research', tags: ['time-tax', 'evidence'] },
    ),
    page(
      'pg-t3-one-place',
      TEAM_SPACE_ID,
      'Why one place beats five',
      C,
      [
        blk(
          'o1',
          'paragraph',
          'A group task today is spread over a chat, a spreadsheet, a calendar, a document and email. Each switch is a small tax: finding the latest decision, who owns a task, which file is current.',
        ),
        blk('o2', 'h2', 'What each job used to need'),
        blk(
          'o3',
          'bullet',
          'Agree a time: a chat thread, then a poll in another tool, then a calendar invite.',
        ),
        blk('o4', 'bullet', 'Assign work: a message, copied into a spreadsheet.'),
        blk('o5', 'bullet', 'Keep a decision: buried in a thread.'),
        blk(
          'o6',
          'paragraph',
          'Here each of these is one record in one place. The Time Tax page counts the jobs and shows the planning scenario. See [[pg-t3-evidence]].',
        ),
      ],
      { projectId: T, noteType: 'research', tags: ['time-tax', 'collaboration'] },
    ),
  ]
  const comments: Comment[] = [
    {
      id: 'cmt-t3-1',
      pageId: 'pg-t3-work',
      blockId: 'w2',
      quote: 'Ananya: mess queues and laundry waits',
      authorId: B,
      body: 'Can you also note which meal the 20–30 minute lunch estimate came from?',
      createdAt: at(3, '12:10'),
      dataMode: 'demoSeed',
    },
    {
      id: 'cmt-t3-2',
      pageId: 'pg-t3-work',
      blockId: 'w2',
      quote: 'Ananya: mess queues and laundry waits',
      parentId: 'cmt-t3-1',
      authorId: A,
      body: 'It is the lunch estimate inferred from shifted meal start times. I will add that to the evidence row.',
      createdAt: at(3, '12:40'),
      dataMode: 'demoSeed',
    },
    {
      id: 'cmt-t3-3',
      pageId: 'pg-t3-notes',
      authorId: C,
      body: 'I can take the notes for the first meeting.',
      createdAt: at(3, '15:00'),
      dataMode: 'demoSeed',
    },
  ]
  const reviews: Review[] = [
    {
      id: 'rvw-t3-1',
      pageId: 'pg-t3-one-place',
      revision: 1,
      requestedBy: C,
      reviewerId: B,
      requestedAt: at(3, '14:30'),
      dueDate: '2026-11-05' as DateOnly,
      state: 'requested',
    },
  ]
  const meetings: WsMeeting[] = [
    {
      id: 'mtg-t3-1',
      projectId: T,
      title: 'Kick-off: agree what counts as a wait',
      date: '2026-11-03' as DateOnly,
      start: '18:30' as LocalTime,
      end: '19:15' as LocalTime,
      attendees: [A, B, C].map((userId) => ({
        userId,
        required: userId !== B,
        rsvp: userId === B ? ('INVITED' as const) : ('YES' as const),
      })),
      status: 'confirmed',
      organizerId: A,
      createdAt: SEED_AT,
      revision: 1,
      dataMode: 'demoSeed',
    },
  ]
  const decisionsAll = [
    dec('dec-t3-0', T, 'Which meals does the group look at first?', {
      options: ['Lunch', 'All three meals'],
      outcome: 'Lunch first, because two of us report it as the longest wait.',
      decidedBy: A,
      decidedOn: '2026-11-03' as DateOnly,
      evidenceIds: ['src-t3-demo-student-a-lunch', 'src-t3-demo-student-b-lunch'],
    }),
  ]
  const polls: WsPoll[] = [
    {
      id: 'poll-t3-1',
      projectId: T,
      title: 'Evidence merge session',
      durationMin: 45,
      candidates: [
        {
          id: 'opt-t3-1',
          date: '2026-11-06' as DateOnly,
          start: '10:00' as LocalTime,
          end: '10:45' as LocalTime,
        },
        {
          id: 'opt-t3-2',
          date: '2026-11-07' as DateOnly,
          start: '12:00' as LocalTime,
          end: '12:45' as LocalTime,
        },
        {
          id: 'opt-t3-3',
          date: '2026-11-07' as DateOnly,
          start: '13:00' as LocalTime,
          end: '13:45' as LocalTime,
        },
      ],
      voters: [A, B, C].map((userId) => ({ userId, required: true })),
      votes: [],
      roomPlan: 'none',
      status: 'open',
      createdBy: A,
      createdAt: SEED_AT,
      dataMode: 'demoSeed',
    },
  ]
  const canvas: Canvas = {
    id: 'cv-t3-1',
    spaceId: TEAM_SPACE_ID,
    title: 'How a wait becomes a time tax',
    authorId: C,
    audience: 'space',
    cards: [
      { id: 'k1', kind: 'text', text: 'A visible queue', x: 40, y: 40 },
      { id: 'k2', kind: 'text', text: 'The real capacity limit', x: 300, y: 40 },
      { id: 'k4', kind: 'page', pageId: 'pg-t3-evidence', x: 40, y: 150 },
      { id: 'k5', kind: 'page', pageId: 'pg-t3-one-place', x: 300, y: 150 },
      { id: 'k6', kind: 'text', text: 'One place for the group', x: 560, y: 150 },
    ].filter(
      (c) => c.kind === 'text' || c.pageId !== 'pg-tt-bottleneck-placeholder',
    ) as Canvas['cards'],
    edges: [
      { id: 'e1', from: 'k1', to: 'k2', label: 'may sit downstream of' },
      { id: 'e2', from: 'k4', to: 'k1', label: 'describes' },
      { id: 'e3', from: 'k5', to: 'k6', label: 'argues for' },
    ],
    layoutRevision: 1,
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  }
  return {
    ...s,
    pages: add(s.pages, pages),
    comments: add(s.comments, comments),
    reviews: add(s.reviews, reviews),
    meetings: add(s.meetings, meetings),
    decisions: add(
      s.decisions.filter((d) => d.id !== 'dec-t3-0'),
      decisionsAll,
    ),
    sources: add(s.sources, evidenceRows()),
    polls: add(s.polls, polls),
    canvases: add(s.canvases, [canvas]),
    projects: s.projects.map((p) => (p.id === T ? { ...p, deadline: undefined } : p)),
    activity: add(s.activity, [
      {
        id: 'act-t3-1',
        actorId: B,
        spaceId: TEAM_SPACE_ID,
        entityId: 'pg-t3-evidence',
        type: 'page',
        text: 'Added the evidence summary',
        href: '/workspace/pages/pg-t3-evidence',
        at: at(3, '11:20'),
        dataMode: 'demoSeed',
      },
      {
        id: 'act-t3-2',
        actorId: C,
        spaceId: TEAM_SPACE_ID,
        entityId: 'pg-t3-one-place',
        type: 'page',
        text: 'Requested a review of “Why one place beats five”',
        href: '/workspace/pages/pg-t3-one-place',
        at: at(3, '14:30'),
        dataMode: 'demoSeed',
      },
      {
        id: 'act-t3-3',
        actorId: A,
        spaceId: TEAM_SPACE_ID,
        entityId: 'poll-t3-1',
        type: 'meeting',
        text: 'Opened a poll for the evidence merge session',
        href: `/workspace/projects/${T}?tab=calendar`,
        at: at(3, '15:20'),
        dataMode: 'demoSeed',
      },
    ]),
  }
}

function addClubProject(s: WorkspaceStore): WorkspaceStore {
  if (s.spaces.some((x) => x.id === CLUB_SPACE_ID)) return s
  const space: Space = {
    id: CLUB_SPACE_ID,
    type: 'club',
    title: 'Rangrez showcase planning',
    ownerId: B,
    purpose:
      'Plan the Rangrez open-mic and creative showcase proposed for 14 Nov (Clubs & Committees calendar). Sample planning content for the two organisers.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  }
  const members: Member[] = [
    mem(CLUB_SPACE_ID, B, 'owner'),
    mem(CLUB_SPACE_ID, C, 'editor'),
    { spaceId: CLUB_SPACE_ID, userId: A, role: 'commenter', joinedAt: at(3, '08:30') },
  ]
  const project: Project = {
    id: CLUB_PROJECT_ID,
    spaceId: CLUB_SPACE_ID,
    title: 'Rangrez: open mic & creative showcase',
    purpose:
      'Music, poetry, stand-up, dance and student performances (event as proposed in the club calendar).',
    ownerId: B,
    targetDate: '2026-11-14' as DateOnly,
    status: 'active',
    homePageId: 'pg-c3-plan',
    createdAt: SEED_AT,
    dataMode: 'demoSeed',
  }
  const P = (
    id: string,
    title: string,
    author: string,
    blocks: Block[],
    extra: Partial<Page> = {},
  ) => page(id, CLUB_SPACE_ID, title, author, blocks, { projectId: CLUB_PROJECT_ID, ...extra })
  const pages = [
    P(
      'pg-c3-plan',
      'Event plan',
      B,
      [
        blk(
          'p1',
          'paragraph',
          'Purpose: an evening where students perform music, poetry, stand-up and dance. Proposed date: 14 Nov (a club-calendar proposal, not a confirmed booking).',
        ),
        blk('p2', 'h2', 'Team'),
        blk('p3', 'bullet', 'Abeer: vendors, sponsors and sound'),
        blk('p4', 'bullet', 'Myra: rooms, props and owners for each task'),
        blk('p5', 'h2', 'Plan pages'),
        blk('p6', 'bullet', 'Run sheet: [[pg-c3-run]]'),
        blk('p7', 'bullet', 'Follow-ups: [[pg-c3-follow]]'),
        blk('p8', 'bullet', 'Resources: [[pg-c3-resources]]'),
      ],
      { icon: '🎤', lifecycle: 'approved' },
    ),
    P(
      'pg-c3-run',
      'Run sheet',
      C,
      [
        blk('r1', 'paragraph', 'Draft run sheet. Times are proposals until a room is booked.'),
        blk('r2', 'numbered', 'Doors and sound check'),
        blk('r3', 'numbered', 'Opening and host introduction'),
        blk('r4', 'numbered', 'Performance slots, six minutes each'),
        blk('r5', 'numbered', 'Open mic'),
        blk('r6', 'numbered', 'Wrap-up and thanks'),
      ],
      { noteType: 'note' },
    ),
    P(
      'pg-c3-follow',
      'Vendor and sponsor follow-ups',
      B,
      [
        blk('f1', 'paragraph', 'One place for the follow-ups that used to live in separate chats.'),
        blk('f2', 'todo', 'Call the cultural event vendor about sound and lighting'),
        blk('f3', 'todo', 'Confirm the sponsor follow-up and what they will receive'),
        blk('f4', 'todo', 'Agree who replies to performers who have signed up'),
      ],
      { noteType: 'meeting' },
    ),
    P('pg-c3-resources', 'Resource checklist', C, [
      blk('s1', 'todo', 'Room: book through Bookings → Classrooms once the date is agreed'),
      blk('s2', 'todo', 'Collect the props parcel from the guard room'),
      blk('s3', 'todo', 'Laundry pick-up for costumes before the event'),
      blk('s4', 'todo', 'Microphones and a speaker'),
    ]),
  ]
  const t = (
    id: string,
    title: string,
    who: string,
    status: WorkTask['status'],
    day: number,
    deps: string[] = [],
  ) => task(id, CLUB_PROJECT_ID, title, who, status, day, deps, { createdBy: B })
  const tasks = [
    t('tsk-c3-1', 'Call the cultural event vendor', B, 'inProgress', 4),
    t('tsk-c3-2', 'Confirm the sponsor follow-up', B, 'ready', 6),
    t('tsk-c3-3', 'Assign an owner to every task', C, 'ready', 5),
    t('tsk-c3-4', 'Collect the props parcel from the guard room', C, 'ready', 6),
    t('tsk-c3-5', 'Book a rehearsal room', C, 'backlog', 9, ['tsk-c3-3']),
    t('tsk-c3-6', 'Finalize the run sheet', B, 'backlog', 10, ['tsk-c3-1', 'tsk-c3-3']),
  ]
  const decisions = [
    dec('dec-c3-1', CLUB_PROJECT_ID, 'Which room do we rehearse in?', {
      options: ['A classroom booked for the evening', 'The library discussion room'],
      revisitWhen: 'After owners are assigned',
    }),
    dec('dec-c3-2', CLUB_PROJECT_ID, 'How many performance slots?', {
      options: ['6', '8', '10'],
      outcome: 'Eight slots of six minutes, plus open mic.',
      decidedBy: B,
      decidedOn: '2026-11-03' as DateOnly,
    }),
  ]
  const meeting: WsMeeting = {
    id: 'mtg-c3-1',
    projectId: CLUB_PROJECT_ID,
    title: 'Vendor call preparation',
    date: '2026-11-05' as DateOnly,
    start: '16:15' as LocalTime,
    end: '17:00' as LocalTime,
    attendees: [B, C].map((userId) => ({
      userId,
      required: true,
      rsvp: userId === B ? ('YES' as const) : ('INVITED' as const),
    })),
    status: 'confirmed',
    organizerId: B,
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  }
  return {
    ...s,
    spaces: [...s.spaces, space],
    members: [...s.members, ...members],
    projects: [...s.projects, project],
    pages: add(s.pages, pages),
    tasks: add(s.tasks, tasks),
    decisions: add(s.decisions, decisions),
    meetings: add(s.meetings, [meeting]),
    comments: add(s.comments, [
      {
        id: 'cmt-c3-1',
        pageId: 'pg-c3-follow',
        blockId: 'f2',
        quote: 'Call the cultural event vendor about sound and lighting',
        authorId: C,
        body: 'Can the vendor also confirm what they need in the room?',
        createdAt: at(3, '13:00'),
        dataMode: 'demoSeed',
      },
    ]),
    activity: add(s.activity, [
      {
        id: 'act-c3-1',
        actorId: B,
        spaceId: CLUB_SPACE_ID,
        entityId: 'pg-c3-plan',
        type: 'page',
        text: 'Created the event plan',
        href: '/workspace/pages/pg-c3-plan',
        at: at(3, '10:00'),
        dataMode: 'demoSeed',
      },
      {
        id: 'act-c3-2',
        actorId: B,
        spaceId: CLUB_SPACE_ID,
        entityId: 'dec-c3-2',
        type: 'decision',
        text: 'Decided: eight performance slots',
        href: `/workspace/projects/${CLUB_PROJECT_ID}?tab=decisions`,
        at: at(3, '14:30'),
        dataMode: 'demoSeed',
      },
    ]),
  }
}

/** Each persona's private notes, from their own courses, tasks and Time Tax evidence. */
function addPersonal(s: WorkspaceStore, p: (typeof PERSONAS)[number]): WorkspaceStore {
  const sp = `sp-me-${p.id}`
  const space: Space = {
    id: sp,
    type: 'personal',
    title: `${p.full}'s notes`,
    ownerId: p.id,
    purpose: 'Private capture, notes and plans. Only you can open these.',
    createdAt: SEED_AT,
    revision: 1,
    dataMode: 'demoSeed',
  }
  const id = (k: string) => `pg-${p.id.replace('demo-student-', '')}-${k}`
  const mine = (k: string, title: string, blocks: Block[], extra: Partial<Page> = {}) =>
    page(id(k), sp, title, p.id, blocks, { audience: 'private', ...extra })
  const courses = curriculum[p.sem]!
  const pick =
    p.sem === 1 ? courses.slice(0, 4) : [courses[2]!, courses[3]!, courses[4]!, courses[0]!]
  const note = (c: (typeof courses)[number]) =>
    mine(
      `course-${courseId(c.code)}`,
      `${c.name} (${c.code})`,
      [
        blk('a', 'paragraph', `${c.credits} credits. My notebook for this course.`),
        blk('b', 'h2', 'Lecture notes'),
        blk('c', 'paragraph', ''),
        blk('d', 'h2', 'Concepts'),
        blk('e', 'bullet', ''),
        blk('f', 'h2', 'Questions for class'),
        blk('g', 'todo', ''),
      ],
      { noteType: 'lecture', courseCode: c.code, icon: '📓', tags: [c.code.toLowerCase()] },
    )
  const pages: Page[] = pick.map(note)
  const captures: Capture[] = []
  const tasks = personaEvidence(p.id).filter((e) => e.includeInComposite)
  const waitsList = tasks.map(
    (e) => `${e.label}: baseline ${range(e.baseline)}, target ${range(e.target)}`,
  )
  if (p.id === A) {
    pages.push(
      mine(
        'quiz',
        'Quiz preparation',
        [
          blk(
            'a',
            'paragraph',
            'There is no single place to check a quiz’s time, venue or syllabus, so I keep them here.',
          ),
          blk('b', 'todo', 'Check the quiz venue and syllabus'),
          blk('c', 'todo', 'Prepare the group assignment outline'),
          blk('d', 'paragraph', 'Group work lives in [[pg-t3-work]].'),
        ],
        { noteType: 'revision', icon: '📝' },
      ),
      mine(
        'log',
        'Mess and laundry log',
        [
          blk(
            'a',
            'paragraph',
            'Waits I notice, to turn into timed observations in Time Tax → Observations.',
          ),
          ...waitsList.map((w, i) => blk(`w${i}`, 'bullet', w)),
        ],
        { noteType: 'field', tags: ['time-tax'] },
      ),
    )
    captures.push(
      {
        id: 'cap-a-1',
        ownerId: p.id,
        text: 'Ask whether breakfast is busier before 9',
        createdAt: at(3, '08:40'),
      },
      {
        id: 'cap-a-2',
        ownerId: p.id,
        text: 'Reserve a washing machine for Thursday',
        createdAt: at(3, '12:10'),
      },
    )
  } else if (p.id === B) {
    pages.push(
      mine(
        'ibo',
        'IBO presentation outline',
        [
          blk(
            'a',
            'paragraph',
            'Introduction to Business Operations: where does the time go in our own campus processes?',
          ),
          blk('b', 'h2', 'Outline'),
          blk('c', 'numbered', 'The problem: waiting, not working'),
          blk('d', 'numbered', 'Where the constraint really is: [[pg-t3-evidence]]'),
          blk('e', 'numbered', 'What the software changes'),
          blk('f', 'todo', 'Complete the IBO presentation'),
        ],
        { noteType: 'note', courseCode: 'IBO', icon: '🎯' },
      ),
      mine(
        'gym',
        'Gym and lunch routine',
        [
          blk(
            'a',
            'paragraph',
            'My two-hour gym visit and the 15-minute lunch queue. Which of the two can a booking change?',
          ),
          ...waitsList.map((w, i) => blk(`w${i}`, 'bullet', w)),
        ],
        { noteType: 'field', tags: ['time-tax'] },
      ),
    )
    captures.push(
      {
        id: 'cap-b-1',
        ownerId: p.id,
        text: 'Ask the sponsor what they need printed',
        createdAt: at(3, '09:15'),
      },
      {
        id: 'cap-b-2',
        ownerId: p.id,
        text: 'Gym slot after the committee meeting?',
        createdAt: at(3, '13:45'),
      },
    )
  } else {
    pages.push(
      mine(
        'club',
        'Club planning',
        [
          blk(
            'a',
            'paragraph',
            'Owners, rooms and dates for the events I organise. Shared version: [[pg-c3-plan]].',
          ),
          blk('b', 'todo', 'Assign club event owners'),
          blk('c', 'todo', 'Collect the parcel from the guard room'),
          blk('d', 'todo', 'Pick up laundry'),
        ],
        { noteType: 'note', icon: '🎪' },
      ),
      mine(
        'rooms',
        'Rooms, library and parcels',
        [
          blk('a', 'paragraph', 'A checked booking beats walking over to find a room full.'),
          ...waitsList.map((w, i) => blk(`w${i}`, 'bullet', w)),
        ],
        { noteType: 'field', tags: ['time-tax'] },
      ),
    )
    captures.push(
      {
        id: 'cap-c-1',
        ownerId: p.id,
        text: 'Check whether the library cabin is free after 4',
        createdAt: at(3, '15:20'),
      },
      {
        id: 'cap-c-2',
        ownerId: p.id,
        text: 'Remind the club about the props parcel',
        createdAt: at(3, '14:30'),
      },
    )
  }
  return {
    ...s,
    spaces: s.spaces.some((x) => x.id === sp) ? s.spaces : [...s.spaces, space],
    pages: add(s.pages, pages),
    captures: add(s.captures, captures),
  }
}

/**
 * Sample Workspace content for the three source-backed personas, built from their courses, tasks, clubs and
 * Time Tax records. Idempotent: every record has a fixed ID, and `seedVersion` records that it was added.
 * It is labelled sample content and removable; it never claims a measurement.
 */
export function withPersonaWorkspace(s: WorkspaceStore): WorkspaceStore {
  if (s.seedVersion) return s
  let out = extendTeam(withTeamProject(s))
  out = addClubProject(out)
  for (const p of PERSONAS) out = addPersonal(out, p)
  return { ...out, seedVersion: SEED_VERSION }
}
