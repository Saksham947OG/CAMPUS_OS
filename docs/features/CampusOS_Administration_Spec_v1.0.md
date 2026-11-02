# CampusOS — Administration: Leave & Out-Time, Complaints, Teaching-Aid Maintenance

**Specification ID:** `COS-ADMIN-001`  
**Version:** `1.0 — proposed implementation baseline`  
**Original brainstorm coverage:** `F03` Administration/Leave & Out-Time; `F12` Complaint Tracker; `F14` Teaching-Aid Maintenance.  
**Related future feature:** `F23` BMS Office appointments (not implemented by this specification; link/placeholder only until individually specified).  
**Project:** CampusOS · Introduction to Business Operations · *The Time Tax*  
**Target:** Interactive, local-first academic prototype, not an operational institution-approved system.  
**Status:** Three service experiences designed together; new detailed rules below are **proposed prototype defaults**, not verified university procedures. Addition to the repository does not automatically approve implementation.

> **Source boundary.** The group's brainstorming notes call for (a) a fully online leave/out-time request with submission, authorized approval, changes, reasons for rejection, timestamps, guard/gate verification and student history; (b) facilities complaints for plumbing, electrical, Wi-Fi, room cleaning and washrooms, including photos, locations, ticket tracking, priority, team assignment, expected response, reopen and escalation; and (c) a teaching-aid issue route for classroom projectors, microphones, AC and smartboards, allowing report → assign → fix → confirm/reopen. The files do **not** establish authorized approver identities, real institutional leave policy, whether security can accept digital permissions, service-level agreements (SLAs), evidence-retention rules, real staff identities, or which classroom identifiers are valid. Do not invent these as university facts.

## 1. Goal, architecture, boundaries

### 1.1 Why these three belong together

All three services use a shared **request intake, tracking, comments and activity timeline**. They differ significantly in **business authorization rules**:

- Leave/out-time is an *approval process*, with distinct approver decision and possible gate verification; it can never authorize a real departure in this prototype.
- General complaints are *work tickets*, assigned to a relevant demo team and marked resolved or reopened; no formal leave-like authorization.
- Teaching-aid reports are *specialized work tickets* tagged to a classroom asset, sharing exactly the general complaint lifecycle and repository.

**Architecture rule:** Share primitives (`RequestIdentity`, audit event, status history, notification, attachment descriptor and list/filter components), but do **not** force leave and maintenance into one interchangeable status enum or treat a maintenance resolution as a leave approval. Use typed domain variants or distinct workflow policies on a common request substrate. Never create two disconnected complaint databases.

### 1.2 What CampusOS is / is not

**Is:** A campus-facing workflow demonstration with functional student submissions, local persistence, audited mock decision transitions via a visible simulator, personal request history, meaningful statuses, and shared Home/Notification integrations.

**Is not:** A university-approved leave portal, a valid gate pass, evidence of a warden's authorization, a real campus maintenance dispatch system, an emergency response channel, an actual office or security system, a verified staff directory, an authenticated personnel platform, an email/SMS/push delivery service, or a cross-client live backend.

**Never** display `officially approved`, `security authorized`, `verified by guard`, or `technician fixed` for local simulated activity without an adjacent explicit **DEMO / SIMULATED** label. Demo approval PDFs, if produced, must have a prominent permanent **SAMPLE — NOT VALID FOR CAMPUS ACCESS** watermark and cannot resemble an official authorization or use institutional seals/signatures.

### 1.3 Project-level invariants

1. Respect `README.md`, `CLAUDE.md`, `docs/DECISIONS.md`, registry, `COS-HOME-001`, `COS-CAL-001`, and other completed modules. Inspect current project structure; don't silently rename or duplicate stores.
2. `Asia/Kolkata` app timezone initially. Date-only values remain date-only; a requested overnight interval uses exact start and end date/time with `end > start`.
3. Distinguish `dataMode: demoSeed | userCreated | simulated | provided`, and `verified` from `source`, `status`, and `lastUpdatedAt`. Real campus facts are absent until supplied.
4. In the current prototype, requests are isolated by demo profile, and operator transitions happen only through a **visible, Settings-gated local simulator**. Simulated actors do not impersonate real people. Simulator not exposed as a real institutional login.
5. No invisible timers auto-approving requests, no automatic gate verification, no automatic claims of actual maintenance completion.
6. In-app notification only, generated once per unique transition and recipient. No claim that email, WhatsApp or phone push notifications were sent.
7. No fake live occupancy, real approver identity, real request receipt, response ETA, SLA or service times.
8. Avoid storing genuine medical certificates, real personal addresses, health details or other sensitive documents in public demo fixtures or unprotected browser storage. Demo attachments may use metadata or safe sample files only.
9. Never let changing filter/presentation erase requests. User actions, status transitions, and resets have separate mechanisms.
10. Actual backend, staff authentication, external integrations and cross-browser live updates remain **FINAL PHASE ONLY**.

## 2. Information architecture and routes

Adapt route names to the existing router if equivalents exist; choose canonical routes and avoid duplicates.

| Route | Screen | Content and actions |
|---|---|---|
| `/administration` | Administration Hub | Primary cards: Leave & Out-Time, Facility Complaints, Teaching-Aid Reports; My Requests summary and explicit demo disclaimer |
| `/administration/leave` | Leave & Out-Time | Request form entry, request history, tabs by status, demo-only approval disclaimer |
| `/administration/leave/new` | New Leave Request | Type, interval, reason, affected classes if known, optional safe demo attachment metadata, review and submit |
| `/administration/leave/:requestId` | Leave Details | Student-facing status timeline, fields, history, allowed student action, mock approval details |
| `/administration/complaints` | Complaint Tracker | All the student's tickets with category, location, status and age; submit new complaint |
| `/administration/complaints/new` | New Complaint | Category, location, description, optional safe sample image metadata, submit |
| `/administration/complaints/:ticketId` | Complaint Detail | Ticket status, assignment category, timeline, comments, reopen where applicable |
| `/administration/teaching-aids` | Classroom Equipment | View student-visible reports, classroom/asset selection, create teaching-aid ticket |
| `/administration/teaching-aids/new` | Report Teaching Aid | Classroom, equipment type, symptoms, optional media metadata, submit |
| `/administration/requests` | My Requests | Cross-category personal requests with search, status/source/type filters |
| `/administration/requests/:id` | Unified deep link | Dispatch to canonical leave/ticket details; don't duplicate a second request record |

**Shared UI:** Page header with back navigation and demo state; accessible request cards and filters; timeline; contextual actions. Main navigation under **Administration**. Deep links from **Home → My Activity** and notification inbox open exact request detail; linked calendar items show context but do not imply official approval.

**Desktop:** Summary/submit CTA + request list + right-side details/timeline drawer. **Mobile:** category tabs/cards → single-column forms → full-height request detail sheet. Preserve hybrid warm-neutral, ink and teal design tokens; use status text + icons in addition to color.

## 3. Canonical data contracts

Use typed conceptual models below; implementation field names can align with existing code. No specific dependency/library is mandated without checking the repository.

| Entity | Minimum contract | Key invariant |
|---|---|---|
| `AdministrativeRequest` | stable ID, ownerProfileId, kind (`leave`/`complaint`/`teachingAid`), createdAt, updatedAt, dataMode, currentStatus, statusVersion, source label | Immutable identity; each detail view references one canonical record |
| `RequestEvent` | eventId, requestId, actorType (`student`/`demoApprover`/`demoTechnician`/`demoGate`), eventType, before/after, timestamp, optional reason | Append-only audit history; no silent edits to historic approvals/statuses |
| `LeaveDetails` | requestId, leaveType, start/end date-times, reason, affectedClassIds optional, attachments descriptors optional, submissionRevision | Student-supplied request is not institutional evidence of permission |
| `LeaveDecision` | requestId, revision, decision, decisionAt, simulatedActorRole, reason optional | One current decision for the submitted revision; revision invalidates earlier current decision |
| `GateEvent` | requestId, simulated event kind (depart/return/denied), time, actor, linked approval revision | Distinct from approving leave; not a real guard event |
| `TicketDetails` | requestId, category, description, locationReference optional, priority optional, teamLabel optional, issueState, lastStatusAt | Complaint and teaching aids share one ticket store |
| `TeachingAidMeta` | ticketId, classroomReference, assetType, fault description, deviceIdentifier optional | Specialized ticket fields; no separate ticket lifecycle |
| `AssignmentEvent` | ticketId, team/technician demo label, assignedAt, reason | Don't invent real teams or staff identities |
| `AttachmentDescriptor` | attachmentId, filename/displayName, MIME/size, demoOnly, dataMode | Avoid sensitive actual file persistence in this prototype |
| `RequestNotification` | recipientProfileId, requestId, transitionId, kind, createdAt, readAt optional | Deduplicate and access-control by recipient |
| `ResponseTarget` | category + optional policy target in minutes/hours, source and demo flag | Unknown target remains unknown; cannot imply official SLA |

### 3.1 Status and identity separation

- A request's current status is a derived projection of its transition history, not a label independently modified in multiple screens.
- Keep leave statuses and ticket statuses separate. A common activity feed can join them without falsely mapping `resolved` to `approved`.
- Store statuses as machine values; render exact student-friendly labels, e.g. `Awaiting demo approval` rather than just `Approved`.
- IDs must survive refresh and prevent duplicate submissions from rapid clicks. Edits to approved/rejected revisions create a new revision only through an allowed workflow, not historical overwrites.
- Record actor roles and explicit simulated provenance on every privileged transition.

## 4. F03 — Leave & Out-Time Requests

### 4.1 Main student experience

**Page zones:** an honest banner (`Demonstration only — not a valid campus leave permission`); primary **New request** button; current requests; status tabs (pending, changes requested, accepted in demo, rejected, withdrawn, historical); request detail timeline.

**Form fields** (source-aligned):

| Field | Validation / UI |
|---|---|
| Request type | Proposed `personal`, `medical`, `event`, `emergency`, `other`; categories not official campus taxonomy |
| Outgoing date/time | Required for out-time simulation; local timezone |
| Intended return date/time | Required for interval type; return must be after departure |
| Reason | Required student-entered text with sensible length limits, no forced disclosure of sensitive details |
| Classes missed | Optional selection of existing imported classes; no manual invention of timetable facts |
| Supporting proof | Optional demo file descriptor / safe sample only; never demand actual medical documents |
| Emergency note | Display non-operational disclaimer: this form does not contact emergency responders or guarantee immediate review |
| Review | Clear summary, explicit **Submit demo request** confirmation |

`submitted` means **stored in CampusOS demo**, not received by the university. Include submission time and an immutable revision number.

### 4.2 Leave approval lifecycle

The brainstorm describes student → warden/authorized approver → final approval → guard verification, but does not establish actual institutional actors or whether one or two approvals are required. For the prototype, use the following **configurable demonstration sequence**:

1. `draft` (local editable state) → `submitted` (student confirms).
2. `submitted` → `underReview` via explicit simulated approver action.
3. `underReview` → either `changesRequested`, `rejected`, or `approvedInDemo` via explicit simulated action; decision reason required on reject and changes request.
4. `changesRequested` → `resubmitted` when student edits and confirms a new revision; from there → `underReview`.
5. `approvedInDemo` → optional `gateDepartureLoggedInDemo` → optional `gateReturnLoggedInDemo` through **separate** simulator actions, only when the relevant demo policy enables gate verification.
6. Allowed `submitted` / `changesRequested` requests may be `withdrawn` by student; rejected/withdrawn requests remain history.

Never treat gate verification as a step automatically triggered by approval. If another approver stage is later validated, model a separately configurable approval-stage sequence; do not invent warden names or official sign-off authority now.

**Status wording:** `Submitted to demo`, `Under review (simulated)`, `Changes requested (simulated)`, `Approved in demo — NOT A VALID GATE PASS`, `Rejected in demo`, `Withdrawn`, `Departure logged in demo`, `Return logged in demo`.

**Student actions:** Create, review, view timeline, edit requested changes, resubmit, withdraw if eligible, view history; export a *clearly watermarked sample summary* if the PDF feature is approved later. No real leave authorization, no production QR pass, and no forged signatures.

**Simulator actions:** Start review, request changes with reason, approve/reject with reason (as applicable), log departure/return where allowed. Privileged actions require explicit opt-in through Settings → Demo Operations and are labelled simulated.

### 4.3 Leave failure rules

- Duplicate submit click generates one request.
- Invalid interval blocked; zero-duration and return-before-departure rejected.
- Review of stale revision cannot approve a newer revision (version check).
- Request changes must specify reason; resubmission preserves prior comments and original submission.
- Rejected and withdrawn requests cannot move to gate event states.
- Approved-in-demo request with altered departure details must go through a controlled revision/approval flow; don't silently preserve an outdated approval.
- If a request references a calendar class that is later rescheduled, original submitted snapshot stays auditable; current schedule may be shown separately.
- If no authorized approver information exists, display demo role labels, not real person names.

## 5. F12 — Campus Complaint Tracker

### 5.1 Complaint intake

Provide an approachable `Report a facility issue` flow with category (plumbing, electricity, Wi-Fi, cleaning, washroom, other), location/room if available, problem description, optional safe sample image attachment descriptor, student-selected severity **as reported**, then confirmation.

Issue ID and timestamp displayed immediately. A student-submitted complaint becomes `submitted`; it does not mean maintenance has accepted the issue or will meet a specific response time.

**Priority:** Do not assign an official priority or SLA based solely on self-report. Display `Student reported: urgent` separately from `Demo assigned priority: high/normal` where simulated. Include a notice that CampusOS is not for emergencies or immediate hazard escalation. Avoid creating a false emergency routing mechanism.

### 5.2 Shared ticket lifecycle

Proposed canonical ticket states for both F12 and F14:

`submitted` → `assigned` → `inProgress` → `resolvedInDemo` → `closedInDemo`

Alternate states/transitions:

- `assigned | inProgress` → `awaitingParts` → `inProgress`
- `submitted | assigned | inProgress | awaitingParts` → `cancelledByReporter` only where permitted by a configured demo policy (default: permitted before work starts)
- `resolvedInDemo` → `reopened` via student report that issue persists → `assigned | inProgress`
- `resolvedInDemo` → `closedInDemo` via explicit student acknowledgement or demo-operator close policy; no silent auto-close unless a clearly configured demo rule is subsequently approved

Display: `Submitted`, `Assigned (simulated)`, `In progress (simulated)`, `Awaiting parts (simulated)`, `Marked resolved (simulated)`, `Reopened`, `Closed (demo)`, `Cancelled`.

Every privileged transition includes role, time and event ID. Reject impossible transitions (`submitted → closed` without a controlled action, `rejected leave → resolved ticket`, etc.). Duplicate status transition must not create multiple notifications.

### 5.3 Complaint details and operational transparency

- Timeline showing `reported`, `assigned`, `work started`, `parts pending`, `resolution claimed`, `student response`, `reopened` events.
- Optional demo assignment category/team, not invented real technician name.
- No promised ETA unless source-backed; optional demonstration target visibly labelled `Demo target`, not institution SLA.
- Student sees their own tickets only. Sensitive descriptions and uploaded media are private, not broadcast in public facility lists.
- Ticket history may detect repeated issues by normalized category and location **only within permitted demo records**. Do not expose reporter identity or claim institution-wide trends.
- Reopening creates a new status event under the same ticket ID, with reason, not a duplicate ticket silently severing history.

## 6. F14 — Teaching-Aid Maintenance

Teaching-aid reporting is a **specialized intake path** to the **same complaint ticket engine**.

### 6.1 Student/faculty-facing specialized form

- Select classroom from supplied/reference rooms, or label as student-entered/demo; no fake campus room directory.
- Equipment type: projector, microphone, AC, smartboard, `other`.
- Issue description and optionally a safe illustrative photo attachment descriptor.
- Optional immediate classroom impact field (e.g. class delayed) is a reporter assertion, **not automatically observed minutes lost**.
- Submit generates an ordinary ticket with kind `teachingAid` and same `TicketDetails` lifecycle, plus `TeachingAidMeta`.

### 6.2 Teaching-specific detail screen

**Assets summary:** reported classroom, equipment, observed issue, source of asset data if any, previous related issue count if demonstrated. **Status timeline:** submit, simulated assignment, simulated repair, student/faculty confirmation/reopen.

Past faults can be grouped by equipment/location to illustrate recurring operational disruptions, but don't claim an actual asset maintenance history without validated records. If a resource is formally closed, integrate with the existing shared `ResourceClosure` contract rather than independently changing facility booking capacity.

### 6.3 Operations relevance

Track reported class-start delay **only if supported by observations**. A student's anecdotal estimate can be labelled `self-reported`. Maintenance response time and repair duration can be calculated from recorded simulator timestamps but are *demo timing*, not empirical institution performance.

## 7. Shared request hub, notifications and cross-module integrations

### 7.1 My Requests aggregation

Show each student's leave requests, complaints and teaching-aid tickets in one **My Requests** list. Use type icon, clear status, requested date, last updated, and a source/data-mode label. Sorting by newest updated by default; filtering by type, status, category and date. Keep terminal/historical requests accessible.

**Home → My Activity:** show active requests with link to the correct canonical detail. Approved demo leave must still show the `DEMO ONLY` caveat in all summary contexts.

**Calendar:** show a personally created planned absence if the student explicitly chooses to add a personal calendar block; don't automatically treat leave submission as approved absence or change class attendance. For approved-in-demo leave, show optional private reference, still labelled demo. An academic class keeps its original timetable; a request to miss it does not cancel class.

**Course Hub:** optionally link teaching-aid reports to a selected course/classroom when a source-backed relation exists; do not invent associations.

**Notifications:** create user-targeted in-app notifications for transitions only, deduplicated by `(entityId, transitionEventId, recipientProfileId)`, with deep link and accurate actor/source labels. Not delivered as email/SMS/push in initial prototype.

### 7.2 Notification event list

| Source event | Recipient | Wording principle |
|---|---|---|
| Leave submitted | Student | `Demo request saved` |
| Leave review started | Student | `Demo review started` |
| Changes requested | Student | `Changes requested (simulated)` + provided reason |
| Leave approved/rejected | Student | `Decision recorded in demo; not an official permission` |
| Gate demo event | Student | `Simulated gate status updated` |
| Complaint submitted | Student | `Ticket recorded in CampusOS demo` |
| Complaint assigned/started | Student | `Assignment/progress simulated` |
| Complaint awaiting parts | Student | `Demo ticket awaiting parts` |
| Complaint resolved | Student | `Issue marked resolved in demo; confirm or reopen` |
| Ticket reopened | Student | `Issue reopened` |
| Teaching aid status | Reporter | Same ticket events, specific asset/classroom label if provided |

Notification preference settings should use existing shared service. Essential request-status information remains visible inside request details even if notifications are muted. Avoid duplicate notifications on re-render or browser refresh.

### 7.3 Demo Operations: local only

Under existing Settings → Demo Operations, enable a simulated request console only with explicit local opt-in. A simulator can show role tabs `Demo Approver`, `Demo Maintenance`, `Demo Gate` and advance permitted transitions. This is **not** a real staff dashboard, login, authorization service or live integration. Every simulated update has a visible `simulated` actor label and audit event. When real backend is added in final phase, swap repository adapter and permissions implementation, not domain state rules.

## 8. UX system: accessibility, responsive behavior, trust

- Main student hub should answer *What did I submit? Who has the next action in the simulation? Has anything changed?* without requiring users to read raw audit logs.
- Consistent cards, statuses, button placement, error text, and timelines across request families; distinct primary form fields per type.
- Provide large labeled tap targets, visible keyboard focus, semantic form labels, errors connected to fields, meaningful status text + icon, no color-only meaning; responsive mobile full-screen forms and drawers.
- Validation errors never discard the user's draft. After successful submission, show new ID, timestamp, status and canonical detail link.
- Don't display unnecessarily intrusive health details in lists, notifications, previews or exports; reasons may be summarized as `Private reason` depending on the view.
- Demo operations actions should be separated visually from student actions and visibly identified, with accessible confirmation for irreversible transitions.
- Maintain empty/loading (only for async), stale, error and partial-data states. A loading spinner must not imply a server request when using synchronous local fixtures.
- Error on stale status version must show `This request changed; refresh details` rather than overwriting unseen changes.

## 9. Time Tax / Business Operations metrics

The purpose is to model **avoidable physical visits, repeated approval follow-ups, and classroom disruption response delay**, not to claim that digitization shortens actual institutional approval time.

| Metric | Baseline observation needed | Prototype output |
|---|---|---|
| Leave process trips | Visits to office/approvers/guard, waiting per visit | Simulated trips potentially avoided; not verified actual savings |
| Leave processing time | Submission to official decision in baseline | Can show demo status duration; cannot claim institutional speed-up |
| Complaints follow-up effort | Trips/calls required to check status and time spent | Illustrative effort reduced by transparent ticket tracking |
| Maintenance repair time | Real reported-to-repaired timestamps | Demo duration if local simulation; field measurements only if observed |
| Teaching disruption | Minutes of lecture affected due to equipment fault | Observed or self-reported impact labelled by evidence |

**Time-saving calculation** (model only): `potential_minutes_avoided = max(0, baseline_followup_minutes - scenario_followup_minutes)`. Do not add overlapping components twice, and do not automatically convert reduced uncertainty to measured minutes saved. Show sources, sample size, assumptions and clear `Illustrative scenario` labels. `Time Tax` should aggregate only compatible measures and keep service-specific methodologies visible.

## 10. Failure, privacy and integrity cases

1. Leave out/return times invalid → block save, preserve form content.
2. Two leave submissions from double click → one canonical request.
3. Privileged leave approval attempted by student → rejected by domain authorization guard.
4. Approval of stale leave revision → blocked; require review of current revision.
5. Missing real approval actor → role remains `Demo Approver`; no invented warden.
6. Gate verification without demo approval → blocked.
7. Withdrawn/rejected leave cannot be represented as approved or gate-cleared.
8. Real sensitive attachment provided → warn against demo storage; safe descriptor strategy.
9. Complaint with no supplied location directory → allow user-entered location clearly marked as self-reported.
10. Invalid/unsupported image → reject with accessible feedback.
11. Complaint resolved then reported still broken → reopen same ticket, preserve history.
12. Two complaints about same classroom equipment → do not silently merge; optional similar-issue suggestion only.
13. Ticket status transitions without actor role → blocked.
14. Ticket assignment target unknown → display `Team not assigned` rather than invent role.
15. No SLA data → no `Overdue according to university policy` claim.
16. Missing/closed browser → in-app notifications on reopen, no fake background delivery.
17. Demo reset → clear only authorized demo/profile state with warning; no hidden deletion of source fixtures.
18. Cross-profile request access → denied or not found, including deep links and selectors.
19. A class time changes after leave form submission → preserve request snapshot and show new calendar context separately.
20. Local storage corrupt or unavailable → safe recovery/error; never show a fake successful submission.
21. Same transition replayed → no duplicate event or notification.
22. Import has ambiguous official policy or department → flag missing, don't infer from institution branding.
23. Teaching issue later triggers room closure → update through shared closure model only.
24. Real emergency request raised in UI → direct users to established campus/emergency channels only if those contacts have been supplied; otherwise state `This demo cannot contact emergency help`.
25. File upload preview fails → retain draft, don't lose text fields.

## 11. Implementation plan (after approval; no backend now)

- **AD-0 — Audit and reuse:** Inspect current routing, Home activity, notifications, Calendar selectors, shared request/ticket components, repo adapters and Settings-gated simulators. Register `COS-ADMIN-001` as `specified/proposed`; record all open policy defaults. No code until implementation phase explicitly approved.
- **AD-1 — Domain and test foundation:** Typed variants for leave and work tickets; transition guards; revision and audit model; stable ID/idempotent submit; profile scope; seeded demo fixtures and repository adapter. Test states and invalid actions first.
- **AD-2 — Complaint + teaching-aid vertical slice:** Student forms, ticket list/details, timeline, reopen; classroom-specific form; one shared complaint engine. Browser/keyboard/mobile tests.
- **AD-3 — Leave vertical slice:** Student request form, revision workflow, demo review/approval and optional separate gate simulation. No official authorization artifacts. Tests.
- **AD-4 — Cross-module:** Home My Activity, Notifications with de-duplication, optional Calendar context, Settings-gated simulator and Time Tax scenario integration. Preserve other modules.
- **AD-5 — QA and sign-off:** Test provenance, privacy, edge cases, responsive states, accessibility, persisted refresh, reset and demo walkthrough. Log evidence and stop at phase gate. Cross-client/backend final phase only.

**Dependency strategy:** Do not build a universal enterprise workflow designer. Implement only typed primitives needed by these three modules. Reuse existing request/ticket infrastructure if already present. No packages or routes added without inspecting the repository.

## 12. Acceptance tests (`AD-AT-*`) — executable requirements, not claims of tests run

| Test | Required outcome |
|---|---|
| AD-AT-01 | Hub routes to Leave, Complaints and Teaching Aids; back navigation works |
| AD-AT-02 | All Administration screens clearly identify demo/non-official status |
| AD-AT-03 | Valid leave request creates one persisted request with stable ID |
| AD-AT-04 | Repeated leave submit click does not create duplicate requests |
| AD-AT-05 | Invalid leave interval blocks submission and preserves draft |
| AD-AT-06 | Student cannot simulate institutional approval without enabling Demo Operations |
| AD-AT-07 | Explicit demo start-review transition updates timeline and current status once |
| AD-AT-08 | Rejected leave records reason and cannot proceed to gate events |
| AD-AT-09 | Changes requested displays reason, allows revision and preserves history |
| AD-AT-10 | Stale revision approval is rejected; newest revision remains authoritative |
| AD-AT-11 | Approved-in-demo label always says not a valid campus permission |
| AD-AT-12 | Demo gate departure is separate from approval and requires eligible state |
| AD-AT-13 | Demo gate return cannot occur before eligible departure |
| AD-AT-14 | Withdrawal is limited to allowed leave states and updates history |
| AD-AT-15 | Real medical proof is not inserted into public fixtures or uncontrolled demo storage |
| AD-AT-16 | Valid complaint creates one persisted ticket ID and initial status |
| AD-AT-17 | Complaint form supports required categories and optional reported location |
| AD-AT-18 | Complaint cannot claim official SLA when none exists |
| AD-AT-19 | Simulated assignment, start, awaiting-parts and resolution transitions are guarded |
| AD-AT-20 | Student can reopen a simulated resolved complaint on same ticket ID |
| AD-AT-21 | Reopen preserves old audit events, notes and resolution attempt |
| AD-AT-22 | Student cannot mark their own ticket fixed by impersonating demo maintenance |
| AD-AT-23 | Teaching-aid form requires asset type and classroom reference |
| AD-AT-24 | Teaching-aid submission stores `teachingAid` ticket in shared ticket repository |
| AD-AT-25 | Classroom equipment issue supports resolve and reopen just like other tickets |
| AD-AT-26 | Duplicate suspected issue is not automatically merged with another ticket |
| AD-AT-27 | Request list shows only the active demo profile's records |
| AD-AT-28 | Cross-profile deep-linked request cannot expose protected details |
| AD-AT-29 | My Requests filters alter views without deleting records |
| AD-AT-30 | Home My Activity shows correct recent request and links to canonical detail |
| AD-AT-31 | Transition notification generated once and opens exact request |
| AD-AT-32 | Refresh reconstructs request status and audit trail from local storage |
| AD-AT-33 | Demo reset is separate from view reset and requires explicit confirmation |
| AD-AT-34 | Calendar classes are not cancelled because student submitted leave |
| AD-AT-35 | Time Tax calculations label scenario versus observed data correctly |
| AD-AT-36 | No real email, push, gate or staff action is claimed by prototype |
| AD-AT-37 | Keyboard-only user can submit a complaint and inspect timeline |
| AD-AT-38 | At narrow mobile width, forms and status timeline remain operable |
| AD-AT-39 | Accessible labels and status announcements do not rely on color alone |
| AD-AT-40 | Validation, corrupted storage and absent optional data fail safely without fake success |

**Sign-off gate:** Implementer reports evidence for each test, commands actually run, screenshots/browser inspection where relevant, manual access limitations and any failing/partial tests. No assertion of completion solely because this document exists.

## 13. Product decisions and open inputs

### Confirmed from user/team conversation

- Scope includes F03 leave/out-time, F12 facility complaints and F14 teaching-aid reporting.
- Student request submission, clear status/history and demo-friendly functionality are part of the project vision.
- CampusOS is a working academic prototype, not an already connected institutional system.
- Shared live-update backend and real multi-client demonstrations are deferred to the final phase.
- Develop related modules in batches to accelerate project specification.

### Proposed and configurable defaults, not campus policies

- One student leave form with `personal | medical | event | emergency | other` classification.
- One local demo approver stage; optional separate demo gate actions; richer multistage authorization only if real policy supplied.
- Student may withdraw submitted leave before simulated approval; requests for changes generate a new revision.
- General ticket state progression and reopening behavior defined above.
- Demo-priority and demo response-target fields optional and source labelled; no default official SLA.
- Safe sample-attachment descriptors rather than actual sensitive attachments.
- Local Settings-gated Demo Operations console, no staff credentials, with typed domain permission guards.

### Missing real-world inputs; do not invent

- University's actual leave form, procedural steps, authority chain, gate-pass requirements and allowed out-time categories.
- Whether attaching medical proof is required and data retention rules.
- Campus department/staff directory and complaint SLAs/priority rules.
- Classroom identifiers, asset inventory and supported facility issue categories.
- Verified in-app notification channels, institution permission for production deployment.
- Empirical waiting times, office trips and classroom disruption time for Time Tax.

These inputs are **not blockers for a clearly labelled demo**. Any feature claiming official authorization or institutional action remains off until confirmed.

## 14. Claude Code integration instructions

1. Save this file as `docs/features/CampusOS_Administration_Spec_v1.0.md`.
2. Register `COS-ADMIN-001` in `docs/FEATURE_REGISTRY.md`, noting original IDs F03, F12, F14, status `specified/proposed`, existing dependencies and non-goals.
3. Add decisions to `docs/DECISIONS.md` marked `proposed`, not silently user-confirmed.
4. Audit existing Home, Calendar and ticket/request data structures; reuse canonical models, avoid duplicate route aliases and independent ticket engines.
5. **Do not implement immediately unless the user specifically authorizes this module's phase.** Provide a short AD-0 through AD-5 plan and stop at the approval gate.
6. Do not implement backend, external staff authentication, push notifications or real campus approval/gate enforcement. Defer those to final phase.
7. On approval, implement incremental vertical slices and provide real test evidence. Avoid altering prior feature specs to accommodate guessed requirements.
