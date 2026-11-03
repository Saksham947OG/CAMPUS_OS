import type { DateOnly, LocalTime } from '@/lib/time'
import { timeToMinutes } from '@/lib/time/calendar'
import { fail, ok, type Change, type Ctx } from './service-core'
import { addLog, direct, fire, NOTHING, ruleOn } from './workspace-auto'
import { can, canEditPage, canReadPage, istDate, roleOf } from './workspace-access'
import {
  blockSchema,
  pageSchema,
  taskSchema,
  type Activity,
  type Block,
  type Capture,
  type Comment,
  type Decision,
  type EvidenceSource,
  type Member,
  type Page,
  type Project,
  type Review,
  type Revision,
  type Role,
  type Space,
  type TaskStatus,
  type WorkTask,
  type WorkspaceStore,
  type WsMeeting,
  type WsRsvp,
} from './workspace'

/**
 * Every Workspace change is one pure rule: (store, context, actor, input) → new store or a plain
 * reason. Nothing here reads a clock, storage or React. A refused change returns the reason and
 * leaves the store untouched, so a failed save never loses what was already there.
 */
type Out<T> = Change<WorkspaceStore, T>

const MAX_REVISIONS = 30
const MAX_ACTIVITY = 400

const log = (
  s: WorkspaceStore,
  c: Ctx,
  actorId: string,
  spaceId: string,
  entityId: string,
  type: string,
  text: string,
  href?: string,
  dataMode: Activity['dataMode'] = 'userCreated',
): Activity[] =>
  [
    {
      id: c.newId('act'),
      actorId,
      spaceId,
      entityId,
      type,
      text: text.slice(0, 240),
      ...(href ? { href } : {}),
      at: c.nowIso,
      dataMode,
    },
    ...s.activity,
  ].slice(0, MAX_ACTIVITY)

const seen = (s: WorkspaceStore, opId: string | undefined) =>
  opId ? s.ops.find((o) => o.id === opId) : undefined
const remember = (s: WorkspaceStore, opId: string | undefined, ref: string) =>
  opId ? [...s.ops, { id: opId, ref }].slice(-300) : s.ops

const spaceOf = (s: WorkspaceStore, id: string) => s.spaces.find((x) => x.id === id)
const pageOf = (s: WorkspaceStore, id: string) => s.pages.find((x) => x.id === id)
const projectOf = (s: WorkspaceStore, id: string) => s.projects.find((x) => x.id === id)
const taskOf = (s: WorkspaceStore, id: string) => s.tasks.find((x) => x.id === id)

const NO_ROLE = 'You do not have access to that space.'
const modeOf = (s: WorkspaceStore, spaceId: string): 'userCreated' | 'demoSeed' =>
  spaceOf(s, spaceId)?.dataMode ?? 'userCreated'

/* ---------- spaces and members ---------- */

export function ensurePersonalSpace(
  s: WorkspaceStore,
  c: Ctx,
  userId: string,
  displayName: string,
): Out<Space> {
  const existing = s.spaces.find((x) => x.type === 'personal' && x.ownerId === userId)
  if (existing) return ok(s, existing)
  const space: Space = {
    id: `sp-me-${userId}`,
    type: 'personal',
    title: `${displayName}'s notes`,
    ownerId: userId,
    purpose: 'Private capture, notes and plans. Only you can open these.',
    createdAt: c.nowIso,
    revision: 1,
    dataMode: s.people.some((p) => p.id === userId) ? 'demoSeed' : 'userCreated',
  }
  return ok({ ...s, spaces: [...s.spaces, space] }, space)
}

export interface NewSpace {
  type: Exclude<Space['type'], 'personal'>
  title: string
  purpose?: string
  /** Other members besides the creator, who becomes the Owner. */
  members?: { userId: string; role: Role }[]
  opId?: string
}

export function createSpace(s: WorkspaceStore, c: Ctx, actor: string, i: NewSpace): Out<Space> {
  const prior = seen(s, i.opId)
  if (prior) {
    const found = spaceOf(s, prior.ref)
    if (found) return ok(s, found)
  }
  const title = i.title.trim()
  if (!title) return fail('Give the space a name.')
  const space: Space = {
    id: c.newId('sp'),
    type: i.type,
    title: title.slice(0, 120),
    ownerId: actor,
    ...(i.purpose?.trim() ? { purpose: i.purpose.trim().slice(0, 400) } : {}),
    createdAt: c.nowIso,
    revision: 1,
    dataMode: 'userCreated',
  }
  const members: Member[] = [
    { spaceId: space.id, userId: actor, role: 'owner', joinedAt: c.nowIso },
    ...(i.members ?? [])
      .filter((m) => m.userId !== actor)
      .map((m) => ({ spaceId: space.id, userId: m.userId, role: m.role, joinedAt: c.nowIso })),
  ]
  return ok(
    {
      ...s,
      spaces: [...s.spaces, space],
      members: [...s.members, ...members],
      ops: remember(s, i.opId, space.id),
      activity: log(
        s,
        c,
        actor,
        space.id,
        space.id,
        'space',
        `Created the space “${space.title}”`,
        `/workspace/spaces/${space.id}`,
      ),
    },
    space,
  )
}

export function changeRole(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  spaceId: string,
  userId: string,
  role: Role,
): Out<Member> {
  if (!can(roleOf(s, spaceId, actor), 'manage')) return fail('Only an Owner can change roles.')
  const m = s.members.find((x) => x.spaceId === spaceId && x.userId === userId)
  if (!m) return fail('That person is not in this space.')
  const owners = s.members.filter((x) => x.spaceId === spaceId && x.role === 'owner')
  if (m.role === 'owner' && role !== 'owner' && owners.length === 1)
    return fail('A space needs an Owner. Make somebody else an Owner first.')
  const next = { ...m, role }
  return ok(
    {
      ...s,
      members: s.members.map((x) => (x === m ? next : x)),
      activity: log(s, c, actor, spaceId, userId, 'role', `Changed a role to ${role}`),
    },
    next,
  )
}

export function addMember(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  spaceId: string,
  userId: string,
  role: Role,
): Out<Member> {
  if (!can(roleOf(s, spaceId, actor), 'manage')) return fail('Only an Owner can add people.')
  if (spaceOf(s, spaceId)?.type === 'personal') return fail('A personal space is only yours.')
  if (s.members.some((x) => x.spaceId === spaceId && x.userId === userId))
    return fail('That person is already in this space.')
  // A fictional demo member joins at once. A real CampusOS profile must accept first (spec §2.2).
  const invite = !s.people.some((p) => p.id === userId)
  const m: Member = {
    spaceId,
    userId,
    role,
    joinedAt: c.nowIso,
    ...(invite ? { invitation: 'pending' as const, invitedBy: actor } : {}),
  }
  const space = spaceOf(s, spaceId)!
  return ok(
    {
      ...s,
      members: [...s.members, m],
      activity: log(
        s,
        c,
        actor,
        spaceId,
        userId,
        'member',
        invite ? `Invited a ${role}` : `Added a ${role}`,
      ),
    },
    m,
    invite
      ? direct(
          s,
          actor,
          `invite|${spaceId}`,
          [userId],
          `Invitation to ${space.title}`,
          `You were invited to a Workspace space as ${role}. Open Workspace to accept or decline.`,
          '/workspace',
        )
      : [],
  )
}

/** The invited person answers for themselves. Declining keeps a record so the owner can see it. */
export function respondInvite(
  s: WorkspaceStore,
  c: Ctx,
  userId: string,
  spaceId: string,
  accept: boolean,
): Out<Member> {
  const m = s.members.find((x) => x.spaceId === spaceId && x.userId === userId)
  if (!m || m.invitation !== 'pending') return fail('There is no open invitation to answer.')
  const { invitation: _i, ...rest } = m
  void _i
  const next: Member = accept ? { ...rest, joinedAt: c.nowIso } : { ...m, invitation: 'declined' }
  return ok(
    {
      ...s,
      members: s.members.map((x) => (x === m ? next : x)),
      activity: accept
        ? log(s, c, userId, spaceId, userId, 'member', 'Joined the space')
        : s.activity,
    },
    next,
    m.invitedBy
      ? direct(
          s,
          userId,
          `invite-answer|${spaceId}|${accept}`,
          [m.invitedBy],
          accept ? 'Invitation accepted' : 'Invitation declined',
          `${accept ? 'Joined' : 'Declined'}: ${spaceOf(s, spaceId)?.title ?? 'your space'}.`,
          `/workspace/spaces/${spaceId}`,
        )
      : [],
  )
}

export const pendingInvites = (s: WorkspaceStore, userId: string) =>
  s.members.filter((m) => m.userId === userId && m.invitation === 'pending')

export function removeMember(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  spaceId: string,
  userId: string,
): Out<void> {
  if (!can(roleOf(s, spaceId, actor), 'manage')) return fail('Only an Owner can remove people.')
  const m = s.members.find((x) => x.spaceId === spaceId && x.userId === userId)
  if (!m) return fail('That person is not in this space.')
  if (
    m.role === 'owner' &&
    s.members.filter((x) => x.spaceId === spaceId && x.role === 'owner').length === 1
  )
    return fail('The last Owner cannot leave. Transfer ownership first.')
  return ok(
    {
      ...s,
      members: s.members.filter((x) => x !== m),
      tasks: s.tasks.map((t) =>
        t.assigneeId === userId && projectOf(s, t.projectId)?.spaceId === spaceId
          ? { ...t, assigneeId: undefined }
          : t,
      ),
      activity: log(s, c, actor, spaceId, userId, 'member', 'Removed a member'),
    },
    undefined,
  )
}

/* ---------- pages ---------- */

export interface NewPage {
  spaceId: string
  parentId?: string
  title: string
  blocks?: Block[]
  audience?: Page['audience']
  noteType?: Page['noteType']
  projectId?: string
  tags?: string[]
  icon?: string
  courseCode?: string
  dailyDate?: DateOnly
  opId?: string
}

export const newBlock = (c: Ctx, type: Block['type'] = 'paragraph', text = ''): Block => ({
  id: c.newId('b'),
  type,
  text,
})

export function createPage(s: WorkspaceStore, c: Ctx, actor: string, i: NewPage): Out<Page> {
  const prior = seen(s, i.opId)
  if (prior) {
    const found = pageOf(s, prior.ref)
    if (found) return ok(s, found)
  }
  const space = spaceOf(s, i.spaceId)
  if (!space) return fail('That space no longer exists.')
  if (!can(roleOf(s, i.spaceId, actor), 'edit'))
    return fail('You can read this space but not add pages to it.')
  if (i.parentId && pageOf(s, i.parentId)?.spaceId !== i.spaceId)
    return fail('The parent page is in a different space.')
  if (i.dailyDate) {
    const daily = s.pages.find(
      (p) => p.dailyDate === i.dailyDate && p.authorId === actor && !p.trashedAt,
    )
    if (daily) return ok(s, daily)
  }
  const audience: Page['audience'] = space.type === 'personal' ? 'private' : (i.audience ?? 'space')
  if (space.type === 'personal' && i.audience === 'space')
    return fail(
      'Pages in your personal space stay private. Move the page to a team space to share it.',
    )
  const page: Page = {
    id: c.newId('pg'),
    spaceId: i.spaceId,
    ...(i.parentId ? { parentId: i.parentId } : {}),
    title: i.title.trim().slice(0, 120),
    ...(i.icon ? { icon: i.icon } : {}),
    blocks: i.blocks?.length ? i.blocks : [newBlock(c)],
    authorId: actor,
    audience,
    lifecycle: 'draft',
    tags: i.tags ?? [],
    noteType: i.noteType ?? 'note',
    ...(i.projectId ? { projectId: i.projectId } : {}),
    ...(i.courseCode ? { courseCode: i.courseCode } : {}),
    ...(i.dailyDate ? { dailyDate: i.dailyDate } : {}),
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    revision: 1,
    dataMode: modeOf(s, i.spaceId),
  }
  const parsed = pageSchema.safeParse(page)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'That page is not valid.')
  return ok(
    {
      ...s,
      pages: [...s.pages, page],
      ops: remember(s, i.opId, page.id),
      activity:
        audience === 'space'
          ? log(
              s,
              c,
              actor,
              i.spaceId,
              page.id,
              'page',
              `Created “${page.title || 'Untitled'}”`,
              `/workspace/pages/${page.id}`,
            )
          : s.activity,
    },
    page,
  )
}

const sig = (b: Block) =>
  `${b.type}|${b.text}|${b.checked ?? ''}|${b.taskId ?? ''}|${b.workTaskId ?? ''}`

/**
 * Three-way merge by block id: `base` is what the editor opened, `theirs` is what is saved now and
 * `mine` is what this editor wants to save. Each side's edits, insertions and deletions are kept; if
 * both edited the same block, the saved text stays and mine is kept right after it as a new block, so
 * nothing anybody typed is lost. Moving blocks is not merged: the saved order wins.
 */
export function mergeBlocks(
  base: readonly Block[],
  theirs: readonly Block[],
  mine: readonly Block[],
  newId: () => string,
): Block[] {
  const B = new Map(base.map((b) => [b.id, b]))
  const M = new Map(mine.map((b) => [b.id, b]))
  const out: Block[] = []
  const T = new Set(theirs.map((b) => b.id))
  for (const t of theirs) {
    const b = B.get(t.id)
    const m = M.get(t.id)
    if (!b) {
      out.push(t) // their new block
      continue
    }
    if (!m) {
      // I deleted it. Their edit wins over my delete; an untouched block stays deleted.
      if (sig(t) !== sig(b)) out.push(t)
      continue
    }
    if (sig(m) === sig(b) || sig(m) === sig(t)) out.push(t)
    else if (sig(t) === sig(b)) out.push(m)
    else {
      out.push(t, { ...m, id: newId(), text: `(your edit) ${m.text}` })
    }
  }
  // Blocks only I have: my insertions, and blocks they deleted that I edited. Keep each after its predecessor.
  mine.forEach((m, i) => {
    if (T.has(m.id)) return
    const b = B.get(m.id)
    if (b && sig(m) === sig(b)) return // they deleted it and I did not touch it
    let at = 0
    for (let k = i - 1; k >= 0; k--) {
      const j = out.findIndex((x) => x.id === mine[k]!.id)
      if (j >= 0) {
        at = j + 1
        break
      }
    }
    out.splice(at, 0, m)
  })
  return out.length ? out : [{ id: newId(), type: 'paragraph', text: '' }]
}

export interface PagePatch {
  title?: string
  blocks?: Block[]
  tags?: string[]
  icon?: string
  noteType?: Page['noteType']
}

export function savePage(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  expectedRevision: number,
  patch: PagePatch,
): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page || !canReadPage(s, page, actor)) return fail('That page is not available to you.')
  if (!canEditPage(s, page, actor)) return fail('You can read this page but not edit it.')
  if (page.trashedAt) return fail('This page is in the bin. Restore it before editing.')
  let eff = patch
  if (page.revision !== expectedRevision) {
    // Somebody saved since this editor opened. Merge by block so both people's changes survive (spec §8.1).
    const base = s.revisions.find((r) => r.pageId === pageId && r.revision === expectedRevision)
    if (!base)
      return fail(
        'This page was saved somewhere else since you opened it, and that version is no longer kept. Your text is still on screen; copy it, reload the page, then paste it back.',
      )
    const merged = mergeBlocks(base.blocks, page.blocks, patch.blocks ?? base.blocks, () =>
      c.newId('b'),
    )
    const mineTitle = patch.title ?? base.title
    eff = {
      ...patch,
      blocks: merged,
      // The title follows whoever changed it; if both did, the saved one wins.
      title: mineTitle !== base.title && page.title === base.title ? mineTitle : page.title,
    }
  }
  const blocks = eff.blocks ?? page.blocks
  for (const b of blocks)
    if (!blockSchema.safeParse(b).success) return fail('One of the blocks is too long to save.')
  const next: Page = {
    ...page,
    title: (eff.title ?? page.title).trim().slice(0, 120),
    blocks,
    tags: eff.tags ?? page.tags,
    noteType: eff.noteType ?? page.noteType,
    ...(eff.icon !== undefined ? { icon: eff.icon || undefined } : {}),
    revision: page.revision + 1,
    updatedAt: c.nowIso,
  }
  if (
    next.title === page.title &&
    next.blocks === page.blocks &&
    next.tags === page.tags &&
    next.noteType === page.noteType &&
    next.icon === page.icon
  )
    return ok(s, page)
  const snapshot: Revision = {
    id: c.newId('rev'),
    pageId,
    revision: page.revision,
    authorId: actor,
    at: page.updatedAt,
    title: page.title,
    blocks: page.blocks,
  }
  const keep = [...s.revisions.filter((r) => r.pageId === pageId), snapshot].slice(-MAX_REVISIONS)
  return ok(
    {
      ...s,
      pages: s.pages.map((p) => (p.id === pageId ? next : p)),
      revisions: [...s.revisions.filter((r) => r.pageId !== pageId), ...keep],
    },
    next,
  )
}

export function restoreRevision(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  revision: number,
): Out<Page> {
  const page = pageOf(s, pageId)
  const old = s.revisions.find((r) => r.pageId === pageId && r.revision === revision)
  if (!page || !old) return fail('That earlier version is no longer kept.')
  if (!canEditPage(s, page, actor)) return fail('You can read this page but not edit it.')
  // Restoring writes a NEW current revision; history is kept (spec §15).
  const r = savePage(s, c, actor, pageId, page.revision, { title: old.title, blocks: old.blocks })
  if (!r.ok) return r
  const restored = r.value
  return ok(
    {
      ...r.store,
      revisions: r.store.revisions.map((x) =>
        x.pageId === pageId && x.revision === page.revision ? { ...x, restoredFrom: revision } : x,
      ),
      activity: log(
        r.store,
        c,
        actor,
        page.spaceId,
        pageId,
        'restore',
        `Restored an earlier version of “${restored.title || 'Untitled'}”`,
        `/workspace/pages/${pageId}`,
      ),
    },
    restored,
  )
}

const patchPage = (s: WorkspaceStore, id: string, f: (p: Page) => Page) => ({
  ...s,
  pages: s.pages.map((p) => (p.id === id ? f(p) : p)),
})

export function setLifecycle(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  lifecycle: Page['lifecycle'],
): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page || !canEditPage(s, page, actor)) return fail('You cannot change this page.')
  if (page.lifecycle === lifecycle) return ok(s, page)
  const next = { ...page, lifecycle, updatedAt: c.nowIso }
  const label = {
    draft: 'Draft',
    inReview: 'In review',
    approved: 'Approved by the team',
    archived: 'Archived',
  }[lifecycle]
  return ok(
    {
      ...patchPage(s, pageId, () => next),
      activity: log(
        s,
        c,
        actor,
        page.spaceId,
        pageId,
        'lifecycle',
        `Marked “${page.title || 'Untitled'}” as ${label}`,
        `/workspace/pages/${pageId}`,
      ),
    },
    next,
  )
}

export function setAudience(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  audience: Page['audience'],
): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page || page.authorId !== actor)
    return fail('Only the author can change who can see a page.')
  if (spaceOf(s, page.spaceId)?.type === 'personal' && audience === 'space')
    return fail('Pages in your personal space stay private.')
  if (page.audience === audience) return ok(s, page)
  const next = { ...page, audience, updatedAt: c.nowIso }
  return ok(
    patchPage(s, pageId, () => next),
    next,
  )
}

export function trashPage(s: WorkspaceStore, c: Ctx, actor: string, pageId: string): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page || !canEditPage(s, page, actor)) return fail('You cannot remove this page.')
  const next = { ...page, trashedAt: c.nowIso }
  return ok(
    {
      ...patchPage(s, pageId, () => next),
      activity: log(
        s,
        c,
        actor,
        page.spaceId,
        pageId,
        'trash',
        `Moved “${page.title || 'Untitled'}” to the bin`,
      ),
    },
    next,
  )
}

export function restorePage(s: WorkspaceStore, c: Ctx, actor: string, pageId: string): Out<Page> {
  const page = pageOf(s, pageId)
  if (
    !page ||
    !can(roleOf(s, page.spaceId, actor), 'edit') ||
    (page.audience === 'private' && page.authorId !== actor)
  )
    return fail('You cannot restore this page.')
  const { trashedAt: _gone, ...rest } = page
  void _gone
  const next: Page = { ...rest, updatedAt: c.nowIso }
  return ok(
    patchPage(s, pageId, () => next),
    next,
  )
}

/** Permanent removal is a separate step from the bin, and only for a page already in it. */
export function deletePageForever(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  pageId: string,
): Out<void> {
  const page = pageOf(s, pageId)
  if (!page || !page.trashedAt) return fail('Only a page in the bin can be removed for good.')
  if (!canEditPage(s, page, actor)) return fail('You cannot remove this page.')
  return ok(
    {
      ...s,
      pages: s.pages
        .filter((p) => p.id !== pageId)
        .map((p) => (p.parentId === pageId ? { ...p, parentId: page.parentId } : p)),
      revisions: s.revisions.filter((r) => r.pageId !== pageId),
      comments: s.comments.filter((x) => x.pageId !== pageId),
      reviews: s.reviews.filter((x) => x.pageId !== pageId),
    },
    undefined,
  )
}

export function movePage(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  pageId: string,
  parentId: string | undefined,
): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page || !canEditPage(s, page, actor)) return fail('You cannot move this page.')
  if (parentId) {
    const parent = pageOf(s, parentId)
    if (!parent || parent.spaceId !== page.spaceId) return fail('Choose a page in the same space.')
    for (
      let at: Page | undefined = parent;
      at;
      at = at.parentId ? pageOf(s, at.parentId) : undefined
    )
      if (at.id === pageId) return fail('A page cannot be moved inside itself.')
  }
  const { parentId: _old, ...rest } = page
  void _old
  const next: Page = parentId ? { ...rest, parentId } : rest
  return ok(
    patchPage(s, pageId, () => next),
    next,
  )
}

/* ---------- projects and tasks ---------- */

export interface NewProject {
  spaceId: string
  title: string
  purpose?: string
  targetDate?: DateOnly
  deadline?: Project['deadline']
  courseCode?: string
  homePageId?: string
  opId?: string
}

export function createProject(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: NewProject,
): Out<Project> {
  const prior = seen(s, i.opId)
  if (prior) {
    const found = projectOf(s, prior.ref)
    if (found) return ok(s, found)
  }
  if (!can(roleOf(s, i.spaceId, actor), 'edit')) return fail(NO_ROLE)
  const title = i.title.trim()
  if (!title) return fail('Give the project a name.')
  const p: Project = {
    id: c.newId('prj'),
    spaceId: i.spaceId,
    title: title.slice(0, 120),
    ...(i.purpose?.trim() ? { purpose: i.purpose.trim().slice(0, 500) } : {}),
    ownerId: actor,
    ...(i.targetDate ? { targetDate: i.targetDate } : {}),
    ...(i.deadline ? { deadline: i.deadline } : {}),
    status: 'active',
    ...(i.homePageId ? { homePageId: i.homePageId } : {}),
    ...(i.courseCode ? { courseCode: i.courseCode } : {}),
    createdAt: c.nowIso,
    dataMode: modeOf(s, i.spaceId),
  }
  return ok(
    {
      ...s,
      projects: [...s.projects, p],
      ops: remember(s, i.opId, p.id),
      activity: log(
        s,
        c,
        actor,
        i.spaceId,
        p.id,
        'project',
        `Started the project “${p.title}”`,
        `/workspace/projects/${p.id}`,
      ),
    },
    p,
  )
}

export const isResolved = (t: WorkTask) => t.status === 'done' || t.status === 'canceled'

/** Prerequisites that are still open. A blocked task is never counted as free to finish. */
export const openPrerequisites = (s: WorkspaceStore, t: WorkTask): WorkTask[] =>
  t.dependsOn.map((d) => taskOf(s, d)).filter((d): d is WorkTask => !!d && !isResolved(d))

export const isBlocked = (s: WorkspaceStore, t: WorkTask) =>
  !isResolved(t) && (!!t.blockedReason || openPrerequisites(s, t).length > 0)

/** True when `from` can already reach `to` through dependencies (so adding the reverse edge makes a cycle). */
const reaches = (
  s: WorkspaceStore,
  from: string,
  to: string,
  seenIds = new Set<string>(),
): boolean => {
  if (from === to) return true
  if (seenIds.has(from)) return false
  seenIds.add(from)
  return (taskOf(s, from)?.dependsOn ?? []).some((d) => reaches(s, d, to, seenIds))
}

const assignedFire = (
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  t: WorkTask,
  projectTitle: string,
) =>
  fire(s, c, actor, {
    spaceId: projectOf(s, t.projectId)!.spaceId,
    rule: 'task-assigned',
    key: `task-assigned|${t.id}|${t.assigneeId}`,
    text: `Notified a teammate about “${t.title}”`,
    to: [t.assigneeId!],
    title: 'A task was assigned to you',
    body: `“${t.title}” in ${projectTitle}${t.dueDate ? `, due ${t.dueDate}` : ''}.`,
    href: `/workspace/projects/${t.projectId}?tab=tasks`,
  })

export interface NewTask {
  projectId: string
  title: string
  description?: string
  assigneeId?: string
  status?: TaskStatus
  priority?: WorkTask['priority']
  estimateMin?: number
  dueDate?: DateOnly
  dependsOn?: string[]
  pageId?: string
  opId?: string
}

const checkAssignee = (s: WorkspaceStore, spaceId: string, assigneeId?: string) =>
  !assigneeId || roleOf(s, spaceId, assigneeId) !== null
    ? null
    : 'That person is not in this space, so the task cannot be assigned to them.'

export function createTask(s: WorkspaceStore, c: Ctx, actor: string, i: NewTask): Out<WorkTask> {
  const prior = seen(s, i.opId)
  if (prior) {
    const found = taskOf(s, prior.ref)
    if (found) return ok(s, found)
  }
  const project = projectOf(s, i.projectId)
  if (!project) return fail('That project no longer exists.')
  if (!can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Commenters and viewers cannot add tasks.')
  const bad = checkAssignee(s, project.spaceId, i.assigneeId)
  if (bad) return fail(bad)
  for (const d of i.dependsOn ?? [])
    if (taskOf(s, d)?.projectId !== i.projectId)
      return fail('A task can only depend on a task in the same project.')
  const t: WorkTask = {
    id: c.newId('tsk'),
    projectId: i.projectId,
    title: i.title.trim().slice(0, 120),
    ...(i.description?.trim() ? { description: i.description.trim().slice(0, 1000) } : {}),
    ...(i.assigneeId ? { assigneeId: i.assigneeId } : {}),
    status: i.status ?? 'backlog',
    priority: i.priority ?? 'normal',
    ...(i.estimateMin ? { estimateMin: i.estimateMin } : {}),
    ...(i.dueDate ? { dueDate: i.dueDate } : {}),
    dependsOn: i.dependsOn ?? [],
    ...(i.pageId ? { pageId: i.pageId } : {}),
    createdBy: actor,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    revision: 1,
    dataMode: project.dataMode,
  }
  const parsed = taskSchema.safeParse(t)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'That task is not valid.')
  const fired = t.assigneeId ? assignedFire(s, c, actor, t, project.title) : NOTHING
  return ok(
    {
      ...s,
      tasks: [...s.tasks, t],
      ops: remember(s, i.opId, t.id),
      activity: log(
        s,
        c,
        actor,
        project.spaceId,
        t.id,
        'task',
        t.assigneeId ? `Added “${t.title}” and assigned it` : `Added the task “${t.title}”`,
        `/workspace/projects/${project.id}`,
      ),
      automationLog: addLog(s, fired),
    },
    t,
    fired.notices,
  )
}

export interface TaskPatch {
  title?: string
  description?: string
  assigneeId?: string | null
  priority?: WorkTask['priority']
  estimateMin?: number | null
  dueDate?: DateOnly | null
  dependsOn?: string[]
  blockedReason?: string | null
  pageId?: string | null
}

export function updateTask(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  taskId: string,
  patch: TaskPatch,
  expectedRevision?: number,
): Out<WorkTask> {
  const t = taskOf(s, taskId)
  const project = t && projectOf(s, t.projectId)
  if (!t || !project) return fail('That task no longer exists.')
  if (!can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Commenters and viewers cannot change tasks.')
  if (expectedRevision !== undefined && t.revision !== expectedRevision)
    return fail(
      'Somebody changed this task while you were editing it. Reopen it to see their change.',
    )
  if (t.status === 'canceled') return fail('A canceled task is closed. Add a new task instead.')
  if (patch.assigneeId) {
    const bad = checkAssignee(s, project.spaceId, patch.assigneeId)
    if (bad) return fail(bad)
  }
  if (patch.dependsOn) {
    for (const d of patch.dependsOn) {
      if (d === taskId) return fail('A task cannot depend on itself.')
      if (taskOf(s, d)?.projectId !== t.projectId)
        return fail('A task can only depend on a task in the same project.')
      if (reaches(s, d, taskId))
        return fail('That would make a loop: the other task already waits on this one.')
    }
  }
  const next: WorkTask = { ...t }
  if (patch.title !== undefined) next.title = patch.title.trim().slice(0, 120)
  if (patch.description !== undefined)
    next.description = patch.description.trim().slice(0, 1000) || undefined
  if (patch.assigneeId !== undefined) next.assigneeId = patch.assigneeId ?? undefined
  if (patch.priority) next.priority = patch.priority
  if (patch.estimateMin !== undefined) next.estimateMin = patch.estimateMin ?? undefined
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate ?? undefined
  if (patch.dependsOn) next.dependsOn = patch.dependsOn
  if (patch.blockedReason !== undefined)
    next.blockedReason = patch.blockedReason?.trim().slice(0, 200) || undefined
  if (patch.pageId !== undefined) next.pageId = patch.pageId ?? undefined
  const parsed = taskSchema.safeParse(next)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'That task is not valid.')
  next.revision = t.revision + 1
  next.updatedAt = c.nowIso
  const assigned = patch.assigneeId && patch.assigneeId !== t.assigneeId
  const fired = assigned ? assignedFire(s, c, actor, next, project.title) : NOTHING
  const dateMoved = patch.dueDate !== undefined && patch.dueDate !== t.dueDate
  return ok(
    {
      ...s,
      tasks: s.tasks.map((x) => (x.id === taskId ? next : x)),
      activity:
        assigned || dateMoved
          ? log(
              s,
              c,
              actor,
              project.spaceId,
              taskId,
              'task',
              assigned ? `Assigned “${next.title}”` : `Changed the due date of “${next.title}”`,
              `/workspace/projects/${project.id}`,
            )
          : s.activity,
      automationLog: addLog(s, fired),
    },
    next,
    fired.notices,
  )
}

const FLOW: TaskStatus[] = ['backlog', 'ready', 'inProgress', 'inReview', 'done']

export function moveTask(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  taskId: string,
  status: TaskStatus,
): Out<WorkTask> {
  const t = taskOf(s, taskId)
  const project = t && projectOf(s, t.projectId)
  if (!t || !project) return fail('That task no longer exists.')
  const role = roleOf(s, project.spaceId, actor)
  if (!can(role, 'edit'))
    return fail('Commenters and viewers can suggest changes but not move tasks.')
  if (t.status === status) return ok(s, t)
  if (t.status === 'canceled') return fail('A canceled task is closed.')
  if (status === 'done') {
    const open = openPrerequisites(s, t)
    if (open.length)
      return fail(
        `Finish ${open.map((o) => `“${o.title}”`).join(', ')} first, then this can be marked Done.`,
      )
  }
  if (!FLOW.includes(status) && status !== 'canceled') return fail('That is not a task status.')
  const next: WorkTask = {
    ...t,
    status,
    revision: t.revision + 1,
    updatedAt: c.nowIso,
    ...(status === 'done' ? { completedAt: c.nowIso } : { completedAt: undefined }),
  }
  return ok(
    {
      ...s,
      tasks: s.tasks.map((x) => (x.id === taskId ? next : x)),
      activity: log(
        s,
        c,
        actor,
        project.spaceId,
        taskId,
        'task',
        status === 'done'
          ? `Completed “${t.title}”`
          : `Moved “${t.title}” to ${status === 'canceled' ? 'Canceled' : status === 'inProgress' ? 'In progress' : status === 'inReview' ? 'In review' : status[0]!.toUpperCase() + status.slice(1)}`,
        `/workspace/projects/${project.id}`,
      ),
    },
    next,
  )
}

/** A checklist block becomes a team task; the block keeps the task's ID and the task keeps the page. */
export function blockToWorkTask(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  blockId: string,
  i: { projectId: string; assigneeId?: string; dueDate?: DateOnly; opId?: string },
): Out<WorkTask> {
  const page = pageOf(s, pageId)
  const block = page?.blocks.find((b) => b.id === blockId)
  if (!page || !block || !canEditPage(s, page, actor))
    return fail('That checklist item is not available.')
  if (block.workTaskId && taskOf(s, block.workTaskId)) return ok(s, taskOf(s, block.workTaskId)!)
  if (!block.text.trim()) return fail('Write the action first, then turn it into a task.')
  const made = createTask(s, c, actor, {
    projectId: i.projectId,
    title: block.text.replace(/\[\[[^\]]*\]\]/g, '').trim() || block.text,
    ...(i.assigneeId ? { assigneeId: i.assigneeId } : {}),
    ...(i.dueDate ? { dueDate: i.dueDate } : {}),
    pageId,
    status: block.checked ? 'done' : 'ready',
    ...(i.opId ? { opId: i.opId } : {}),
  })
  if (!made.ok) return made
  const saved = savePage(made.store, c, actor, pageId, page.revision, {
    blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, workTaskId: made.value.id } : b)),
  })
  return saved.ok ? ok(saved.store, made.value) : saved
}

/** Record that a checklist block is now a CampusOS task (created through the task repository). */
export function linkBlockToTask(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  blockId: string,
  taskId: string,
): Out<Page> {
  const page = pageOf(s, pageId)
  if (!page) return fail('That page is not available.')
  return savePage(s, c, actor, pageId, page.revision, {
    blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, taskId } : b)),
  })
}

/* ---------- meetings ---------- */

export interface NewMeeting {
  projectId: string
  title: string
  date: DateOnly
  start: LocalTime
  end: LocalTime
  attendees: { userId: string; required: boolean }[]
  roomLabel?: string
  /** Set when a real campus room is held through Classrooms. */
  roomId?: string
  /** Set when the meeting also exists in the main Calendar's meeting engine. */
  calendarMeetingId?: string
  pollId?: string
  agenda?: string
  opId: string
}

const overlaps = (
  a: { start: LocalTime; end: LocalTime },
  b: { start: LocalTime; end: LocalTime },
) => timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)

export function scheduleMeeting(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: NewMeeting,
): Out<WsMeeting> {
  const prior = seen(s, i.opId)
  if (prior) {
    const found = s.meetings.find((m) => m.id === prior.ref)
    if (found) return ok(s, found)
  }
  const project = projectOf(s, i.projectId)
  if (!project) return fail('That project no longer exists.')
  if (!can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can schedule a meeting.')
  if (timeToMinutes(i.end) <= timeToMinutes(i.start))
    return fail('The meeting must end after it starts.')
  const confirmed = s.meetings.filter((m) => m.status === 'confirmed' && m.date === i.date)
  if (i.roomLabel && confirmed.some((m) => m.roomLabel === i.roomLabel && overlaps(m, i)))
    return fail(
      `${i.roomLabel} is already held for another meeting then. Pick another time or room.`,
    )
  const everyone = [
    { userId: actor, required: true },
    ...i.attendees.filter((a) => a.userId !== actor),
  ]
  for (const a of everyone) {
    if (roleOf(s, project.spaceId, a.userId) === null)
      return fail('Everyone invited must be in the space.')
    if (
      a.required &&
      confirmed.some(
        (m) => overlaps(m, i) && m.attendees.some((x) => x.userId === a.userId && x.rsvp !== 'NO'),
      )
    )
      return fail('A required person already has a team meeting at that time.')
  }
  const m: WsMeeting = {
    id: c.newId('mtg'),
    projectId: i.projectId,
    title: i.title.trim().slice(0, 120) || 'Team meeting',
    date: i.date,
    start: i.start,
    end: i.end,
    attendees: everyone.map((a) => ({ ...a, rsvp: a.userId === actor ? 'YES' : 'INVITED' })),
    ...(i.roomLabel ? { roomLabel: i.roomLabel } : {}),
    ...(i.roomId ? { roomId: i.roomId } : {}),
    ...(i.calendarMeetingId ? { calendarMeetingId: i.calendarMeetingId } : {}),
    ...(i.pollId ? { pollId: i.pollId } : {}),
    status: 'confirmed',
    organizerId: actor,
    createdAt: c.nowIso,
    revision: 1,
    dataMode: project.dataMode,
  }
  let store: WorkspaceStore = {
    ...s,
    meetings: [...s.meetings, m],
    ops: remember(s, i.opId, m.id),
    activity: log(
      s,
      c,
      actor,
      project.spaceId,
      m.id,
      'meeting',
      `Scheduled “${m.title}”`,
      `/workspace/projects/${project.id}`,
    ),
  }
  let meeting = m
  let fired = NOTHING
  if (ruleOn(store, project.spaceId, 'meeting-agenda')) {
    const open = s.decisions.filter((d) => d.projectId === i.projectId && !d.outcome)
    const dated = `${m.date} ${m.start}`
    const agenda = createPage(store, c, actor, {
      spaceId: project.spaceId,
      title: `Agenda: ${m.title} (${m.date})`,
      noteType: 'meeting',
      projectId: project.id,
      icon: '🗓️',
      blocks: [
        { id: c.newId('b'), type: 'h2', text: 'Purpose' },
        { id: c.newId('b'), type: 'paragraph', text: i.agenda?.trim() ?? '' },
        { id: c.newId('b'), type: 'h2', text: 'To decide' },
        ...(open.length
          ? open.map((d) => ({ id: c.newId('b'), type: 'bullet' as const, text: d.question }))
          : [{ id: c.newId('b'), type: 'paragraph' as const, text: 'No open decisions.' }]),
        { id: c.newId('b'), type: 'h2', text: 'Actions' },
        { id: c.newId('b'), type: 'todo', text: '' },
      ],
      opId: `agenda:${m.id}`,
    })
    if (agenda.ok) {
      meeting = { ...m, agendaPageId: agenda.value.id }
      store = {
        ...agenda.store,
        meetings: agenda.store.meetings.map((x) => (x.id === m.id ? meeting : x)),
      }
    }
    fired = fire(store, c, actor, {
      spaceId: project.spaceId,
      rule: 'meeting-agenda',
      key: `meeting-agenda|${m.id}`,
      text: `Created an agenda for “${m.title}” and told the invited people (${dated})`,
      to: m.attendees.map((a) => a.userId),
      title: `Meeting: ${m.title}`,
      body: `${m.date}, ${m.start}–${m.end}${m.roomLabel ? ` · ${m.roomLabel}` : ''}. Answer from the project calendar.`,
      href: `/workspace/projects/${project.id}?tab=calendar`,
    })
    store = { ...store, automationLog: addLog(store, fired) }
  }
  return ok(store, meeting, fired.notices)
}

export function respondMeeting(
  s: WorkspaceStore,
  c: Ctx,
  userId: string,
  meetingId: string,
  rsvp: Exclude<WsRsvp, 'INVITED'>,
): Out<WsMeeting> {
  const m = s.meetings.find((x) => x.id === meetingId)
  if (!m || m.status !== 'confirmed') return fail('That meeting is no longer on.')
  if (!m.attendees.some((a) => a.userId === userId))
    return fail('You are not invited to this meeting.')
  const next = {
    ...m,
    attendees: m.attendees.map((a) => (a.userId === userId ? { ...a, rsvp } : a)),
    revision: m.revision + 1,
  }
  void c
  return ok({ ...s, meetings: s.meetings.map((x) => (x.id === meetingId ? next : x)) }, next)
}

export function cancelMeeting(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  meetingId: string,
): Out<WsMeeting> {
  const m = s.meetings.find((x) => x.id === meetingId)
  const project = m && projectOf(s, m.projectId)
  if (!m || !project) return fail('That meeting no longer exists.')
  if (m.organizerId !== actor && !can(roleOf(s, project.spaceId, actor), 'manage'))
    return fail('Only the organiser or an Owner can cancel this meeting.')
  const next = { ...m, status: 'cancelled' as const, revision: m.revision + 1 }
  return ok(
    {
      ...s,
      meetings: s.meetings.map((x) => (x.id === meetingId ? next : x)),
      activity: log(
        s,
        c,
        actor,
        project.spaceId,
        meetingId,
        'meeting',
        `Cancelled “${m.title}”`,
        `/workspace/projects/${project.id}`,
      ),
    },
    next,
  )
}

/* ---------- decisions and evidence ---------- */

export function createDecision(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: {
    projectId: string
    question: string
    options?: string[]
    evidenceIds?: string[]
    revisitWhen?: string
  },
): Out<Decision> {
  const project = projectOf(s, i.projectId)
  if (!project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can open a decision.')
  if (!i.question.trim()) return fail('Write the question being decided.')
  const d: Decision = {
    id: c.newId('dec'),
    projectId: i.projectId,
    question: i.question.trim().slice(0, 120),
    options: (i.options ?? [])
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 8),
    evidenceIds: i.evidenceIds ?? [],
    ...(i.revisitWhen?.trim() ? { revisitWhen: i.revisitWhen.trim() } : {}),
    createdAt: c.nowIso,
    dataMode: project.dataMode,
  }
  return ok({ ...s, decisions: [...s.decisions, d] }, d)
}

/** A decision is final only when somebody names the outcome. A comment or poll never does that for them. */
export function finalizeDecision(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  decisionId: string,
  i: { outcome: string; rationale?: string },
): Out<Decision> {
  const d = s.decisions.find((x) => x.id === decisionId)
  const project = d && projectOf(s, d.projectId)
  if (!d || !project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can finalize a decision.')
  if (!i.outcome.trim()) return fail('State what was decided.')
  const next: Decision = {
    ...d,
    outcome: i.outcome.trim().slice(0, 400),
    ...(i.rationale?.trim() ? { rationale: i.rationale.trim().slice(0, 800) } : {}),
    decidedBy: actor,
    decidedOn: istDate(c.nowIso),
  }
  let store: WorkspaceStore = {
    ...s,
    decisions: s.decisions.map((x) => (x.id === decisionId ? next : x)),
    activity: log(
      s,
      c,
      actor,
      project.spaceId,
      decisionId,
      'decision',
      `Decided: ${d.question}`,
      `/workspace/projects/${project.id}`,
    ),
  }
  if (ruleOn(store, project.spaceId, 'decision-log')) {
    const entry = `${next.decidedOn}: ${d.question} → ${next.outcome}`
    const logPage = store.pages.find(
      (p) => p.projectId === project.id && p.title === 'Decision log' && !p.trashedAt,
    )
    const written = logPage
      ? savePage(store, c, actor, logPage.id, logPage.revision, {
          blocks: [
            ...logPage.blocks.filter((b) => b.text.trim()),
            { id: c.newId('b'), type: 'bullet', text: entry },
          ],
        })
      : createPage(store, c, actor, {
          spaceId: project.spaceId,
          title: 'Decision log',
          projectId: project.id,
          icon: '⚖️',
          noteType: 'decision',
          blocks: [{ id: c.newId('b'), type: 'bullet', text: entry }],
          opId: `declog:${project.id}`,
        })
    if (written.ok) {
      const f = fire(written.store, c, actor, {
        spaceId: project.spaceId,
        rule: 'decision-log',
        key: `decision-log|${decisionId}`,
        text: `Added “${d.question}” to the Decision log`,
        to: [],
        title: '',
        body: '',
        href: '',
      })
      store = { ...written.store, automationLog: addLog(written.store, f) }
    }
  }
  return ok(store, next)
}

export function reopenDecision(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  decisionId: string,
): Out<Decision> {
  const d = s.decisions.find((x) => x.id === decisionId)
  const project = d && projectOf(s, d.projectId)
  if (!d || !project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can reopen a decision.')
  const { outcome: _o, decidedBy: _b, decidedOn: _d, ...rest } = d
  void [_o, _b, _d]
  void c
  return ok({ ...s, decisions: s.decisions.map((x) => (x.id === decisionId ? rest : x)) }, rest)
}

export interface SourceInput {
  projectId: string
  claim: string
  source?: string
  method?: string
  observedOn?: DateOnly
  finding?: string
  limitations?: string
  pageId?: string
}

export function createSource(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: SourceInput,
): Out<EvidenceSource> {
  const project = projectOf(s, i.projectId)
  if (!project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can add evidence.')
  if (!i.claim.trim()) return fail('Write the claim this row supports.')
  const row: EvidenceSource = {
    id: c.newId('src'),
    projectId: i.projectId,
    claim: i.claim.trim().slice(0, 120),
    source: (i.source ?? '').trim().slice(0, 200),
    ...(i.method?.trim() ? { method: i.method.trim().slice(0, 200) } : {}),
    ...(i.observedOn ? { observedOn: i.observedOn } : {}),
    ...(i.finding?.trim() ? { finding: i.finding.trim().slice(0, 600) } : {}),
    ...(i.limitations?.trim() ? { limitations: i.limitations.trim().slice(0, 400) } : {}),
    ...(i.pageId ? { pageId: i.pageId } : {}),
    createdBy: actor,
    createdAt: c.nowIso,
    dataMode: project.dataMode,
  }
  return ok({ ...s, sources: [...s.sources, row] }, row)
}

export function updateSource(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  sourceId: string,
  patch: Partial<Omit<SourceInput, 'projectId'>>,
): Out<EvidenceSource> {
  const row = s.sources.find((x) => x.id === sourceId)
  const project = row && projectOf(s, row.projectId)
  if (!row || !project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can edit evidence.')
  if (patch.claim !== undefined && !patch.claim.trim()) return fail('The claim cannot be empty.')
  const next: EvidenceSource = { ...row }
  for (const k of ['claim', 'source', 'method', 'finding', 'limitations'] as const) {
    const v = patch[k]
    if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v.trim() || undefined
  }
  if (patch.observedOn !== undefined) next.observedOn = patch.observedOn
  if (patch.pageId !== undefined) next.pageId = patch.pageId
  return ok({ ...s, sources: s.sources.map((x) => (x.id === sourceId ? next : x)) }, next)
}

export function deleteSource(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  sourceId: string,
): Out<void> {
  const row = s.sources.find((x) => x.id === sourceId)
  const project = row && projectOf(s, row.projectId)
  if (!row || !project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can remove evidence.')
  return ok(
    {
      ...s,
      sources: s.sources.filter((x) => x !== row),
      decisions: s.decisions.map((d) => ({
        ...d,
        evidenceIds: d.evidenceIds.filter((e) => e !== sourceId),
      })),
    },
    undefined,
  )
}

/* ---------- comments and review ---------- */

export function addComment(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  body: string,
  anchor?: { blockId: string },
  parentId?: string,
  mentions: string[] = [],
): Out<Comment> {
  const page = pageOf(s, pageId)
  if (!page || !canReadPage(s, page, actor)) return fail('That page is not available to you.')
  if (!can(roleOf(s, page.spaceId, actor), 'comment'))
    return fail('Viewers can read but not comment.')
  if (!body.trim()) return fail('Write a comment first.')
  if (parentId && !s.comments.some((x) => x.id === parentId && x.pageId === pageId))
    return fail('That thread no longer exists.')
  const block = anchor ? page.blocks.find((b) => b.id === anchor.blockId) : undefined
  if (anchor && !block) return fail('That block no longer exists.')
  const parent = parentId ? s.comments.find((x) => x.id === parentId) : undefined
  // A mention never grants access (spec §8.2): only people who can already open the page may be mentioned.
  const who = [...new Set(mentions)].filter((m) => m !== actor)
  if (who.some((m) => !canReadPage(s, page, m)))
    return fail(
      'Someone you mentioned cannot open this page. Share it with them first; a mention does not give access.',
    )
  const cm: Comment = {
    id: c.newId('cmt'),
    pageId,
    ...(parent
      ? parent.blockId
        ? { blockId: parent.blockId, quote: parent.quote }
        : {}
      : block
        ? { blockId: block.id, quote: block.text.slice(0, 160) }
        : {}),
    ...(parentId ? { parentId } : {}),
    authorId: actor,
    body: body.trim().slice(0, 1000),
    ...(who.length ? { mentions: who } : {}),
    createdAt: c.nowIso,
    dataMode: modeOf(s, page.spaceId),
  }
  return ok(
    {
      ...s,
      comments: [...s.comments, cm],
      activity:
        page.audience === 'space'
          ? log(
              s,
              c,
              actor,
              page.spaceId,
              cm.id,
              'comment',
              parentId
                ? `Replied on “${page.title || 'Untitled'}”`
                : `Commented on “${page.title || 'Untitled'}”`,
              `/workspace/pages/${pageId}`,
            )
          : s.activity,
    },
    cm,
    direct(
      s,
      actor,
      `mention|${cm.id}`,
      who,
      'You were mentioned',
      `On “${page.title || 'Untitled'}”: ${cm.body.slice(0, 90)}`,
      `/workspace/pages/${pageId}`,
    ),
  )
}

export function setCommentResolved(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  commentId: string,
  resolved: boolean,
): Out<Comment> {
  const cm = s.comments.find((x) => x.id === commentId && !x.parentId)
  const page = cm && pageOf(s, cm.pageId)
  if (
    !cm ||
    !page ||
    !canReadPage(s, page, actor) ||
    !can(roleOf(s, page.spaceId, actor), 'comment')
  )
    return fail('You cannot change that thread.')
  const { resolvedAt: _r, ...rest } = cm
  void _r
  const next: Comment = resolved ? { ...rest, resolvedAt: c.nowIso } : rest
  return ok({ ...s, comments: s.comments.map((x) => (x.id === commentId ? next : x)) }, next)
}

export function deleteComment(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  commentId: string,
): Out<void> {
  const cm = s.comments.find((x) => x.id === commentId)
  if (!cm) return fail('That comment is already gone.')
  if (cm.authorId !== actor) return fail('You can delete only your own comments.')
  return ok(
    { ...s, comments: s.comments.filter((x) => x.id !== commentId && x.parentId !== commentId) },
    undefined,
  )
}

export function requestReview(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  pageId: string,
  reviewerIds: string[],
  dueDate?: DateOnly,
): Out<Review[]> {
  const page = pageOf(s, pageId)
  if (!page || !canEditPage(s, page, actor))
    return fail('Only editors and owners can request a review.')
  if (page.audience !== 'space')
    return fail('Share the page with the space before asking others to review it.')
  const people = [...new Set(reviewerIds)].filter((r) => r !== actor)
  if (!people.length) return fail('Choose at least one reviewer other than yourself.')
  for (const r of people)
    if (!can(roleOf(s, page.spaceId, r), 'comment'))
      return fail('Reviewers must be able to comment on this page.')
  const open = s.reviews.filter(
    (r) => r.pageId === pageId && r.revision === page.revision && r.state === 'requested',
  )
  const fresh = people.filter((p) => !open.some((o) => o.reviewerId === p))
  if (!fresh.length) return fail('Those reviewers have already been asked about this version.')
  const made: Review[] = fresh.map((reviewerId) => ({
    id: c.newId('rvw'),
    pageId,
    revision: page.revision,
    requestedBy: actor,
    reviewerId,
    requestedAt: c.nowIso,
    ...(dueDate ? { dueDate } : {}),
    state: 'requested',
  }))
  const lifecycle = setLifecycle(
    { ...s, reviews: [...s.reviews, ...made] },
    c,
    actor,
    pageId,
    'inReview',
  )
  return lifecycle.ok
    ? ok(
        lifecycle.store,
        made,
        direct(
          s,
          actor,
          `review|${pageId}|${page.revision}`,
          fresh,
          'A review was requested',
          `Please review “${page.title || 'Untitled'}”${dueDate ? ` by ${dueDate}` : ''}.`,
          `/workspace/pages/${pageId}`,
        ),
      )
    : lifecycle
}

export function submitReview(
  s: WorkspaceStore,
  c: Ctx,
  userId: string,
  reviewId: string,
  outcome: 'reviewed' | 'changesRequested',
  note?: string,
): Out<Review> {
  const r = s.reviews.find((x) => x.id === reviewId)
  const page = r && pageOf(s, r.pageId)
  if (!r || !page) return fail('That review request no longer exists.')
  if (r.reviewerId !== userId) return fail('Only the person asked can answer this review.')
  if (r.state !== 'requested') return fail('This review has already been answered.')
  const next: Review = {
    ...r,
    state: outcome,
    decidedAt: c.nowIso,
    ...(note?.trim() ? { note: note.trim().slice(0, 400) } : {}),
  }
  return ok(
    {
      ...s,
      reviews: s.reviews.map((x) => (x.id === reviewId ? next : x)),
      activity: log(
        s,
        c,
        userId,
        page.spaceId,
        reviewId,
        'review',
        outcome === 'reviewed'
          ? `Reviewed “${page.title || 'Untitled'}”`
          : `Asked for changes to “${page.title || 'Untitled'}”`,
        `/workspace/pages/${page.id}`,
      ),
    },
    next,
  )
}

/* ---------- quick capture ---------- */

export function addCapture(s: WorkspaceStore, c: Ctx, owner: string, text: string): Out<Capture> {
  if (!text.trim()) return fail('Type something to capture.')
  const cap: Capture = {
    id: c.newId('cap'),
    ownerId: owner,
    text: text.trim().slice(0, 1000),
    createdAt: c.nowIso,
  }
  return ok({ ...s, captures: [cap, ...s.captures] }, cap)
}

export function deleteCapture(s: WorkspaceStore, _c: Ctx, owner: string, id: string): Out<void> {
  const cap = s.captures.find((x) => x.id === id && x.ownerId === owner)
  if (!cap) return fail('That capture is already gone.')
  return ok({ ...s, captures: s.captures.filter((x) => x !== cap) }, undefined)
}

/** Filing a capture makes it a page in a space the owner can write to, then removes it from the inbox. */
export function fileCapture(
  s: WorkspaceStore,
  c: Ctx,
  owner: string,
  id: string,
  spaceId: string,
): Out<Page> {
  const cap = s.captures.find((x) => x.id === id && x.ownerId === owner)
  if (!cap) return fail('That capture is already filed.')
  const first = cap.text.split('\n')[0]!.slice(0, 60)
  const made = createPage(s, c, owner, {
    spaceId,
    title: first,
    blocks: [{ id: c.newId('b'), type: 'paragraph', text: cap.text }],
    audience: 'private',
    opId: `file-${id}`,
  })
  if (!made.ok) return made
  return ok({ ...made.store, captures: made.store.captures.filter((x) => x.id !== id) }, made.value)
}

/* ---------- demo space ---------- */

export function setViewAs(s: WorkspaceStore, id: string | null): Out<void> {
  if (id !== null && !s.people.some((p) => p.id === id)) return fail('That member does not exist.')
  if ((s.viewAs ?? null) === id) return ok(s, undefined)
  const { viewAs: _old, ...rest } = s
  void _old
  return ok(id ? { ...rest, viewAs: id } : rest, undefined)
}

export function removeDemo(s: WorkspaceStore): Out<void> {
  const demoPeople = new Set(s.people.map((p) => p.id))
  const spaces = new Set(s.spaces.filter((x) => x.dataMode === 'demoSeed').map((x) => x.id))
  const projects = new Set(s.projects.filter((x) => spaces.has(x.spaceId)).map((x) => x.id))
  const pages = new Set(s.pages.filter((x) => spaces.has(x.spaceId)).map((x) => x.id))
  const keepPage = (id: string) => !pages.has(id)
  const { viewAs: _v, ...kept } = s
  void _v
  return ok(
    {
      ...kept,
      seedVersion: 'off',
      people: [],
      captures: s.captures.filter((x) => !demoPeople.has(x.ownerId)),
      spaces: s.spaces.filter((x) => !spaces.has(x.id)),
      members: s.members.filter((x) => !spaces.has(x.spaceId)),
      pages: s.pages.filter((x) => !pages.has(x.id)),
      revisions: s.revisions.filter((x) => keepPage(x.pageId)),
      projects: s.projects.filter((x) => !projects.has(x.id)),
      tasks: s.tasks.filter((x) => !projects.has(x.projectId)),
      meetings: s.meetings.filter((x) => !projects.has(x.projectId)),
      decisions: s.decisions.filter((x) => !projects.has(x.projectId)),
      sources: s.sources.filter((x) => !projects.has(x.projectId)),
      comments: s.comments.filter((x) => keepPage(x.pageId)),
      reviews: s.reviews.filter((x) => keepPage(x.pageId)),
      activity: s.activity.filter((x) => !spaces.has(x.spaceId)),
    },
    undefined,
  )
}
