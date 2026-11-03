import { fail, ok, type Change, type Ctx } from './service-core'
import { createPage, createProject, createSpace } from './workspace-logic'
import type { Block, Page, WorkspaceStore } from './workspace'

/**
 * Templates give useful STRUCTURE, never findings (spec §11): headings and prompts the author fills
 * in. Creating one is idempotent through its operation id, so a double click makes one copy.
 */
type Section = [kind: 'h' | 'p' | 'b' | 't', text: string]

export interface Template {
  id: string
  name: string
  blurb: string
  kind: 'page' | 'team'
  noteType: Page['noteType']
  icon: string
  sections: Section[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'course-notebook',
    name: 'Course notebook',
    blurb: 'Lecture notes, concepts, questions and a revision queue for one course.',
    kind: 'page',
    noteType: 'lecture',
    icon: '📓',
    sections: [
      ['h', 'Course'],
      ['p', 'Course and term:'],
      ['h', 'Lecture notes'],
      ['p', ''],
      ['h', 'Concepts'],
      ['b', ''],
      ['h', 'Open questions'],
      ['b', ''],
      ['h', 'Revision queue'],
      ['t', 'Revisit before the next class'],
    ],
  },
  {
    id: 'lecture-note',
    name: 'Lecture note',
    blurb: 'One session: key ideas, examples, doubts and related concepts.',
    kind: 'page',
    noteType: 'lecture',
    icon: '🎓',
    sections: [
      ['h', 'Session'],
      ['p', 'Date and topic:'],
      ['h', 'Key ideas'],
      ['b', ''],
      ['h', 'Examples'],
      ['b', ''],
      ['h', 'Doubts'],
      ['t', ''],
      ['h', 'Related concepts'],
      ['p', 'Link notes with [[ and a title.'],
    ],
  },
  {
    id: 'team-assignment',
    name: 'Team assignment',
    blurb: 'A shared space and project: brief, deliverables, tasks, sources and decisions.',
    kind: 'team',
    noteType: 'note',
    icon: '🧩',
    sections: [
      ['h', 'Brief'],
      ['p', 'What was asked, in the professor’s words:'],
      ['h', 'Audience'],
      ['p', ''],
      ['h', 'Deliverables'],
      ['t', ''],
      ['h', 'Who does what'],
      ['p', 'Add tasks in the Tasks tab so each has one owner.'],
      ['h', 'Sources'],
      ['p', 'Use the evidence register in the Docs tab.'],
      ['h', 'Decisions'],
      ['p', 'Record decisions in the Decisions tab.'],
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting',
    blurb: 'Purpose, agenda, preparation, decisions, actions and the next meeting.',
    kind: 'page',
    noteType: 'meeting',
    icon: '🗓️',
    sections: [
      ['h', 'Purpose'],
      ['p', ''],
      ['h', 'Agenda'],
      ['b', ''],
      ['h', 'Preparation'],
      ['b', ''],
      ['h', 'Decisions'],
      ['b', ''],
      ['h', 'Actions'],
      ['t', ''],
      ['h', 'Next meeting'],
      ['p', ''],
    ],
  },
  {
    id: 'research-evidence',
    name: 'Research evidence',
    blurb: 'Claim, source, method, finding and limitations for one piece of evidence.',
    kind: 'page',
    noteType: 'research',
    icon: '🔎',
    sections: [
      ['h', 'Claim'],
      ['p', ''],
      ['h', 'Source'],
      ['p', ''],
      ['h', 'Method'],
      ['p', ''],
      ['h', 'Finding'],
      ['p', ''],
      ['h', 'Limitations'],
      ['b', ''],
      ['h', 'Related argument'],
      ['p', ''],
    ],
  },
  {
    id: 'field-observation',
    name: 'Field observation',
    blurb: 'Site, time, observer and method, with raw observations kept apart from interpretation.',
    kind: 'page',
    noteType: 'field',
    icon: '🧭',
    sections: [
      ['h', 'Site, date and time'],
      ['p', ''],
      ['h', 'Observer and method'],
      ['p', ''],
      ['h', 'Raw observations'],
      ['b', ''],
      ['h', 'Interpretation'],
      ['p', 'Write this only after the raw observations are complete.'],
    ],
  },
  {
    id: 'club-event',
    name: 'Club event',
    blurb: 'A shared space and project: purpose, checklist, resources, risks and run sheet.',
    kind: 'team',
    noteType: 'note',
    icon: '🎉',
    sections: [
      ['h', 'Purpose'],
      ['p', ''],
      ['h', 'Date and team'],
      ['p', ''],
      ['h', 'Checklist'],
      ['t', ''],
      ['h', 'Resources'],
      ['b', ''],
      ['h', 'Risks'],
      ['b', ''],
      ['h', 'Run sheet'],
      ['b', ''],
      ['h', 'Retrospective'],
      ['p', 'Fill in after the event.'],
    ],
  },
  {
    id: 'revision-sheet',
    name: 'Revision sheet',
    blurb: 'Topics, formulas, examples, common mistakes and practice questions.',
    kind: 'page',
    noteType: 'revision',
    icon: '📝',
    sections: [
      ['h', 'Topics'],
      ['b', ''],
      ['h', 'Formulas'],
      ['b', ''],
      ['h', 'Worked examples'],
      ['b', ''],
      ['h', 'Common mistakes'],
      ['b', ''],
      ['h', 'Practice questions'],
      ['t', ''],
    ],
  },
  {
    id: 'weekly-review',
    name: 'Weekly review',
    blurb: 'Completed, unfinished, blockers, upcoming and next priorities.',
    kind: 'page',
    noteType: 'note',
    icon: '📅',
    sections: [
      ['h', 'Completed'],
      ['b', ''],
      ['h', 'Unfinished'],
      ['b', ''],
      ['h', 'Blockers'],
      ['b', ''],
      ['h', 'Upcoming'],
      ['b', ''],
      ['h', 'What I learned'],
      ['p', ''],
      ['h', 'Next priorities'],
      ['t', ''],
    ],
  },
  {
    id: 'handover',
    name: 'Handover',
    blurb: 'Role, recurring work, open issues and documents for whoever comes next.',
    kind: 'page',
    noteType: 'note',
    icon: '🤝',
    sections: [
      ['h', 'Role'],
      ['p', ''],
      ['h', 'Recurring work'],
      ['b', ''],
      ['h', 'Open issues'],
      ['t', ''],
      ['h', 'Documents'],
      ['b', ''],
      ['h', 'Who to ask'],
      ['p', 'Name roles, not private contact details.'],
    ],
  },
]

const blocksOf = (t: Template, c: Ctx): Block[] =>
  t.sections.map(([k, text]) => ({
    id: c.newId('b'),
    type: k === 'h' ? 'h2' : k === 'b' ? 'bullet' : k === 't' ? 'todo' : 'paragraph',
    text,
  }))

export interface Created {
  pageId: string
  spaceId: string
  projectId?: string
}

/**
 * A page template goes to `spaceId` (the actor's personal space by default). A team template makes a
 * new space with the actor as Owner, a project and a home page, in one step.
 */
export function instantiateTemplate(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  templateId: string,
  i: { title: string; spaceId?: string; opId: string },
): Change<WorkspaceStore, Created> {
  const t = TEMPLATES.find((x) => x.id === templateId)
  if (!t) return fail('That template does not exist.')
  const title = i.title.trim() || t.name
  if (t.kind === 'page') {
    const personal = s.spaces.find((x) => x.type === 'personal' && x.ownerId === actor)
    const spaceId = i.spaceId ?? personal?.id
    if (!spaceId) return fail('Open your personal space first.')
    const r = createPage(s, c, actor, {
      spaceId,
      title,
      blocks: blocksOf(t, c),
      noteType: t.noteType,
      icon: t.icon,
      opId: i.opId,
    })
    return r.ok ? ok(r.store, { pageId: r.value.id, spaceId }) : r
  }
  const sp = createSpace(s, c, actor, {
    type: t.id === 'club-event' ? 'club' : 'project',
    title,
    opId: i.opId,
  })
  if (!sp.ok) return sp
  const page = createPage(sp.store, c, actor, {
    spaceId: sp.value.id,
    title: `${title}: overview`,
    blocks: blocksOf(t, c),
    noteType: t.noteType,
    icon: t.icon,
    opId: `${i.opId}:page`,
  })
  if (!page.ok) return page
  const prj = createProject(page.store, c, actor, {
    spaceId: sp.value.id,
    title,
    homePageId: page.value.id,
    opId: `${i.opId}:project`,
  })
  if (!prj.ok) return prj
  const withProject = {
    ...prj.store,
    pages: prj.store.pages.map((p) =>
      p.id === page.value.id ? { ...p, projectId: prj.value.id } : p,
    ),
  }
  return ok(withProject, { pageId: page.value.id, spaceId: sp.value.id, projectId: prj.value.id })
}
