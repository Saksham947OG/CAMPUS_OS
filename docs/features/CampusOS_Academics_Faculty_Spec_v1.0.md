# CampusOS — Academics & Faculty: Course Hub, Appointments, Mentorship, BMS Office

**Specification ID:** `COS-ACADEMICS-001`  
**Version:** `1.0 — proposed implementation baseline`  
**Original brainstorm feature coverage:** `F15` Course Hub (Google Classroom-style per subject); `F17` Professor availability and meeting appointments; `F21` Faculty Mentorship Connect; `F23` BMS Office meeting requests.  
**Related existing features:** `F02` Academic Calendar and course deadlines (covered by `COS-CAL-001`); `F26` personalized exam seating (belongs to a separate approved exam-information feature, not implicitly implemented here); `F03` Leave requests (covered by `COS-ADMIN-001`).  
**Project:** CampusOS — Introduction to Business Operations, *The Time Tax*.  
**Target:** A functional, high-quality **local-first academic prototype** integrated with the existing Home, Calendar, Task Panel, Notifications, and common reservations/request infrastructure.  
**Approval status:** The grouped feature direction comes from the user's approved brainstorming sequence. **Detailed rules introduced in this document are proposed prototype defaults**; adding this file to Claude Code does not automatically approve implementation or certify university policies.  
**Backend boundary:** All real staff authentication, campus integrations, cross-device updates, and operator-side live controls remain **FINAL PHASE ONLY**.

> **Source boundary:** The group's original brainstorm requests a course feed with faculty notices and lecture updates, subject resources (slides, readings, links and recordings when permitted), assignments and deadlines, discussion/office-hours contact, group work and a consolidated Calendar. It separately requests a way to find professors who are on campus and arrange meetings; project-group invitations for mentorship; and fixing a time to meet the BMS Office. The source provides **no actual course roster, authorized professor names, locations, availability, contact information, attendance/grade access, Moodle/Google Classroom credentials, real appointment-approval procedures, office opening hours, degree requirements, submission verification, or faculty endorsement**. Treat all missing information as unknown. Explicitly label seeded examples as *DEMO* and never imply that a real professor or BMS administrator has accepted a meeting.

---

## 1. Product goal and architectural principles

### 1.1 Problem and outcome

Students currently piece together academic context from emails, WhatsApp groups, class representatives, PDFs, and conversations. Meeting a professor or visiting the BMS Office can require unnecessary searching, walking, and repeated follow-up. Faculty mentorship for group work may require informal coordination.

CampusOS should help a student **find relevant published academic information, organize tasks, request meetings, and track requests without confusing simulated actions for institutional commitments**.

Student-facing promise: **Find your course. Plan your work. Request the right conversation.**

### 1.2 Four experiences, one shared foundation

1. **Course Hub (F15):** Course overview, announcement feed, materials and links, assignments, related Calendar, personal project/task planning, and optional questions/discussions.
2. **Faculty Appointments (F17):** Faculty directory with *published availability*, requestable demonstration slots, reason/topic, status and cancellation/rescheduling requests.
3. **Faculty Mentorship (F21):** Student-managed project groups, invitation to a demo mentor, meeting/feedback requests, and a traceable invitation status; no fabricated professor endorsement.
4. **BMS Office Meetings (F23):** Office information where supplied, available/requestable demo appointment windows, appointment topics, and status; reuse the same meeting-request engine, not a separate booking database.

**Shared primitives:** `Course`, `CourseEnrollment`, `CourseAnnouncement`, `CourseResource`, `AcademicDeadline`/existing canonical assignment, `ProjectGroup`, `MeetingRequest`, `PublishedAvailability`, `Invitation`, `ActivityEvent`, `Notification`. Only create new entities where existing repositories cannot represent the requirement.

**Shared UI:** CampusOS design tokens, course cards, searchable list, tabs, material links, accessible form, status timeline, actor-aware action panel, common empty/error states. Faculty/BMS appointment pages should share calendar slots and request components while retaining distinct service types and policy wording.

### 1.3 Non-goals

- Not an official learning management system or replacement for Google Classroom, ERP, institutional email, grading, examination or attendance systems.
- Not an official assignment upload/assessment or plagiarism-checking system. Showing a submitted form or clicking an external link does **not** verify academic submission.
- No faculty presence tracking, inference from Wi-Fi/location, covert attendance detection, or statements like **“Professor X is on campus now”** without an expressly authorized, current source.
- No university-approved office-hour booking, genuine BMS Office appointment, or recognized mentorship acceptance in the prototype.
- No real video meetings, direct messaging real faculty, email delivery, SMS/WhatsApp, automated contact discovery, private phone-number publication, or real teacher login.
- No sensitive student grades, official disciplinary records, attendance records or medical documents unless explicitly authorized and safely integrated in a later project phase.
- No impersonation of professor/administrator communication, signatures or institutional endorsement.
- No new backend, hosted database, webhooks, authentication service or multi-client synchronization before the explicitly approved final backend phase.

### 1.4 Invariants

1. Honor `README.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/FEATURE_REGISTRY.md`, `COS-HOME-001`, `COS-CAL-001`, `COS-ADMIN-001`, and relevant booking/spec contracts. Inspect current repository code before introducing schemas or routes.
2. `dataMode` (e.g., `demoSeed`, `provided`, `userCreated`, `simulated`) is separate from verification and publishing status; show source name, source time and `lastUpdatedAt` when meaningful.
3. Source course and published events are read-only to the student. Student-created tasks/notes/group records are editable by their owner within the local demo profile.
4. Calendar deadlines are projections of **one canonical academic deadline**, never separately copied to Home, Course Hub and Calendar. Do not invent due times; date-only remains date-only. Initial timezone `Asia/Kolkata`.
5. Actual professor/office calendars and capacity are unknown until supplied. Demo slots are not official availability; selected slots create **requests**, not guaranteed appointments.
6. Never turn `requested` into `confirmed` without a visible demo acceptance control, and never mark a meeting as held automatically when its scheduled time passes.
7. No direct external notification claim; in-app notifications only, deduplicated by record/transition.
8. Avoid exposing private birthdays, contact information, student group membership and personal project details to other demo profiles without permission.
9. The current prototype uses local persistence and clearly labelled, Settings-gated **Demo Operations** transitions. Seed data is deterministically resettable.
10. A misleading success button, dead CTA, fictional authority, fake faculty response, or duplicate official deadline is a bug.

---

## 2. Information architecture and routes

Use existing route conventions when appropriate. Canonical route examples below are proposals, not permission to duplicate routes already established.

| Route | Screen | Primary behaviors |
|---|---|---|
| `/academics` | Academics overview | My Courses, deadlines, recent announcements, project groups, Faculty Connect, BMS Office shortcut |
| `/academics/courses` | My Courses | Search/filter, course list by supplied academic profile and term |
| `/academics/courses/:courseId` | Course Overview | Course identity, next known class, next pending assignment, latest sourced notices, action tabs |
| `/academics/courses/:courseId/announcements` | Course Feed | Chronological sourced/demo-labelled posts; filter notice types, open linked references |
| `/academics/courses/:courseId/materials` | Materials | Browse/search links, slides, reading lists; safe external resource opening |
| `/academics/courses/:courseId/assignments` | Assignments | Canonical deadlines, status and linked personal tasks; open course/deadline/task panel |
| `/academics/courses/:courseId/projects` | Course Projects | Student project groups and milestones when available; link to Mentorship |
| `/academics/faculty` | Faculty Directory | Search/filter source-backed faculty profiles and published office hours; no invented presence |
| `/academics/faculty/:facultyId` | Faculty Profile | Sourced/DEMO profile fields, office hours if supplied, meeting request action |
| `/academics/faculty/appointments` | My Faculty Meetings | Pending, accepted demo, changes requested, rejected, cancelled, completed demo |
| `/academics/faculty/appointments/new` | Meeting Request | Choose known faculty, sourced/demo slot, subject, topic, mode if offered, review/submit |
| `/academics/mentorship` | Faculty Mentorship | My project groups, invitations, outstanding mentorship requests |
| `/academics/mentorship/groups/:groupId` | Project Workspace | Group summary, own milestones, invite request, traceable feedback request |
| `/academics/office` | BMS Office | Sourced office info, contact route if provided, available/requestable demo windows |
| `/academics/office/appointments` | My BMS Office Requests | Appointment status/history; create, withdraw, reschedule request |
| `/academics/appointments/:requestId` | Shared meeting request details | Dispatch by actor type: faculty vs BMS Office; stable deep links to Home/Notifications |

Main navigation **Academics** contains Course Hub, Faculty Connect, Mentorship, BMS Office. Exam seating F26 is an **informational linked placeholder** until separately specified and populated; do not implement personal seating as part of F15 without approval. Calendar F02 remains the canonical schedule interface.

**Desktop:** course list/main content with contextual details drawer; appointment listings with filter + request panel; project workspace summary and milestones. **Mobile:** single-column cards, tabs that do not overflow, accessible bottom sheet for meeting details. Preserve hybrid professional/student aesthetic; course pages can feel scholarly, not administrative/ERP-heavy.

---

## 3. Canonical models and data contracts

The following represent conceptual contracts; align field names to existing domain types if equivalent. Validate records before writing to local storage and before projecting to other modules.

| Entity | Essential fields | Required invariant |
|---|---|---|
| `Course` | `id`, `code?`, `title`, `termId?`, `batchIds?`, `sectionIds?`, `description?`, `source`, `dataMode`, `lastUpdatedAt?` | No fabricated code, faculty member, syllabus, timings or course link |
| `CourseEnrollment` | `id`, `courseId`, `demoProfileId`, `termId?`, `status`, `source` | Student sees only the source/profiling-supported courses; demo enrollments labelled |
| `CourseAnnouncement` | `id`, `courseId`, `title`, `body`, `noticeType`, `publishedAt?`, `source`, `audience?`, `status` | No fictional faculty authorship; date/time unknown stays unknown |
| `CourseResource` | `id`, `courseId`, `title`, `kind`, `uri?` or validated local demo file reference, `source`, `visibility`, `accessLabel?` | Do not claim external document access without working authorized URL |
| `AcademicDeadline` | canonical existing assignment/deadline identifier, courseId, title, `dueDate`, `dueTime?`, tentative/confirmed, source, optional instructions/link | Reuse `COS-CAL-001` contract; one record in all modules |
| `PersonalCourseNote` | id, ownerProfileId, courseId, text, updatedAt | Isolated student-owned data; never imply shared/faculty-visible |
| `ProjectGroup` | id, ownerProfileId, courseId?, title, description?, memberRefs with consent, createdAt, privacy | Personal demo group unless source explicitly supports shared roster |
| `GroupMilestone` | id, groupId, title, dueDate?, dueTime?, personalStatus, linkedTaskId? | Must not turn personal completion into official submission |
| `FacultyProfile` | id, displayName, facultyAssociation?, subjects?, officeHourRefs?, contactUri? (only public/authorized), source, updatedAt? | No inference that professor is on campus or currently available |
| `OfficeProfile` | id, officeType (e.g., BMS), name, publicHours?, serviceTopics?, location?, source | No invented hours, location or contact route |
| `PublishedAvailability` | id, actorRef, actorKind (`faculty`/`office`), startAt, endAt, publicationStatus, `source`, `dataMode`, lastUpdatedAt? | If DEMO, say DEMO; not an authorized real availability record |
| `MeetingRequest` | id, ownerProfileId, actorRef, actorKind, proposedSlotId? or proposed interval, topic, purpose?, status, createdAt, updatedAt, `dataMode`, `statusVersion` | Request ≠ confirmed meeting; student cannot approve own request |
| `MeetingEvent` | id, meetingRequestId, actorKind (`student`/`demoFaculty`/`demoOffice`), action, oldStatus?, newStatus, timestamp, reason? | Append-only history; one event/notification per unique transition |
| `MentorshipInvitation` | id, projectGroupId, actorRef, status, note?, createdAt, respondedAt?, dataMode | Mentorship invitation ≠ agreement to mentor; no real external delivery |
| `MentorshipFeedback` | id, invitationId, authorActorKind, text, timestamp, `simulated` | Simulated feedback is never attributed to a real professor |
| `PersonalTask` and `FocusBlock` | use existing Calendar/Task Panel canonical IDs | Home, Course Hub and Calendar derive from shared records |

**Availability versus appointment:** `PublishedAvailability` is information about a requestable period; `MeetingRequest` is a student request; `CalendarEvent` appears as a confirmed personal commitment **only after** permitted acceptance (demo accepted is clearly labelled). Do not treat a draft or pending request as a confirmed meeting. Optional personal tentative hold may be displayed with a distinct tentative label if explicitly requested by the student, not silently created.

**Slot capacity:** In the local demo, avoid accepted duplicate exclusive slot capacity if actor/resource policies require exclusivity. Concurrent multi-browser atomicity is impossible with independent localStorage; do not claim to support it until final backend. For source profiles with unknown capacity, present time proposals instead of automatically confirming.

**Provenance:** Use UI tokens such as `DEMO — Sample record`, `Student-created`, `Published by [provided source]`, `Tentative`, `Unverified`. `updatedAt` records the last local mutation; it is not a guarantee of freshness of external campus status.

---

## 4. F15 — Course Hub

### 4.1 Screen composition

Course Hub landing page contains a **My Courses grid** (subject, course code if known, term, class link, upcoming deadline count) plus source-labelled latest announcements. A compact **My Academic Focus** region projects pending tasks from the existing Task Panel. Students can filter by course, term and `my courses`; don't automatically invent a course list.

Each course page has a stable title banner and tabs:

| Tab | Content | Interaction |
|---|---|---|
| Overview | Verified/demo course description, next known class, upcoming assignments, latest notices | Open actual linked Calendar/course records |
| Announcements | Course notices (lecture changes, professor messages only if sourced, new materials, reminders) | Search, filter, view source and date; copy authorized link |
| Materials | Slides, PDFs, readings, cases, reference links and recordings where permitted | Open authorized file/link, mark personal reading progress if desired |
| Assignments | Source deadlines, instructions, submission destination link where supplied | Open assignment detail, add preparation tasks, schedule focus time |
| Projects | Project-group milestones, current student-owned groups, mentor request entry | Create private group demo, add personal tasks, open Mentor Connect |
| Questions (enhanced) | Personal questions and requests for office hours; optional seeded discussion | Save private draft or initiate meeting request; do not fabricate actual professor responses |

**Important:** Course materials can be a list of authorized external links; do not download, scrape or reproduce course PDFs without access and permission. If a resource URL is missing, show `Resource not provided`, never a broken invented URL. If an actual classroom platform is available, link to it; do not mimic its authentication or assert submission has occurred.

### 4.2 Academic deadlines and personal progress

- One canonical assignment/deadline referenced from Course Hub, Calendar, Home, Notification Center and Tasks panel.
- Date-only values remain date-only; no default `11:59 PM`, no assumed professor instructions.
- Student may create private checklist steps or focus blocks linked to the assignment.
- `personalStatus = completed` ≠ official submission. External upload/status fields are visible only if verified by a connected authorized service in a future phase.
- Multiple assignments on same day remain separate; missing due dates appear in **Undated/Needs clarification**, not silently excluded or guessed.
- Tentative/changed/cancelled assignment source status propagates to all views.

### 4.3 Course announcements

- Posts retain audience and source. Demo authors should be generic labels such as `Demo Academic Office` rather than impersonating a real faculty member.
- A class change notice may link to a source-backed Calendar exception only if that canonical exception actually exists. An announcement text alone must not silently rewrite the official timetable.
- Reading/not reading announcements is a **personal** local state.
- New announcement notification is generated only for an actual new local event, not every mount or refresh.
- Course filters use the current demo profile, not guessed enrollments.

### 4.4 Group work within the Course Hub

- Keep group name, description, milestones and linked tasks within a **student-controlled demo workspace**.
- Members are added as consented demo profiles or clearly fictional aliases; the prototype does not send invitations or expose actual student phone numbers.
- Avoid a full cloud collaborative document editor, group chat, gradebook or real LMS submission feature.
- Group milestones can optionally project onto Calendar if they have explicit dates and privacy allows. They are not official course deadlines merely because the student created them.

---

## 5. F17 — Faculty Directory & Appointments

### 5.1 Directory and visibility

Search/filter by known course or source-supplied faculty name, area and published office hours. Do **not** display inferred `on campus now`, current geolocation, tracking badges or free/busy statuses derived from absent data.

Faculty profile card:

- Display name and institutional role **only if provided** (else `Demo Faculty A`).
- Courses taught **only if sourced**.
- Published office hours and room/location **only if sourced**; indicate how recently verified if known.
- Contact or request-appointment action; links only if valid/authorized.
- Visible disclaimer: `Availability shown is demo information; no request reaches real faculty` for seeded records.

### 5.2 Appointment request flow

1. Open faculty profile, choose `Request meeting`.
2. Select provided/demo requestable slot, or propose a date/time if no published slots are available. If there are no slots and open proposals are not configured, show a truthful empty state.
3. Enter topic category (academic doubt / project guidance / office hours / other) and optional description; avoid requiring private or sensitive reasons.
4. Review whether slot is **DEMO** and whether request is pending, not confirmed.
5. Submit a valid local `MeetingRequest`; create stable ID and append `requested` event.
6. Display `Awaiting demo response` in request history and Home My Activity; in-app alert to student only for relevant transitions.
7. Only via explicit **Settings-gated Demo Operations** may the status become accepted/rejected/alternative proposed; no automatic acceptance.
8. On demo acceptance, create or project a single Calendar commitment labelled `DEMO-confirmed appointment` (not an official commitment); cancellation/reschedule changes that same canonical record.
9. Allow user withdrawal before confirmation; after confirmation, provide a cancellation request or confirmed-demo cancellation route according to defined policy—no invisible unilateral modification of another party's approval.

### 5.3 Appointment states

`draft → requested → accepted_demo | rejected_demo | alternative_proposed | withdrawn`  
`alternative_proposed → student_accepted_alternative → accepted_demo` only after separate explicit demo operator confirmation, **or** `alternative_declined → withdrawn/updated_request`  
`accepted_demo → cancellation_requested | cancelled_demo | completed_demo`

Statuses are scoped to a **demonstration**. `completed_demo` requires explicit simulator confirmation, not passage of time. `rejected_demo`, `withdrawn`, and `cancelled_demo` are terminal unless a *new* request is created. Every accepted change records actor, previous/new status, request version and timestamp; stale operations must fail validation. The state machine may be simplified in engineering if semantics remain equivalent and acceptance tests pass.

### 5.4 Conflict handling

- Student's timed Calendar commitments can generate non-blocking conflict warnings before they submit a meeting request.
- If an appointment source has known exclusive slot capacity, reject known duplicate accepted-demo bookings within local repository. Do not promise global multi-user atomicity.
- Office hours are not proof the professor is on campus that day; exceptional absence may be unknown.
- A date-only proposal cannot become a timed calendar block until the user selects a specific time.

---

## 6. F21 — Faculty Mentorship Connect

### 6.1 Product scope

Enable a student project group to prepare a mentorship request and track its **demonstration** lifecycle. Do not claim that faculty have joined or reviewed a group unless a permitted demonstration transition is recorded.

Project-group workspace shows group title, related course/project, description, student-owned milestones, consented demo members, requested mentors, and prior demo responses. Project groups created here reuse the same record shown under Course Hub → Projects.

### 6.2 Invitation flow

1. Student chooses owned group and sourced/demo faculty profile.
2. Student enters request note with project topic, intended type of support, and optional proposed meeting purpose (not automatically calendar-booked).
3. Preview recipient, scope and visibility; submit local invitation.
4. Invitation shows `Draft` / `Sent in demo` / `Pending demo response`; do not claim an email was sent.
5. In Settings-gated Demo Operations, simulate `Accepted`, `Declined`, or `Feedback requested` for that invitation.
6. If accepted in simulation, show mentor association **labelled simulated**; enable creating a meeting request using the same appointment workflow.
7. Feedback, if used, is clearly `Sample feedback — simulated`, attributed to `Demo Mentor` rather than a real professor.
8. Withdrawing an invitation or removing a group updates views and notifications without rewriting unrelated assignment deadlines.

### 6.3 Data and privacy controls

No unconsented group member publication, no real faculty personal phone numbers or actual messages, no automatic invite dispatch. A member can't be treated as having joined merely because a student typed their name. Model demo-only participation; if the project later needs real multiuser membership, require consent and backend validation in final phase.

A group can have multiple proposed mentors only if explicitly configured; initial default = one active mentorship invitation per group at a time to avoid duplicates. This is a **prototype policy**, not an institutional rule.

---

## 7. F23 — BMS Office Appointments

### 7.1 Shared appointment engine

Use the **same `MeetingRequest` repository/state transition utilities** as Faculty Appointments, with `actorKind = office`. Don't create a second competing appointment store. Office-specific topic categories are configurable (e.g., administrative query, documents, academic scheduling); do not assert office services beyond supplied data.

### 7.2 Student experience

- Office overview: known location/hours/contact as supplied, otherwise `Not provided`.
- Show sample `Request a meeting` action, form and existing request status; label every demo time window.
- Submit student request: topic, proposed slot/known demonstration slot, optional notes, confirmation review.
- Show request status, current demo actor, timeline, pending actions and in-app notifications.
- A request is not an official appointment until later authorized verification; even `accepted_demo` means **simulated acceptance only**.
- Do not imply a submitted administrative request is automatically processed or that queue wait has been eliminated.

### 7.3 Interaction with existing Administration module

BMS Office appointments live under **Academics** or a cross-link from **Administration**. They are **meeting requests**, not leave/out-time approval records (`COS-ADMIN-001`). If a request concerns an active leave request, link to that record by ID if permitted; never mutate/approve the leave as a consequence of an office appointment.

---

## 8. Shared meeting request UI and notifications

### 8.1 Standard request components

- Actor card (faculty/office) with data source label and known contact information only.
- Slot selector with date/time/timezone, accessibility, and disabled/unknown states.
- Topic form with validation, character limits, sensible defaults and optional privacy note.
- Review page: person/office, requested date and time, meeting status **Request**, demo disclaimer.
- Status timeline with actor type and timestamps; primary action only if permitted in current state.
- Conflict warning for known timetable overlap; never automatically reschedule a class.
- Empty states: `No source-backed availability published`, `No requests yet`, `No project groups yet`.
- Failure states: bad date, past date, missing slot, inaccessible resource, malformed profile, stale status, invalid role.

### 8.2 In-app notifications

| Trigger | Recipient and message | Notes |
|---|---|---|
| Meeting request created | Student: `Demo meeting request recorded` | Do not say sent to faculty/office |
| Accepted in demo simulator | Student: `Demo appointment accepted` | Deep-link exact meeting |
| Rejected / alternative proposed | Student: reason or alternative if recorded | No fabricated reason |
| Student withdraws | Student: `Demo request withdrawn` | Append history once |
| Mentorship invitation created | Student: `Demo mentorship invitation recorded` | No external delivery claim |
| Mentorship demo response | Student: `Demo mentorship status updated` | No impersonation |
| Course announcement imported/added in simulation | Relevant demo profiles, if eligible | Deduplicate; source-labelled |
| Academic deadline changed in canonical dataset | Relevant demo profiles | Use Calendar reminder logic, no duplicate conflicting notifications |

No pushes outside an open browser, email, SMS or WhatsApp until infrastructure is genuinely implemented and tested.

### 8.3 Cross-module contracts

| Existing module | Integration rule |
|---|---|
| Home | `Up Next` selects accepted (DEMO-labelled) timed meeting only; `My Activity` shows pending meeting/invitation requests; course deadlines remain sourced from Calendar |
| Calendar | Accepts official source-backed lecture/deadline projections, confirmed demo meeting projections and personal tentative holds only when student opts in; no duplicate event copies |
| Task Panel | Personal tasks linked to assignments/projects; completion never confirms external submission |
| Notifications | Event ID and transition version dedupe; deep links to proper course/meeting/mentor record |
| Search | Index valid course/resource/faculty/office names and accessible content only; do not leak private notes across demo profiles |
| Administration | BMS Office meetings link from admin hub without turning them into leave approvals |
| Time Tax | Aggregated research/simulation outcomes must be clearly distinguished from actual observed waiting reduction |

**External links:** Use safe URI validation; display external destination, open with appropriate browser protections; don't assume source is publicly available or upload documents to an unauthorized service.

---

## 9. Interface design and accessibility

### 9.1 Visual direction

Consistent with hybrid CampusOS design system: warm neutral surfaces, deep ink text, restrained teal for primary actions, category colours for academic modules and secondary warm accents. Avoid duplicating a full Google Classroom visual identity. Familiar subject cards and digestible tabs are appropriate, but the application should feel like the same CampusOS product as Home/Calendar.

### 9.2 Page hierarchies

- **Academics Hub:** Header + `My Courses` grid + `Next academic priorities` + `Faculty Connect` + `Project groups` + BMS Office shortcut. No meaningless KPI cards with fabricated numbers.
- **Course detail:** Compact course header; Overview / Announcements / Materials / Assignments / Projects / Questions tabs; optional right rail for selected record.
- **Faculty profile:** Name and source, published availability if known, context such as related courses, primary `Request a meeting` CTA.
- **Mentorship:** Group cards, current invitation status, explicit Create Group/Request Mentorship flow.
- **BMS Office:** Known hours/contact banner, appointment requests and history.
- **My Requests:** Unified `Faculty`/`Office` filtering; per-request status, date, action, timeline.

### 9.3 Accessibility and responsive behavior

Touch targets appropriate for mobile; keyboard tab order, semantic headings and forms, visible focus, labelled status icons, `aria-live` for local status changes when appropriate, readable cards at narrow widths, no hover-only actions, error message associated with its field. Respect reduced motion. Test with slow network simulation only where data loading actually exists; local seed has no false loading animation required.

### 9.4 Design states

Every feature covers sourced/simulated, empty, error, partial-data, rejected and cancelled/withdrawn. Unknown office hours and faculty availability must be presented as unknown, not blank calendar cells falsely implying free time. For no assignments, show `No assignment records available for this course` rather than `You have no work to do`.

---

## 10. Time Tax: measurable Business Operations framing

The academics module addresses information-search time, avoidable trips, coordination time, and meeting request processing—not guaranteed academic performance improvements.

| Workflow | Baseline observation to collect | CampusOS scenario metric | Interpretation caveat |
|---|---|---|---|
| Locate class resources | Time to find actual slide/link across current communication channels | Time to find same resource via Course Hub | Requires representative tasks and valid resource links |
| Deadline discovery | Frequency of missed/confusing announcement and time spent verifying date | Consolidated source-backed deadline lookup | Reduction is not guaranteed; correctness must be verified |
| Faculty contact | Time spent locating published hours or walking to seek faculty | Time spent requesting + follow-ups in demo | Does not prove actual meeting availability |
| BMS Office visit | Unsuccessful visit rate and search/queue time | Avoided trips under appointment scenario | Must account for actual office queue and request delays |
| Mentorship coordination | Number/time of outreach attempts until response | Simulated centralized invitation tracking | Demo acceptance does not establish real faculty participation |

**Suggested metrics:** median search time, unsuccessful visit count, request turnaround (measured for actual operations, or simulated and labelled), completion rate of recorded requests, follow-up count. Do not fabricate observed baselines or show hypothetical saved time as measured effect.

**Scenario formula:** `hypothetical_time_avoided = max(0, baseline_search_or_visit_time - scenario_search_or_visit_time)`; present assumption inputs and label model output as simulated. Distinguish student time avoided from faculty workload; digital requests may shift workload rather than reduce it.

---

## 11. Edge cases and required responses

| Edge case | Required behavior |
|---|---|
| No course data supplied | Show curated DEMO courses (clearly labelled) or transparent empty state, never invented official enrolment |
| Enrollment differs by demo profile | Isolate each profile's courses and private tasks; filters must not leak another profile's data |
| Assignment has no due time | Remains date-only; course and Calendar display same value |
| Assignment has unknown due date | Display undated; do not manufacture a date or countdown |
| Assignment revised at source | Change canonical record and update all projections; keep provenance/change history where available |
| Invalid or unavailable resource link | Disable/open safe explanation; do not substitute fabricated URL |
| Faculty has no sourced office hours | Show `Availability not provided`; optional proposed-date request only when configured |
| Published hours are outdated | Show source freshness; do not assert current faculty presence |
| Appointment conflicts with lecture | Warn; allow requesting alternative; don't edit underlying lecture |
| Student clicks submit twice | Stable idempotent local request creation for the same submission attempt |
| Demo operator accepts stale request version | Reject stale transition, ask to reload; don't overwrite newer state |
| Two requests target exclusive known slot | Local store enforces demo capacity if configured; no cross-browser guarantees |
| Meeting is pending at scheduled time | Remains pending, never silently becomes confirmed/completed |
| Faculty proposes alternative date | Student must acknowledge; final confirmed-demo state only through explicit simulator step |
| Mentor rejects request | Preserve request history; cannot be listed as active mentor |
| Project group deleted | Confirm destructive action; do not delete linked canonical academic assignment |
| Student enters real private contact | Warn/remind not to include; do not automatically publish to other demo users |
| Student marks personal task done | No official submission status change |
| BMS Office appointment accepted in demo | No official office authorization/queue priority claim |
| Local storage fails/full | Preserve form draft in UI and display clear error, not success |
| Filter hides linked record | Deep link offers to temporarily reveal; never report record nonexistent |
| Demo reset | Clear personal demo records predictably without altering immutable original supplied schedule files |
| Browser refreshed | Persist supported student records, statuses, preferences as documented |

---

## 12. Reproducible demo scenarios

**Scenario AC-DEMO-01 — Course to Calendar:** Open a sample course → view sourced/DEMO assignment → open its one canonical Calendar deadline → add personal preparation task → see that task on Home → complete task personally without changing official submission state.

**Scenario AC-DEMO-02 — Faculty appointment:** Open demo faculty profile → view source-labelled demo slot → submit meeting request → Home My Activity shows pending → enable Settings Demo Operations → explicitly accept → one in-app notification and one Calendar meeting appear → cancel in demo → Calendar projection changes and status history remains.

**Scenario AC-DEMO-03 — Faculty unavailable:** Open a faculty member without confirmed availability → see unknown/empty state → do not offer a fake booked slot. If configured, propose time without claiming confirmation.

**Scenario AC-DEMO-04 — Mentorship:** Create a private demo project group → add personal milestones → request demo mentor → simulate accept or decline → invitation timeline updates → optionally request a meeting, separately.

**Scenario AC-DEMO-05 — Office request:** Open BMS Office with illustrative hours clearly labelled → submit appointment request → simulate proposal of alternate time → student's explicit acceptance/decline → appointment remains a demo and doesn't mutate leave authorization.

**Scenario AC-DEMO-06 — Broken external link:** Open course material with absent/invalid URL → see unavailable state; no invented navigation or external transmission.

**Scenario AC-DEMO-07 — Profile boundary and reset:** Switch demo profiles; private project/meeting/task records do not leak; reset restores deterministic seeds and leaves immutable supplied files intact.

---

## 13. Incremental implementation plan (only after approval)

These are dependency stages, **not an instruction to auto-implement all at once**. Sequence and file paths must adapt to the actual repository.

| Stage | Deliverable | Completion gate |
|---|---|---|
| `AC-0` | Audit existing Calendar, Home, booking/request repositories and design components; map canonical records and routes | No duplicate store or stale conflicting types; implementation plan approved |
| `AC-1` | Course Hub landing, seeded/sourced course records, course details, announcements/materials | Course navigation, source labels, empty/error states tested |
| `AC-2` | Assignments/deadlines, personal tasks and project-group workspace | One canonical deadline; cross-screen progress and privacy tests pass |
| `AC-3` | Faculty directory, slot visibility, appointment request state machine, shared form | No fake real availability or auto-accept; validation and status history tested |
| `AC-4` | Mentorship invitations and BMS Office appointments reusing meeting engine | Separate actor types and demo response behavior, no official approval claims |
| `AC-5` | Home/Calendar/Notifications/Time Tax links, accessibility, keyboard/mobile, integrated tests and visual QA | Evidence logged; all planned acceptance cases pass or tracked as partial |
| `FINAL` | Optional narrow operator simulator backed by shared server with access controls and live cross-client updates | Only when separately authorized in final project phase |

**Stop after every approved stage.** Developer tool availability and existing code determine exact implementation details. Avoid introducing an additional full LMS stack or chat server merely to support this scope.

---

## 14. Acceptance test matrix — requirements, not test results

Each item must become an executable unit/integration/E2E or a documented manual test as appropriate; prefix `AC-AT`.

| ID | Expected behavior |
|---|---|
| AC-AT-01 | Academics overview shows source-labelled Course, Faculty, Mentorship and BMS Office entry points |
| AC-AT-02 | My Courses filters by approved demo profile/term and doesn't invent other course enrollments |
| AC-AT-03 | Course details display unavailable source fields honestly |
| AC-AT-04 | Announcements have source, category and audience labels |
| AC-AT-05 | Announcement reading state is profile-specific and persists |
| AC-AT-06 | Invalid/missing material URLs cannot be opened as fake resources |
| AC-AT-07 | Valid permitted course resource link opens correct destination |
| AC-AT-08 | Course assignment, Calendar and Home share one canonical deadline ID |
| AC-AT-09 | Date-only assignment is never silently given a due time |
| AC-AT-10 | Undated deadline stays unknown and has no countdown |
| AC-AT-11 | Marking personal task complete does not mark official assignment submitted |
| AC-AT-12 | Student focus block appears on Calendar/Home and retains linked task ID |
| AC-AT-13 | Project-group milestones do not mutate official course deadlines |
| AC-AT-14 | Unconsented/private group information doesn't appear across demo profiles |
| AC-AT-15 | Faculty profile has no inferred real-time presence/availability |
| AC-AT-16 | Unknown faculty office hours display unknown rather than fake empty schedule |
| AC-AT-17 | Meeting request form validates topic, date/time, actor and prohibited state transitions |
| AC-AT-18 | Repeated submit does not duplicate same local request attempt |
| AC-AT-19 | Pending request does not become a confirmed Calendar appointment |
| AC-AT-20 | Only Settings-gated simulator can accept or reject a pending meeting |
| AC-AT-21 | Accepted-demo appointment creates one labelled Calendar projection and one linked Home activity |
| AC-AT-22 | Cancellation/withdrawal updates canonical state and linked projections |
| AC-AT-23 | Meeting history preserves actor kind, timestamp and state version |
| AC-AT-24 | Stale simulator transitions fail rather than overwrite newer state |
| AC-AT-25 | Overlap with known class produces warning, not automatic class rescheduling |
| AC-AT-26 | Simulated mentorship invitation is never claimed delivered to real faculty |
| AC-AT-27 | Demo mentor acceptance/decline has correct terminal/active semantics |
| AC-AT-28 | Mentor meeting request reuses faculty appointment engine |
| AC-AT-29 | BMS Office appointment reuses shared meeting engine with `actorKind=office` |
| AC-AT-30 | BMS Office acceptance does not alter leave approvals or campus access |
| AC-AT-31 | In-app status notifications dedupe on unique transition and deep-link properly |
| AC-AT-32 | External email/push/WhatsApp success is never claimed |
| AC-AT-33 | Search is constrained to accessible indexed records; no private information leakage |
| AC-AT-34 | Calendar hidden filters can reveal deep-linked course/meeting record temporarily |
| AC-AT-35 | Local records persist across refresh and don't corrupt immutable fixture data |
| AC-AT-36 | Data reset clears personal demo records predictably with explicit confirmation |
| AC-AT-37 | Keyboard forms, focus order, labels, error display and reduced-motion behavior pass visual/manual review |
| AC-AT-38 | Narrow-mobile Course, Faculty and Mentorship screens remain navigable without overflow |
| AC-AT-39 | Scenario Time Tax uses labelled assumptions, not fictional measured results |
| AC-AT-40 | No backend service, real faculty sign-in or cross-client live synchronization was introduced in this phase |

Acceptance IDs **do not imply tests have been written or run**. At completion, provide exact command output, test evidence, browser screenshots/observations and any partial items. An inaccessible link or unsupported preview must be reported honestly.

---

## 15. Decisions, unresolved inputs and scope boundaries

### Confirmed from user/group context

- F15 Course Hub and its resource, announcement, deadline, group-work and question/office-hours ambitions.
- F17 faculty meeting/availability access (without supporting actual data yet).
- F21 mentorship invitation concept for project groups.
- F23 BMS Office appointment idea.
- Shared CampusOS style, canonical Calendar data, local-first demonstrator, separated simulated statuses and final-phase backend.

### Proposed implementation defaults (not institutional policy)

- Faculty and BMS Office requests share `MeetingRequest` with actor-kind variants.
- Students create meeting **requests**, not instant confirmed meetings.
- An accepted request in the simulator projects one DEMO-labelled calendar commitment.
- A student may propose a date/time when no sourced slots exist only if the request policy permits proposals.
- One active mentorship invitation per demo project group at a time; configurable.
- Announcement read/unread is personal; personal project workspace is private by default.
- Optional Questions tab begins with private notes/appointment links, not an unmoderated public discussion board.
- No fake gradebook, uploads, teacher chats or student/faculty direct messaging.

### Inputs to request later (not blockers for a clearly labelled prototype)

1. Actual course names, codes, batch and term metadata; course syllabus/resource URLs and permissions.
2. Faculty directory and publicly published office-hour schedules if available, and permitted contact methods.
3. Verified BMS Office schedule, request subjects, location, and whether any real appointment policy exists.
4. Actual project-group membership rules and whether mentors may receive digital invitations.
5. Real deadlines and classroom announcements (will be imported via approved Calendar data pipeline).
6. Whether externally linked course resources require sign-in; avoid embedding inaccessible protected material.

Do **not** silently convert unresolved inputs to official facts. Where essential exact values are unavailable, use transparent empty state or deterministic anonymized demo fixture.

---

## 16. Claude Code integration instructions

1. Add this file under `docs/features/CampusOS_Academics_Faculty_Spec_v1.0.md`.
2. Record specification `COS-ACADEMICS-001`, covering `F15`, `F17`, `F21`, `F23`, in `docs/FEATURE_REGISTRY.md`; cross-reference F02 (Calendar), F03 (Leave), F26 (Exam Seating, separate scope).
3. Record user-confirmed decisions and **proposed** technical defaults separately in `docs/DECISIONS.md`. Do not mark this module implemented by registering the specification.
4. Audit actual existing modules and reuse Calendar/Task repositories, request workflow, notifications and booking-aware slot utilities. Don't blindly copy files or build a second Calendar/tasks database.
5. Before coding, present stage `AC-0` with exact files, dependencies, tests, risks and stop condition, and obtain approval in the existing phased-development process.
6. Keep all academic source fields and real-person identity data grounded. No invented faculty location, presence, official appointment, mentor acceptance, due date, grades or institutional integration.
7. Actual backend, email/push, real staff authentication and two-browser live updates remain for the final approved backend phase only.

**Definition of done:** Screen-level features, valid local state transitions, cross-module projections, mobile/keyboard accessibility, provenance and privacy boundaries, and documented acceptance-test evidence. A Markdown file, visual stub or seeded demo alone is **not** implementation completion.
