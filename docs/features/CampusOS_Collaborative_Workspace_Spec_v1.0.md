# CampusOS Collaborative Workspace — Master Product and Implementation Specification

**Version:** 1.0 · **Prepared:** 3 November 2026 · **Timezone:** Asia/Kolkata  
**Scope:** Product ideation, interaction specification, data requirements, demonstration fixtures and implementation handoff.  
**Product direction:** Notion-inspired collaborative work management + Obsidian-inspired connected knowledge, integrated throughout CampusOS.  
**Status:** Proposed expansion. This document does not establish that any feature has been implemented, connected or tested.

---

## 1. Product decision and intent

Build **Workspace** as a first-class CampusOS destination. It must support teams creating and coordinating work together, alongside personal knowledge and notes. The defining experience is: **capture an idea → develop it with others → assign the work → find a meeting time → reserve a resource → record decisions → retrieve the knowledge later**.

This expands the earlier notes proposal substantially. A useful editor alone does not satisfy this specification. Shared spaces, structured project records, multiple views, calendar coordination, discussion, ownership and connected knowledge are core capabilities.

Use a dedicated Workspace tab and contextual access throughout the OS. A project page, task, note or meeting has one canonical identity wherever it appears. Filtered views and embedded previews reference those records; they do not create independently editable copies.

### 1.1 Product principles

1. Make useful work possible before asking users to customize a system.
2. Team coordination and personal thinking should connect while retaining clear audience boundaries.
3. Every visible control must perform a defined action or explain its unavailable state.
4. Prefer connected campus workflows over reproducing every setting in a general productivity product.
5. Use recorded, permission-appropriate data for progress, activity and suggestions.
6. Save reliably, expose failures and recover drafts before adding decorative complexity.
7. Keep official records distinct from student planning, estimates and personal completion.
8. Support the existing CampusOS app and deployment; do not build a second product.

### 1.2 Relationship to the inspected website

The live site at https://campusos-one-mu.vercel.app/ was inspected on 3 November 2026, specifically Home, Academics and My courses. Navigation exposed Home, Calendar, Campus Services, Bookings, Academics, Administration, Community and Time Tax. Home already exposed schedule, deadline, task, activity and quick-action surfaces. Academics exposed course, exam, grade, attendance, faculty and mentorship destinations. These are integration opportunities, not evidence that every deeper workflow was verified.

The inspected Academics interface stated that requests/status changes were saved on the device. Do not infer shared persistence from the public deployment. Reinspect relevant code and actual connection state before implementation. The established cream surfaces, teal accents and spacious cards provide the visual baseline.

### 1.3 Inspiration boundaries

Borrow connected projects/documents, structured records and views, subitems and dependency concepts from Notion; borrow internal links, backlinks, note properties, daily notes and visual knowledge navigation from Obsidian. This is an original campus product, not a claim of feature parity or interoperability. Official reference links appear in §22.

---

## 2. Users, spaces and ownership

| User situation | Primary need | Default experience |
|---|---|---|
| Student attending classes | Capture, organize and revise learning | Personal course notes and daily capture |
| Assignment team | Coordinate deliverables and responsibilities | Team project, task board, meetings and decisions |
| Club or committee | Plan events and retain handover knowledge | Shared event workspace and reusable checklist |
| Project coordinator | See blockers and upcoming milestones | Team overview, workload and review queue |
| Class representative | Share relevant planning information | Section space with controlled publishing |
| Invited mentor | Review selected work and comment | Explicitly invited project/page access |
| Returning member | Understand decisions and unfinished work | Decision log, history and linked evidence |

### 2.1 Space types

- **Personal:** private capture, notes, plans and learning records.
- **Course:** personal notes associated with an existing course; optional separate shared study space with explicit membership.
- **Project/team:** shared work with members, roles, tasks, pages and calendar views.
- **Club/committee:** planning, recurring activities, documentation and handover.
- **Section:** explicitly scoped announcements, shared resources and optional study coordination.

Course enrollment does not automatically grant access to every student's course notes. A private note remains private until its owner explicitly shares an allowed copy or changes its audience.

### 2.2 Roles

| Role | Content | Tasks and meetings | Membership/settings |
|---|---|---|---|
| Owner | Full edit, recovery and export | Manage project work | Manage roles; transfer ownership |
| Editor | Create/edit accessible content | Create/update within scope | No access expansion by default |
| Commenter | Read and comment | Suggest changes; RSVP for self | None |
| Viewer | Read accessible records | View permitted status | None |

A personal task assigned to somebody else does not become visible to them unless assignment is allowed in a shared scope. A mention does not grant access. The final owner cannot leave without transferring ownership or archiving the space through an explicit flow.

---

## 3. Information architecture and screen contract

### 3.1 Primary navigation

Add **Workspace** near Academics in desktop navigation. On mobile, expose it through the existing primary/More navigation pattern without creating a long row of small icons. Preserve existing destinations and routes.

Suggested routes are proposals; adapt them to existing routing conventions:

| Screen | Proposed route | Main purpose |
|---|---|---|
| Workspace home | `/workspace` | Continue work, capture, assignments and spaces |
| Space | `/workspace/spaces/:id` | Team or personal overview |
| Page | `/workspace/pages/:id` | Editor, comments, links and history |
| Project | `/workspace/projects/:id` | Project overview and related views |
| Collection | `/workspace/collections/:id` | Structured records and saved views |
| Knowledge | `/workspace/knowledge` | Search, backlinks and graph |
| Capture | `/workspace/capture` | Unfiled ideas and quick notes |

### 3.2 Workspace home

Show a prominent Create action, search, space switcher and connectivity/save indicator. Content order:

1. **Continue working:** last opened/edited accessible pages, with meaningful titles.
2. **Assigned to me:** current actionable tasks from canonical task records.
3. **My teams:** real memberships, project status and upcoming milestone.
4. **Coming up:** shared meetings and due items, clearly distinguished.
5. **Recent activity:** actual edits, decisions, comments and state changes.
6. **Quick capture:** unfiled items awaiting organization.

Empty state: “Start with a project, course notebook or quick note.” Offer templates and one blank option. Do not seed a private account with fictional collaborators without a clearly selected demonstration mode.

### 3.3 Space layout

Desktop: optional left page tree, central working area and collapsible right context panel. Space overview includes purpose, owners, members, pinned pages, work in progress, upcoming meetings and open decisions. A page tree supports search, reorder, nesting, rename, archive and restore.

Mobile: one content pane, breadcrumb/back navigation, tree in a drawer, context in a sheet. Preserve draft text when navigating. The editor's focus mode hides unrelated campus status strips and collapses surrounding navigation.

### 3.4 Project tabs

**Overview · Tasks · Calendar · Docs & Notes · Decisions · Files · Activity**. These are views over related records. Small projects can hide unused tabs; users should not have to configure them to begin.

---

## 4. Page editor and content interactions

### 4.1 Core blocks

Support paragraph, headings 1–3, bullets, numbered list, checklist, quote, callout, divider, code, equation, simple table, image, attachment, internal link, child page and embedded collection view. Add collapsible sections and a generated outline. Use the repository's suitable editor library rather than manually rebuilding selection and undo behavior.

A slash menu supports keyboard search and insertion. It must close without losing the caret. A block action menu exposes move, duplicate, copy link and delete. Drag handles supplement keyboard move controls. Multi-block selection, paste and undo must remain predictable.

### 4.2 Page metadata

Title, icon, optional cover, space, author, created/updated timestamps, audience, tags, course/project relations and lifecycle state. State examples: Draft, In review, Approved by team, Archived. “Approved by team” is a project workflow label, not institutional approval.

Use optional covers sparingly; useful content must appear without excessive scrolling. Display metadata compactly and allow the details panel to expand it.

### 4.3 Saving and recovery

Display Saving, Saved, Offline draft, Sync pending and Save failed according to actual state. Never show Saved before persistence succeeds. Preserve drafts on refresh where supported. Provide retry, last successful save time and a recoverable local draft when remote saving fails. Do not silently overwrite a newer revision.

A linked page continues resolving after rename because links reference IDs. An archived page shows its state. A deleted page has a recoverable tombstone; a permanently removed target shows a broken-link explanation without leaking inaccessible titles.

### 4.4 Attachments

Accept configured file types and limits with clear validation. Show upload progress, retry and removable pending attachments. Persist filename, MIME type, size, storage reference, author and audience. A local preview is not a successful shared upload. Do not accept arbitrary executable content for inline execution. Sanitize pasted/imported HTML and render embeds through an allowlist.

---

## 5. Structured collections: interactive shared information

Provide campus-oriented collections with extensible properties. Start with Tasks, Projects, Research Sources, Decisions and Event Plans. Each record opens as a page with structured properties above its content.

### 5.1 Property types

Title, text, number, status, single/multiple select, person, date/date range, checkbox, URL, attachment, relation, created/updated metadata and a bounded set of computed fields. Support configured required fields, sensible defaults and clear invalid values. Reserve unrestricted formula languages for later.

### 5.2 Views

| View | Interaction | Campus example |
|---|---|---|
| Table | Inline edit, sort, filter, column visibility | Research evidence register |
| Board | Move record between status groups | Assignment tasks |
| Calendar | Place dated records; open/edit date | Deliverable deadlines |
| Timeline | Inspect date ranges and dependencies | Event preparation schedule |
| List | Compact scan, keyboard navigation | Meeting actions |
| Gallery | Card preview with selected properties | Club event plans |

Moving a card changes its canonical status. Moving a calendar item changes its date only when the user has authority and confirms material scheduling consequences. Saved view settings affect presentation, not the underlying record's permissions. Personal views and team-default views have separate ownership.

### 5.3 Filters and relations

Support AND/OR filters with a readable summary, sorting and grouping. Useful defaults: Mine, Due this week, Blocked, Unassigned, Needs review and Completed. Empty filtered results offer Clear filters; they must not look like missing data.

Relations connect projects, tasks, notes, meetings and sources. Rollups include completed/total tasks and unresolved decisions. Show the denominator and exclusion rules. Do not interpret number of edits or word count as meaningful project completion.

### 5.4 Bounded automations

Start with transparent rules: task assignment creates an in-app notification; a finalized meeting can create an agenda; approaching due dates can generate configured reminders; resolving a decision updates its log. Show triggers, actions and recent results. Prevent recursive rules and duplicate notifications. External delivery requires actual configured delivery channels.

---

## 6. Project and task management

### 6.1 Project record

Title, purpose, course/club, owner, members, start/target dates, actual deadline if supplied, status, milestone relations, task relations, project home page and risk/decision links. Distinguish an internal target from a professor's deadline.

### 6.2 Task record

Reuse the existing CampusOS task owner/store. Extend it with project, assignee, watchers, status, priority, estimated effort, start/due date, dependencies, parent task, related page, evidence and completion history.

Suggested lifecycle: **Backlog → Ready → In progress → In review → Done**, with Blocked as an explicit condition and Canceled as a terminal state. A simple personal checklist does not automatically become a team task. “Convert to task” opens a short form and leaves a linked task block in the note.

### 6.3 Dependencies and workload

Reject self-dependencies and cycles. Completing a prerequisite removes a blocker only when all blocking dependencies are resolved. A dependency must not automatically move a professor-set deadline. Show proposed date changes for human review.

Workload uses assigned open tasks and optional estimated effort. Missing estimates are labeled, not counted as zero effort. It is planning support, not a productivity ranking. Permit multiple contributors but one accountable owner where the workflow needs clarity.

### 6.4 Assignment workflow

Brief → task breakdown → ownership → research → draft → peer review → final preparation → personal submission checklist. Submission tracking may record a student's report or a link to an official system. A completed task does not establish official submission.

---

## 7. Shared calendars and group coordination

The Workspace must surface the **existing CampusOS calendar and scheduling engine** in team context. Do not create a competing calendar system.

### 7.1 Calendar layers

- Personal commitments, visible to their owner.
- Team meetings and project sessions.
- Project milestones and task deadlines.
- Relevant course sessions and exams from their owning source.
- Club/committee events.
- Linked room reservations.

Users can toggle layers, switch Day/Week/Month/Agenda and open event details. Deadlines are not automatically all-day busy blocks. Unknown schedule coverage is not free time.

### 7.2 Scheduling journey

From a project select **Find a team time** → choose participants, duration and date range → compute feasible candidates → show up to three actual suggestions → optionally poll → choose time → find an eligible room → review → confirm/request approval → collect RSVPs.

Keep meeting, poll, RSVP and reservation states separate. Revalidate conflicts before confirmation and after a poll closes. Required participants remain required unless the organizer explicitly changes them. Show only busy/free/unknown for private commitments.

### 7.3 Calendar interactions

Click an empty slot to propose a meeting. Drag to select duration with a keyboard/form alternative. Dragging a confirmed meeting opens a review with attendee conflicts, room implications and affected RSVPs. A failed reschedule retains the old valid booking. Updating a milestone date updates its other views without cloning the event.

A team calendar viewer can inspect public-to-team details, while private appointment titles stay hidden. A participant may share availability without granting access to personal notes or academic records.

### 7.4 Meeting workspace

Each meeting can have an agenda, preparation links, attendees/RSVPs, decisions and action items. After the meeting, offer “Review actions” and “Record decisions.” Do not invent a transcript or mark attendance from an invitation. Recurring meetings support editing one occurrence or a clearly defined series range.

---

## 8. Collaboration, discussion and review

### 8.1 Shared editing

Connected mode supports multiple authorized users editing the same page, preserving both users' changes. Use a proven collaborative editing approach compatible with the chosen editor. Maintain durable document snapshots/updates and a recovery strategy; presence events alone are not saved content.

Presence means a currently connected client with a heartbeat, not a random avatar. Expire stale presence. Show collaborator cursors only with a real session and appropriate access. During disconnection, preserve drafts and make synchronization state visible.

### 8.2 Comments and mentions

Support page comments and anchored comments on blocks/text, replies, edit/delete own comment, resolve/reopen and filters for Open/Resolved/Mine. If referenced text moves or disappears, retain the thread with an “Original selection changed” context instead of attaching it to unrelated text.

Mention suggestions list only eligible people. Before inserting a mention of someone without access, explain that they cannot see the page and offer a separate authorized sharing action. No silent permission changes.

### 8.3 Review and decisions

A request-review action selects reviewers and an optional target date. Review states: Requested, Changes requested, Reviewed. Team approval requires a named actor and timestamp. Preserve the exact revision reviewed so later changes can be identified.

Decision entries contain question, options, rationale, decision, decision maker, date, related evidence and revisit condition. Comments are discussion; decisions are explicit records. Poll results do not silently become formal decisions without the configured finalization step.

### 8.4 Activity and notifications

Record meaningful actions: task assigned, deadline changed, comment added, decision finalized, meeting changed, role changed and document restored. Group repetitive edits. Show who, what, when and a deep link. Support read/unread, notification preferences and deduplication. “Delivered email” requires provider evidence; local notifications are described accurately.

---

## 9. Connected knowledge and Obsidian-inspired notes

### 9.1 Linking and navigation

Support `[[note title]]` search with ID-backed targets, aliases and heading links. Resolve duplicate titles using space/project context. Creating a missing note requires an explicit choice and known destination. Provide hover/focus previews, outgoing links, backlinks and related notes.

Backlinks derive from actual stored links and are filtered by access. A private note linking to a shared page must not expose its title or excerpt to the shared audience. Search, suggestions and graphs follow the same rule.

### 9.2 Note types

Lecture, concept, research, meeting, revision, daily journal, field observation and decision. Properties are optional unless the chosen workflow requires them. A concept note can link across courses, while a lecture note records a specific session.

### 9.3 Daily and weekly notes

Create one daily note per owner/date/timezone. Include optional intentions, notes, existing tasks and end-of-day reflection. Linked tasks are references, not new copies. Weekly review summarizes recorded completed work, upcoming deadlines, unresolved decisions and capture items. Do not generate personal reflections without marking them as drafts.

### 9.4 Graph and canvas

Graph mode visualizes accessible linked notes with search, space/tag filters, depth limit, node selection, open page and accessible list equivalent. Distinguish an explicit link from a suggested relationship. Start with local graphs around one note to keep the feature legible.

Canvas supports movable note cards, text cards and labeled connections, with pan/zoom, undo and keyboard alternatives. Note cards reference existing pages; free text cards are canvas content unless explicitly converted to notes. Store canvas layout independently from note text. Canvas/graph are secondary views, not required navigation.

### 9.5 Revision support

Allow questions, self-rated confidence, review date and a small revision queue. Derive no guaranteed retention score. An optional flashcard feature can use author-created question/answer blocks before any AI generation.

---

## 10. Integration throughout CampusOS

| Surface | Addition | Canonical owner |
|---|---|---|
| Home | Continue working, quick capture, assigned tasks | Workspace pages and existing tasks |
| Academics/course | My notes, shared study space, project links | Course registry + Workspace |
| Calendar/class | Take/open session notes | Existing event + note relation |
| Calendar/meeting | Agenda, decisions, action items | Existing meeting + linked pages |
| Bookings | Related meeting agenda | Reservation/meeting record |
| Community | Club workspace and event plan | Club membership + Workspace |
| Mentorship | Share selected project review | Explicit project invitation |
| Search | Notes, projects, tasks and decisions | Permission-filtered search |
| Notifications | Mentions, reviews, assignments, changes | Existing notification service |
| Campus AI | Selected accessible content assistance | Explicit context and permission |
| Time Tax | Measured retrieval/coordination trials | Evidence registry |

Add contextual buttons and compact previews; avoid placing a full editor on every screen. Opening a contextual note uses a side panel on desktop and a focused sheet/page on mobile, with “Open in Workspace.”

---

## 11. Templates with useful initial content

| Template | Initial sections and fields |
|---|---|
| Course notebook | Course relation; lecture notes; concepts; questions; revision queue |
| Lecture note | Session/date; key ideas; examples; doubts; related concepts |
| Team assignment | Brief; audience; deliverables; tasks; calendar; sources; decisions |
| Meeting | Purpose; agenda; preparation; decisions; actions; next meeting |
| Research evidence | Claim; source; method; date; finding; limitations; related argument |
| Field observation | Site; date/time; observer; method; raw observations; interpretation |
| Club event | Purpose; date; team; checklist; resources; risks; run sheet; retrospective |
| Revision sheet | Topics; formulas; examples; common mistakes; practice questions |
| Weekly review | Completed; unfinished; blockers; upcoming; learning; next priorities |
| Handover | Role; recurring work; contacts by authorized reference; open issues; documents |

Templates generate editable structure, not fabricated findings. A user can preview a template, choose a destination and create it once. Repeated clicks must not create duplicate projects.

---

## 12. Realistic demonstration data and interactivity

All fixtures below are **fictional proposed data**. Dates are illustrative planning dates, not professor requirements or verified campus events. Keep them in a separate removable demo space. Prefer relative-to-selected-demo-week offsets for durable demonstrations; default demo week begins 9 November 2026 in Asia/Kolkata. Normal mode uses the actual clock.

### 12.1 Fictional team

| ID | Name | Role | Work focus |
|---|---|---|---|
| demo-u1 | Aarav Mehta | Owner | Coordination and analysis |
| demo-u2 | Meera Nair | Editor | Fieldwork and evidence |
| demo-u3 | Kabir Sethi | Editor | Product workflows |
| demo-u4 | Tara Sen | Editor | Presentation and visual story |
| demo-u5 | Rohan Das | Commenter | Peer review |

Do not attach fabricated contact information, marks or real student IDs. Demo membership is isolated from real CampusOS profiles unless explicitly mapped.

### 12.2 Seed projects

1. **Time Tax investigation:** research, measurement, process analysis and prototype evaluation.
2. **Operations case presentation:** theory notes, discussion questions and slide preparation.
3. **Student club showcase:** event checklist, sessions and resource planning.

Seed approximately 24 usable notes, 20 tasks, 6 meeting records, 8 decisions, 10 research-source records and 2 canvases. These are fixture targets, not required real-data collection counts. Content should be short but substantive: a useful summary, a specific open question and at least one meaningful relation where appropriate.

### 12.3 Task fixture register

| ID | Task | Owner | Status | Illustrative due date | Dependency |
|---|---|---|---|---|---|
| demo-t01 | Finalize observation sheet | Meera | Done | 9 Nov 2026 | None |
| demo-t02 | Record mess peak window | Meera | Ready | 10 Nov 2026 | t01 |
| demo-t03 | Record mess off-peak window | Aarav | Ready | 10 Nov 2026 | t01 |
| demo-t04 | Clean paired observations | Aarav | Backlog | 11 Nov 2026 | t02, t03 |
| demo-t05 | Identify likely bottleneck | Aarav | Backlog | 12 Nov 2026 | t04 |
| demo-t06 | Draft meeting-to-room journey | Kabir | In progress | 11 Nov 2026 | None |
| demo-t07 | Review source labels | Rohan | In review | 12 Nov 2026 | t06 |
| demo-t08 | Prepare evidence slide | Tara | Backlog | 13 Nov 2026 | t04 |
| demo-t09 | Confirm test participants | Meera | Blocked | 12 Nov 2026 | External confirmation |
| demo-t10 | Run retrieval trial | Kabir | Backlog | 13 Nov 2026 | t09 |

A commenter such as Rohan can report review feedback; workflow actions remain constrained by role. “Assigned reviewer” does not silently grant edit rights.

### 12.4 Linked note examples

| Note | Actual seed content | Links |
|---|---|---|
| Time Tax project home | Scope: compare avoidable effort across selected campus journeys. Open question: which friction is information-related? | Evidence register; decisions; task collection |
| Bottleneck vs visible queue | A visible line may be downstream of the real capacity constraint. Record station completion rates before choosing an intervention. | Mess observation plan; theory notes |
| Mess observation plan | Record arrival, service start and service end separately. Keep meal duration outside queue time. | Observation sheet; trial limitations |
| Coordination meeting | Agenda: agree observation windows, assign roles, resolve missing data. | Team calendar; action items |
| Why we separated estimates | Planning targets cannot be reported as measured savings. | Presentation argument; decision D02 |
| Retrieval experiment | Compare finding a decision in scattered messages versus linked project records. | Trial protocol; evidence register |

### 12.5 Scheduling fixtures

Use a self-contained fictional availability set, not fabricated actual class timetables. On 11 November 2026: Aarav busy 09:00–11:00 and 14:00–15:00; Meera busy 10:00–12:00; Kabir busy 09:00–10:00 and 13:00–14:00; Tara busy 11:00–12:00 and 15:00–16:00. Meeting window is 09:00–17:00, duration 45 minutes, zero demo buffers. Full coverage applies only to these seeded intervals on that date.

Valid shared options include 12:00–12:45 and 16:00–16:45. The engine may produce other valid candidates according to its existing ranking, but must not invent availability outside defined coverage. Add a separate missing-coverage profile and a no-common-slot scenario.

If room matching needs capacity/hours, use a clearly named **Demo Study Room A** (6 seats, 12:00–17:00 fictional access window) in the isolated demo inventory. Do not invent those attributes for CR1, CR3, G12 or CR Conference Hall. Existing verified resource data takes precedence.

### 12.6 Meaningful activity seed

Use explicit historical fixture events: “Meera added the observation-sheet draft,” “Kabir linked the booking journey,” “Tara requested review of the narrative.” Timestamps are fixed seed timestamps with a demo label. New actions append actual events. Do not simulate live incoming activity on a timer.

---

## 13. Required source data and missing-data behavior

| Data needed | Minimum fields | Source / fallback |
|---|---|---|
| Current application | Routes, stores, editor/task/calendar components | Inspect current repository |
| Identity and teams | Stable user IDs, memberships, role scope | Existing identity; fictional demo users otherwise |
| Course registry | Course IDs, names, term associations | Existing supplied data; no guessed enrollment |
| Schedules | Start/end, timezone, recurrence, exceptions, coverage | Existing calendar sources; unknown when missing |
| Project brief | Deliverables, actual deadline, team | User-provided or labeled template |
| Rooms | IDs, availability, policy, capacity/source | Existing booking registry; isolated demo fixtures |
| Notes/materials | Author, audience, text/files, provenance | User-authored or authorized imports |
| Shared persistence | Auth, database, realtime, file storage | Explicit connection milestone |
| Notifications | Recipient, event, channel, delivery state | Existing in-app system; actual provider if connected |
| Evaluation | Method, observations, sample, date, limitations | Recorded usability trials |

Import preview shows column mapping, duplicate detection, intended audience and validation issues. Imported dates retain timezone and date-only meaning. User chooses append/update; imports do not silently overwrite existing records. Maintain source file/version references where available.

---

## 14. Data model and consistency contracts

Adapt these entities to existing types; avoid duplicate task, event, user or notification stores.

| Entity | Key fields |
|---|---|
| Space | id, type, title, ownerId, membershipPolicy, archivedAt, revision |
| Membership | spaceId, userId, role, invitationState, joinedAt |
| Page | id, spaceId, parentId, title, contentRef, properties, audience, revision, lifecycle |
| Block | id, pageId, type, structuredContent, order, anchor |
| Collection | id, spaceId, schema, title, revision |
| Record | id, collectionId, pageId, propertyValues, revision |
| View | id, collectionId, type, filters, sort, group, layout, ownerScope |
| Project | existing/project id, spaceId, members, dates, status, relations |
| Task | existing task id + project, assignee, dependency and linked-page fields |
| PageLink | sourcePageId, targetId, anchor, kind |
| Comment | id, targetId, anchor, authorId, body, threadId, resolvedAt |
| Decision | id, projectId, question, outcome, rationale, evidenceIds, actor, date |
| ActivityEvent | id, actorId, entityId, eventType, timestamp, revision, audience |
| Attachment | id, storageRef, filename, MIME, bytes, uploader, audience, state |
| DocumentRevision | pageId, revision, author, timestamp, contentRef, restorationSource |
| Canvas | id, spaceId, accessiblePageRefs, cards, edges, layoutRevision |

Relations store stable IDs. Read projections enforce authorization before rendering. Mutations use validation, operation IDs for retry deduplication and appropriate revision/concurrency handling. Dates use ISO representations; date-only deadlines stay date-only. Realtime timestamps must not become the sole ordering authority for document merges.

---

## 15. Connection stages and implementation architecture

### Stage A — Functional local prototype

Implement real editing, persistence, collections, views, links, tasks and calendar relations within the existing architecture. A profile-switch simulator can demonstrate roles and workflows but must be labeled. Separate devices do not automatically share this state. Provide export/backup before migrations and preserve existing user data.

### Stage B — Genuine shared work

At the project's existing final connected milestone, add authenticated identity, server-enforced membership permissions, durable shared storage, realtime updates, attachment storage and invitation acceptance. Test at least two separate sessions. The new scope does not silently cancel the established backend-last sequencing rule.

Use existing stack choices unless a concrete incompatibility requires change. Evaluate a collaborative editor with suitable shared-document support and choose one coherent persistence strategy. Do not bolt a second competing editor onto an existing capable one. Realtime document collaboration and resource booking consistency have different requirements: document merges can converge, while overlapping room allocations need server-side transactional protection.

### Stage C — Advanced knowledge and assistance

Graph, canvas, bounded automations, richer review tools and AI features follow a reliable core. Keep adapters optional; external Notion/Obsidian sync is a separate integration, not implied by inspiration or Markdown export.

### Conflict and recovery rules

- Text collaboration preserves concurrent changes using the chosen collaboration model.
- Structured property conflicts show a clear resolution or use server revisions; never silently lose a meaningful assignee/deadline change.
- Failed task assignment leaves the draft intact.
- A failed meeting reschedule retains the existing valid reservation.
- Revoked membership removes access to subsequent server reads and subscriptions; do not promise remote erasure of files already exported.
- Restoring a document creates a new current revision and retains history.
- Migrations are versioned and non-destructive; corrupt optional preferences do not reset project records.

---

## 16. Lively, useful interaction design

Use contextual responsiveness: cards update after actual work changes; task completion immediately updates the related count; backlinks appear after a saved link; a meeting's RSVP count changes after a real response; a resolved comment moves into the resolved filter.

| Interaction | Visible result | Requirement |
|---|---|---|
| Quick capture | New item appears in capture inbox | Fast save and recoverable failure |
| Drag task to review | Same task changes status across views | Permission and transition validation |
| Link concept | Related-note entry and backlink appear | Canonical IDs and access filtering |
| Select date | Calendar opens relevant record | Correct timezone/date semantics |
| Request review | Reviewer notification + review state | Authorized recipient and deduplication |
| Complete action | Linked task updates Home/project | One task identity |
| Search command | Relevant pages/actions in palette | Keyboard support and access filtering |

Use subtle transitions, stable layouts, meaningful empty states and real saves. Avoid random counters, fake collaborators and excessive celebration. Respect reduced motion. Make drag actions possible through menus/forms. Show loading only for actual work; no artificial delays.

Suggested shortcuts: platform modifier+K for command/search, a non-conflicting new-note action, Escape to close overlays and standard editor shortcuts. Do not override browser shortcuts unnecessarily. Slash and wiki-link menus must work with screen readers and touch.

---

## 17. AI assistance with explicit scope

Optional actions: summarize selected notes, propose action items, draft an agenda, suggest related accessible notes, extract revision questions and explain a referenced concept. Clearly label generated drafts and require review before task creation, assignment or publishing.

Show the selected source pages and relevant excerpts/references. AI retrieval must apply user permissions before supplying context. Inaccessible/private notes must not influence team answers. A missing source produces an honest limitation. AI cannot infer attendance, official grades, room availability or actual submission from free text.

---

## 18. Privacy, lifecycle and portability

Default new personal pages to private. New team pages inherit the team's documented audience. Show an audience pill and an understandable share dialog with exact members/roles. Moving a page to a shared space must preview audience changes. Relations and embedded views do not expand permissions.

Archive/Trash/Restore are normal product flows. Permanent deletion is a separate explicit action. Exports include only accessible selected records, with Markdown for pages, CSV for collections and a manifest preserving IDs and relation mappings where feasible. Explain unsupported formatting during imports/exports. Restoring an exported archive should not create duplicate users or override permissions.

Define retention, attachment limits and account deletion behavior before a real rollout. Backup and export must be available for notes students depend on.

---

## 19. Acceptance journeys and meaningful verification

| Journey | Required evidence |
|---|---|
| Create team project | Template creates one space/project with correct members and editable structure |
| Develop work together | Two connected sessions retain both edits after reload in shared mode |
| Discuss and review | Anchored comment, reply, resolve/reopen and revision-specific review work |
| Assign action from note | One task appears consistently in note, project, Home and Calendar where dated |
| Plan team meeting | Suggestions → poll → room → RSVP; unknown coverage remains unknown |
| Connect knowledge | Renamed link resolves; backlinks/search/graph do not leak private content |
| Use collection views | Table edit appears in board/calendar; filters do not mutate unrelated records |
| Recover work | Network/save failure retains draft; restored page becomes new revision |
| Respect permissions | Viewer cannot edit; commenter cannot grant access; removed member loses server access |
| Use mobile/keyboard | Capture, editor, task change, calendar and comments work without dragging |

Run existing relevant type/build checks and a bounded set of high-value tests for permission enforcement, concurrent editing, task/event consistency, date semantics and persistence. Use a two-session integration pass for shared claims. Inspect desktop around 1440 px and mobile around 390 px. Avoid tests that merely reproduce component markup. Report actual checks and limitations.

### Demonstration script, approximately 7–9 minutes

1. Open Time Tax team space and inspect roles.
2. Convert a meeting-note action to a dated task; show it on the project board and Home.
3. Link a concept note to an evidence note; follow the backlink.
4. Find a team time, select a valid candidate and link a room where eligible.
5. Add a comment as another authorized member; show a real update in connected mode or clearly label local profile simulation.
6. Edit a research record in table view and show the same record in another view.
7. Show a private note remains absent for another member.
8. Demonstrate draft recovery/export and explain what is measured versus proposed.

---

## 20. Operations course connection and evaluation

| Capability | Operations mechanism | Evaluation |
|---|---|---|
| Shared project records | Reduces repeated information retrieval | Time and errors finding a decision |
| Task ownership | Clarifies handoffs and work in progress | Unassigned actions; handoff delay |
| Dependencies | Exposes blocked work | Time blocked and cause |
| Group scheduling | Reduces coordination rounds | Messages, attempts and completion time |
| Shared evidence register | Reduces duplication/rework | Duplicate collection and correction counts |
| Templates | Standardizes recurring work | Setup time and omitted fields |
| Knowledge links | Improves retrieval across contexts | Retrieval success and relevance |
| Review workflow | Makes quality checkpoints visible | Review turnaround and reopened issues |

Use paired comparable tasks where feasible. Record participant count, task definition, baseline method, date, completion success and limitations. Report net task time, including time entering/updating information. Software logs do not establish a counterfactual on their own. Keep measured results, self-reports and modeled potential separate in the Time Tax dashboard.

---

## 21. Delivery milestones and copy-ready implementation directive

| Milestone | Outcome | Exit condition |
|---|---|---|
| W0 | Inspect affected code; map existing canonical stores | Clear reuse plan and current connection state |
| W1 | Workspace, editor, save/recovery, templates, capture | Notes survive reload and can be exported |
| W2 | Projects, collections/views, canonical tasks | Complete assignment workflow |
| W3 | Shared calendar context, meeting pages, OS entry points | End-to-end planning journey |
| W4 | Roles, comments, review, links/backlinks | Permission-correct local workflows |
| W5 | Connected collaboration at established integration milestone | Two-session durable updates and enforced access |
| W6 | Graph/canvas, bounded automation, selected AI | Reliable advanced flows with no core regression |

Treat the preceding requirements as the full target scope, with these milestones defining implementation order. Do not mark future-stage features implemented merely because a button exists.

> Extend the existing CampusOS application using this specification and the established V2/V3 product constraints. Build Workspace as a collaborative project and knowledge system with shared spaces, pages, structured collections, task ownership, calendar coordination, comments/review and connected notes. Reuse existing users, courses, tasks, calendars, meetings, booking records and notifications. Provide a dedicated Workspace destination plus contextual access throughout CampusOS. Preserve one canonical record for each task, event and note. Implement real stateful interactions, reliable saving and useful templates. Use the isolated fictional dataset in this document when actual inputs are missing, with honest provenance. Preserve the existing final-connected-phase sequencing; do not claim multi-device collaboration before authenticated shared persistence exists. Implement in bounded milestones, verify meaningful invariants and report designed, implemented, verified and connected features separately. Do not create a parallel app or replace existing CampusOS modules.

### Completion report format

List completed user journeys, changed integration surfaces, actual persistence/connection mode, executed checks, remaining dependencies and current run/preview instructions. Explicitly identify advanced features still pending. A specification or screenshot is not implementation evidence.

---

## 22. References and authority

### Current project sources

- CampusOS V3 Master Implementation Prompt, prepared 2 November 2026: existing constraints, canonical state, collaborative scheduling, source labels and final connected-phase boundary.
- Live CampusOS Home, Academics and My courses inspected on 3 November 2026. Inspection was read-only and limited to those surfaces.
- User direction: collaborative software breadth inspired by Notion, connected note-taking inspired by Obsidian, dedicated destination plus integration throughout the OS, extensive interactive specification and necessary data.

### Official inspiration references, checked 3 November 2026

- Notion: connected projects and documents — https://www.notion.com/en-gb/help/guides/accomplish-more-with-connected-project-management
- Notion: projects, tasks and views — https://www.notion.com/en-gb/help/guides/getting-started-with-projects-and-tasks
- Notion: subitems and dependencies — https://www.notion.com/help/tasks-and-dependencies
- Obsidian: internal links — https://obsidian.md/help/link-notes
- Obsidian: backlinks — https://obsidian.md/help/plugins/backlinks
- Obsidian: properties — https://obsidian.md/help/properties
- Obsidian: core plugins including daily notes, graph and canvas — https://obsidian.md/help/plugins
- Obsidian: canvas — https://obsidian.md/help/plugins/canvas

These references ground the inspiration concepts only. All CampusOS behavior, fixtures, milestones, priorities and architecture in this document are proposed product decisions, not assertions that either reference product implements the same campus workflow.
