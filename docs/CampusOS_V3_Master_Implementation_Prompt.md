# CampusOS V3 — Master Implementation Prompt

**Calendar-first expansion, academic tools, reliable bookings and a more expressive design system**  
**Prepared:** 2 November 2026 · **Campus timezone:** Asia/Kolkata  
**Purpose:** Copy-ready implementation instructions for Claude Code working inside the existing CampusOS repository. This document specifies work; it does not claim the website has already been modified or tested.

---

## 0. Start here: the actual assignment

You are extending the existing CampusOS academic prototype for an Introduction to Business Operations project about the campus “Time Tax.” Implement the requirements below in the current application. Preserve working functionality, accepted product decisions, existing routes, user-entered data and all 26 original modules. Do not rebuild a second app, replace the product with the screenshot reference portal, or migrate frameworks for appearance alone.

The objective is a connected student experience: **understand my day → find a feasible group time → agree on it → reserve an appropriate resource → track changes**, alongside useful academic planning and campus services. The interface should feel polished, responsive and lively while remaining honest about data and authority.

### Mandatory priority order

| Priority | Source | Implementation outcome |
|---|---|---|
| P1 | Uploaded `collaborative_campus_calendar.md`, called the interactive calendar file in the request | Integrated availability matching, top-three suggestions, room selection, invitations, RSVP, changes and cancellation |
| P2 | User’s Google Docs points, reproduced and mapped in §4 | All explicit requested additions, including collaborative polls and academic calculators |
| P3 | User’s five text points from the preceding message, mapped in §5 | Calendar exam shortcuts, classrooms, expiring check-ins, video evidence and per-slot equipment counts |
| P4 | Both batches of reference screenshots | Selected enhancements within existing modules; never override P1–P3 or hard constraints |

Dependencies may be implemented first, but do not spend a workstream on decorative effects or a resource vault while the collaborative calendar remains incomplete. Apply shared design tokens from the beginning; reserve elaborate visual refinements for after the required journeys work.

### Source precedence and compatibility

1. The user’s latest explicit instructions govern this expansion, including **no campus map** and the priority order above.
2. Previously approved hard constraints continue unless explicitly changed. This request does not authorize a premature shared backend or genuine university integrations.
3. The existing `CampusOS_FINAL_V2_Master_Product_Implementation_Spec.md` remains the detailed baseline for the original scope. This V3 document overrides its rollout order for the new work and refines the affected experiences; it does not delete the baseline.
4. The uploaded collaborative calendar document supplies the P1 concept. Its later Google/Outlook integrations must respect the existing backend-last constraint.
5. Screenshots are visual and interaction references, not verified campus data, official rules or exact designs to copy.

Read the relevant existing project instructions and feature specifications once. Inspect the current affected code enough to make safe changes, then implement. Do not launch another prolonged read-only audit, create approval gates for routine choices, or ask the user to repeat decisions already present here. If a real input is missing, use a transparent configurable demo fixture and continue independent work.

---

## 1. Hard constraints that survive this expansion

| Constraint | Required implementation behavior |
|---|---|
| Existing application | Extend it incrementally; preserve routes or redirects, user data and working journeys. One codebase and existing deployment path. |
| All original features | Retain F01–F26 and the classroom extension. New features supplement, rather than replace, them. |
| Local prototype first | Use profile-scoped persistent demo state and the existing service/store abstraction. Shared backend, real multi-device operator actions and real external calendar/mail synchronization remain in the final connected phase. |
| Honest collaboration | Demo profiles can demonstrate invitations, voting and RSVP within the local simulator. Do not imply teammates on separate devices share these mutations without a backend. A deployed static preview shares code, not automatically user data. |
| No campus map | Do not add a map tab, 2D/3D campus map, floor-plan visualization, drone tour or map dependency. Put room search inside Bookings. Use textual building/floor/location information. |
| Exact known classroom names | Preserve **CR Conference Hall, CR1, CR3 and G12**. Their names are known; actual capacity, hours, equipment and booking authority still require supplied data. |
| CR terminology | In “add CRs in booking tab,” implement the named classroom resources. Also preserve the existing class-representative/coordinator role. Do not confuse the room prefix with a person’s role. |
| Provenance | Operational facts carry `OFFICIAL_VERIFIED`, `SOURCE_IMPORTED_UNVERIFIED`, `USER_REPORTED`, `DEMO_SIMULATED` or `UNKNOWN`, plus relevant freshness/source information. |
| No invented live facts | Never fabricate occupancy, faculty presence, room capacity, official grades, attendance policy, prices, exam seating, service ETA, approvals or delivered notifications. |
| Booking versus occupancy | A confirmed reservation is not proof of physical presence; an expired check-in is not proof a room is empty. |
| Canonical state | Calendar, Home, My Bookings, My Activity, Notifications and Campus AI read the same owning records. Do not maintain independently editable copies of a booking or exam seat. |
| Chill Spot | Preserve **order ahead, pay at pickup**, acceptance/rejection, recorded walk-in/digital backlog and distinct collected/paid states. No online payment flow. |
| Laundry | Preserve the student-registered + simulated-provider hybrid, with self-service machines as their own workflow. |
| Institutional actions | Demo leave approval is not real gate authorization; a personal task checked off is not an official assignment submission; opening a fee form is not payment. |
| Email and exam seating | Keep the functional simulated inbox and exact-profile seat extraction. Real OAuth/provider ingestion stays in the secured final phase. No mailbox passwords or frontend secrets. |
| Privacy | Scope marks, attendance, leave, personal calendars, email, exam seats and attachments to their authorized audience. Use fictional fixtures rather than reference students’ identities. |
| Rules and hours | Do not invent a campus closing time or post-8 p.m. booking ban. Use configured, source-qualified policy. Demo defaults are not college rules. |
| Time Tax | Separate measured, self-reported and modeled results. Do not turn a booking, click or animation into claimed minutes saved. |
| Verification | Keep tests targeted and meaningful; preserve existing passing checks. No hundreds of repetitive tests, repeated audit cycles or unsupported “all passed” claims. |

Preserve the distinction between **designed**, **implemented**, **verified** and **connected** in the final implementation report.

---

## 2. Product structure: enrich existing destinations

Retain the existing information architecture and route names where possible.

| Destination | V3 additions or refinements |
|---|---|
| Home | Today/Tomorrow switch; next-action cards; upcoming meeting/poll; active booking; compact attendance/academic summaries; source-aware meal card |
| Calendar | Day/Week/Month/Agenda; layer filters; Find a time; shared availability; polls; exam schedule and My Seating shortcuts; free-gap suggestions |
| Bookings | Classrooms and room search; capacity; resource units; reliable My Bookings history; check-in expiry; equipment faults; direct meeting-room booking |
| Academics | Past/current grades, SGPA/CGPA calculator, target planner, attendance planner, richer course materials and faculty information |
| Administration | Complete demo leave, complaint and teaching-aid journeys with persistent statuses and evidence |
| Community | Club/committee polls and meetings, Lost & Found refinements, optional peer study/project pods |
| Inbox | Invitations, poll updates, confirmations, cancellations, booking changes, exam corrections and existing campus mail |
| Time Tax | Coordination measurements and room-search outcomes alongside existing queue evidence and scenario models |
| Global utilities | Campus AI panel, app error reporting, search, theme and motion preferences |

Do not add a top-level destination for every small feature. Desktop navigation should remain legible; mobile should expose roughly four or five primary destinations with an accessible More menu, rather than the reference’s long row of tiny icons.

---

## 3. P1 — The collaborative interactive calendar

### 3.1 The defining workflow

**Find a time + agree with the group + find a room + confirm** must be one continuous flow, with saved draft inputs when moving between steps.

1. Organizer selects **Find a time** from Calendar, a course project, a club, a committee or a peer pod.
2. Enter title, purpose, duration, date range, required/optional participants and optional room needs.
3. Resolve fictional/demo members by name, roll number or student ID. Show section/course context to disambiguate duplicate names.
4. Calculate common availability using the selected profiles’ known timetables and recorded commitments.
5. Show the best three eligible options, or fewer if only fewer exist. Explain why each is recommended.
6. Organizer can select a time directly or start a poll over candidate times.
7. For the chosen interval, list suitable rooms with availability, capacity, facilities and booking restrictions.
8. Show one review screen with time, participants, responses, room, agenda, document links and data limitations.
9. Confirm using one coordinated state transition. The meeting, resource reservation and relevant projections remain consistent.
10. Invitees can RSVP; organizer can revise or cancel with linked room and notification updates.

### 3.2 Calendar interface

- Default to Week on desktop if that is the existing accepted behavior. Offer Day, Month and Agenda without losing filters or selected date.
- Mobile defaults to a readable agenda/day experience with a compact week/date strip; do not shrink a desktop week grid into unreadable columns.
- Top controls: Today, previous/next, date range, view switch, Add, **Find a time**, **Exam Schedule**, **My Seating**.
- Layers: classes, exams, assignments/project deadlines, personal events, group meetings, club/committee events, bookings, mess schedule, birthdays and relevant services.
- Preserve all-day dates separately from timed events. Assignment deadlines and meal information do not automatically mean the student is busy for the whole day or meal window.
- Timed event details show source, attendees, location, status, notes, relevant actions and last revision.
- A current-time line, next-event countdown and “free until” label may use the actual clock or a clearly identified demo clock. The underlying schedule must support the statement.
- Allow appropriate personal event editing and rescheduling; source-owned classes/exams are read-only unless the actor has authority. Offer a keyboard/form alternative to drag-and-drop.
- A side panel on desktop and bottom sheet on mobile shows event details and meeting creation without losing calendar context.

### 3.3 Availability engine: concrete rules

Use the existing date library and calendar components where practical. Implement deterministic scheduling logic separately from rendering.

**Inputs:** participant IDs, required/optional flags, date range, duration, allowed meeting hours, busy intervals, recurring sessions and exceptions, preferences, buffers, room requirements and source coverage.

1. Expand recurring classes only over the requested bounded date range; apply cancellations and moved-session exceptions.
2. Normalize timed intervals to instants, preserving the source timezone. Render in Asia/Kolkata by default.
3. Merge overlapping busy intervals for each participant. A conflict exists when `a.start < b.end && b.start < a.end`; adjacent slots are allowed unless buffers require separation.
4. Subtract busy intervals from permitted meeting windows; intersect free intervals for all required participants.
5. Generate candidate starts at a configurable increment, default **15 minutes for the demo**, and require enough continuous time for the full duration and applicable buffers.
6. Treat known classes, exams and confirmed commitments as hard blockers. Distinguish accepted, tentative and declined invitations; pending polls do not silently reserve every candidate time.
7. Missing calendar coverage means **unknown availability**, not automatically free. Such candidates may be shown separately as “Needs availability confirmation.”
8. Rank eligible candidates using explicit criteria. A suggested demo score is optional-attendee fit 40%, preference fit 25%, fewer idle gaps 20%, suitable-room match 15%. State these are implementation defaults, not validated optimization weights.
9. Use earliest start and a stable ID as tie-breakers. Show understandable reason chips instead of a mysterious percentage.
10. Return at most three distinct suggestions. Never fabricate three results when only one exists.

If no common time exists, show the constraining commitments in privacy-safe terms and offer a wider date range, shorter duration, different preferences or a poll. Do not silently remove a required participant or schedule over an exam to produce an answer.

**Travel-aware ranking:** use supplied building adjacency or a labeled demo travel-time matrix. Unknown travel time stays unknown. No map is required or permitted. Optional buffers should be transparent and must not imply actual walking times were measured.

### 3.4 Privacy and availability coverage

Group views show busy/free/unknown by default, not the title of a private appointment. The organizer sees enough to plan, without access to another student’s grades, leave reason or private notes. Personal busy blocks may remain private while contributing to scheduling.

Show “Based on recorded schedules” and meaningful coverage indicators. A participant without entered commitments must not be described as definitely available. External account connection controls must say disconnected or deferred until a genuine connector exists; never show a fake successful Google/Outlook connection.

### 3.5 Room matching inside the same flow

- Query the exact selected start/end, group size, required amenities and permitted resource type.
- List **CR Conference Hall, CR1, CR3, G12** in the classroom inventory, and other existing eligible study spaces without duplicating them.
- Card fields: room name, textual building/floor/location, capacity and source, amenities and source, selected-time reservation state, availability coverage, booking mode and next eligible interval.
- Unknown capacity cannot satisfy a strict capacity requirement as if verified. Put it in a separate “Capacity unverified” group if useful.
- Existing classes, approved room allocations, maintenance, reservations and configured access hours all participate in conflict detection. Only correctly room-mapped classes block that room.
- Approval-required resources create a **pending request**. Do not label the room or meeting “fully confirmed” before approval.
- Optional short holds must have expiry and not persist forever if the user abandons the dialog. Clearly distinguish a hold from a reservation.
- Revalidate schedule and room availability at confirmation. Local demo operations must be serialized against the current store revision; do not claim this solves separate-device races.
- In the final shared phase, enforce overlap protection and state changes atomically on the server/database.

### 3.6 Invitations, RSVP and lifecycle

Suggested meeting states: `DRAFT → PROPOSED/POLLING → PENDING_ROOM_APPROVAL or CONFIRMED → COMPLETED/CANCELLED`. RSVP remains separate: `INVITED`, `ACCEPTED`, `TENTATIVE`, `DECLINED`.

- A confirmed organizer time does not mean everyone accepted the invitation.
- Invitation/event projections refer to the same canonical meeting ID.
- Rescheduling checks participants and the new room again. If it fails, retain the previous valid booking; do not cancel the old room before securing the replacement.
- Successful changes increment the meeting revision, update the reservation and send one relevant local notification per recipient. Material time changes mark prior RSVPs as requiring reconfirmation.
- Cancellation cancels the linked reservation and retains history. It removes the active busy blocker while preserving a canceled record in activity/history.
- Prevent duplicate submissions with stable operation IDs. Use expected revisions to detect edits based on stale data.
- A meeting may be canceled without deleting unrelated personal tasks or source course events.

### 3.7 Free-gap finder

Show genuinely usable gaps after known commitments and configured buffers. For a 90-minute gap, offer an appropriately shorter study session, group meeting or eligible room. Explain the source coverage. Do not label an unrecorded afternoon as a guaranteed six-hour free period.

### 3.8 P1 demonstration

Provide deterministic fictional profiles with overlapping timetables. Demonstrate: create a 45-minute group request → inspect three suggestions → choose/poll → reserve CR1 → see the same meeting on Calendar, Home and My Bookings → switch demo profile to RSVP → introduce a conflict → reschedule safely → cancel and release the recorded reservation. Also provide no-common-slot and unknown-availability cases.

---

## 4. P2 — Every Google Docs requirement

### 4.1 Traceability checklist

| ID | User requirement | Build contract |
|---|---|---|
| G01 | CGPA calculator: current grades + target GPA | §4.2, credit-weighted simulation and target planning |
| G02 | No campus map; room search under Bookings | §1, §3.5 and §5.2 |
| G03 | Add CRs in booking tab | Exact four classroom resources; preserve coordinator permissions |
| G04 | Collaborative calendar suggesting feasible meeting times | Complete P1 workflow, not a second calendar |
| G05 | Collaborative fixed-time poll per subject/section, including clubs and committees | §4.3; scoped polls with conflict revalidation |
| G06 | Booked badminton + canceled study room visible in Bookings | §4.4; actual stored demo records and lifecycle views |
| G07 | Demo leave, complaint, teaching-aid issue + request/complaint status | §4.5; persistent end-to-end demo workflows |
| G08 | Bunk advisor? | §4.6; optional attendance planning tool with transparent assumptions |
| G09 | Past + current semester grades | §4.2; semester history, partial current results and projections |
| G10 | Capacity in each facility | §4.7; correct units, unknown handling and provenance |
| G11 | CAMPUS AI | §4.8; grounded assistant with truthful local fallback |
| G12 | Report errors in app | §4.9; persistent report workflow |

### 4.2 Academic history, SGPA/CGPA and target planner

Place these in Academics, with a small optional Home summary. Use three linked views: **Grades**, **Calculator**, **Target Goal**.

**Grades:** semester selector, course code/name, credit weight, actual grade where supplied, source, pending status and semester totals. Show past semesters and the current semester. Separate finalized earned credits from current enrolled credits. A pending grade is not a zero, and a hypothetical grade never overwrites a recorded grade.

**Calculator:** edit current course credits and simulated grades using a configured grade-point scale; live results show previous CGPA/credits, projected SGPA, projected cumulative CGPA and change. Include reset simulation and optional quick presets. Use a small, legible SGPA/CGPA trajectory chart with a text/table alternative; clearly distinguish projected segments.

For an ordinary credit-weighted scheme:

```text
SGPA = sum(courseCredits × gradePoints) / sum(includedCourseCredits)
Projected CGPA = (priorCGPA × priorIncludedCredits + currentQualityPoints)
                 / (priorIncludedCredits + currentIncludedCredits)
Required current SGPA =
  (targetCGPA × (priorIncludedCredits + plannedCurrentCredits)
   − priorCGPA × priorIncludedCredits) / plannedCurrentCredits
```

Prefer exact historical quality points if available; calculations from a rounded prior CGPA are estimates. Do not average semester GPAs equally when credit totals differ. Define treatment of failures, repeats, withdrawals, pass/fail and excluded courses through configuration; do not import another university’s rules from the screenshots. If policy is missing, show the demo scale and scope prominently.

**Target Goal:** editable target cumulative GPA, planned credits, required SGPA and feasibility. Above maximum grade points → “Not achievable within these credits”; at/below minimum → explain the numeric result rather than promising graduation or eligibility. A “grade mix” must actually satisfy the credit-weighted target; otherwise show only the required SGPA. Optional example mixes are illustrative, not guarantees under relative grading.

Reference arithmetic fixture: prior CGPA 6.84 across 41 credits and a simulated SGPA 8.00 across 27 credits gives projected CGPA **7.300588…**, displayed 7.30. A target of 7.20 requires SGPA **7.746666…**, displayed about 7.75. This is a fictional calculation fixture, not the user’s academic record.

Validate empty/zero credits, negative values, invalid grade points, partially graded semesters and edits to previous credits. Preserve full precision internally. Never silently combine different grading scales.

### 4.3 Collaborative subject/section and club/committee polls

This extends P1, using its availability engine and canonical meeting records.

**Scope:** a course + section, a project group, a club or a committee. Add explicit organizer permissions and an eligible member list; a poll for Section A must not include Section B’s private data or votes by default.

**Flow:** create draft → select candidate slots → inspect conflicts → open voting → collect `Yes / If needed / No` responses → close/finalize → revalidate → book room → publish the selected meeting. Pending/non-voters remain distinct from No.

- One editable ballot per eligible participant per poll, with a submission timestamp. The demo role switcher may simulate different voters; it must not pretend to be real multi-user voting.
- Show eligible membership, response count, required-participant availability and hard conflicts. Voting preference cannot override an exam or resource booking conflict.
- Default selection: feasible slots first; then most Yes responses; then most If needed; then earliest start. Explain ties. Organizer finalizes rather than an opaque automatic action.
- If no feasible winner exists, suggest new candidates or reopen the poll. If availability changed since voting, invalidate the recommendation and explain why.
- A fixed subject/section meeting can become a recurring series. Validate each occurrence for the chosen bounded term; flag exceptions instead of assuming a weekly slot is always free.
- Clubs and committees use the same engine. Their meetings count in the student’s availability to prevent cross-group clashes.
- Confirming a poll winner creates one meeting, not a second copy of every proposed candidate. Closed poll history remains visible.
- Default individual ballots to an appropriate restricted audience; public aggregates do not reveal private event names.

### 4.4 My Bookings must reflect actual actions

Provide Upcoming, Active, Pending and History views, plus filters for resource and status. Include persistent demo examples of a **confirmed badminton court booking** and a **canceled study-room booking**. Label both as demo and use real records, not decorative text.

Each card has resource/unit, date/time, duration, capacity context, participants if relevant, status, reference and permitted actions. Canceled entries retain cancellation time/reason and a **Book again** action that rechecks availability. They do not occupy a slot or appear as an active appointment. A successful reservation updates this screen immediately and survives refresh.

### 4.5 Administrative demo journeys

Seed one leave request, one general complaint and one teaching-aid issue at different meaningful stages. Also allow a student to create new ones.

| Journey | Student fields | Demo lifecycle and outcome |
|---|---|---|
| Leave/out-time | Dates/times, reason, appropriate optional evidence | Draft → Submitted → Under review → Approved/Rejected; withdrawal when allowed; gate verification separate |
| Complaint | Category, location if relevant, description, optional photo/video | Submitted → Assigned → In progress → Resolved → Closed; allow reopen with reason |
| Teaching-aid fault | Room, device type/unit, description, optional photo/video | Reported → Triaged → In progress → Resolved; link affected equipment/resource status only when authorized |

Show request IDs, submitted/updated timestamps, status history, next step and any demo response. Updates from the isolated demo operations panel must reach the student’s request detail, My Activity and Notifications. Ordinary student controls must not silently approve their own leave or impersonate maintenance staff.

### 4.6 Attendance planner — optional “Bunk Advisor” label

Because the user marked this with a question mark, include the capability as **Attendance Planner** with an optional friendly subtitle, rather than making skipping class a prominent product promise.

For attended sessions `A`, held sessions `T`, target fraction `p`, and equal session weighting:

```text
Current attendance = 100 × A / T
If next k sessions are missed = 100 × A / (T + k)
If next k sessions are attended = 100 × (A + k) / (T + k)
Consecutive attended sessions needed = max(0, ceil((pT − A)/(1 − p)))
Missable future sessions = floor(A/p − T), only when currently meeting target
```

Use exact counts, not rounded displayed percentages, for comparisons. Validate `0 ≤ A ≤ T`, integer counts and `0 < p ≤ 1`. With `T=0`, show no recorded sessions. With `p=1`, recovering from prior absences by attending a finite number of future sessions is impossible; handle separately. If below target, show “Below target” and recovery requirements, not a misleading negative allowance.

Allow course-specific thresholds and separate lecture/tutorial/lab requirements if supplied. Do not use the screenshot’s 75% or 80% as an official campus rule. Scenarios cannot exceed the known remaining sessions without warning. Approved leave counts only according to the supplied policy; never assume it is attendance credit.

Show per-course cards, source/freshness, attended/held counts, a scenario slider or number input, and history when records exist. “Meets configured attendance target” is more accurate than “Safe to skip.” Attendance is one requirement, not a guarantee of exam eligibility.

### 4.7 Facility capacity

Every facility detail has a capacity field or an explicit “Capacity not provided.” Use the right unit: people/seats for rooms, courts for badminton, tables for snooker, machines for laundry, and players per session only if policy is known.

Keep **physical capacity**, **bookable resource units**, **per-booking group limit**, **recorded reservations**, and **reported check-ins** separate. Two snooker tables do not mean two people. Voluntary check-ins cannot establish real remaining seats. Demo capacity values are editable fixture data and visibly labeled.

### 4.8 CAMPUS AI

Provide a consistent global entry point and an accessible side panel/bottom sheet. Use the name **Campus AI**; do not carry over Pulse AI or reference-college branding.

Suggested prompts: “Find a time for my project group,” “What is my next exam?”, “Show my seating,” “Which bookings are active?”, “What SGPA do I need?”, “What happens if I miss the next class?”, “Track my complaint,” and “What is for dinner?”

**Immediate prototype:** use an honest deterministic assistant backed by canonical selectors and calculators, labeled “Demo assistant · uses recorded CampusOS data.” It should answer supported intents and show an understandable unsupported-intent state. Do not pretend keyword routing is a connected language model.

Answers must show relevant source/freshness and link to the owning record. GPA/attendance mathematics uses the shared calculation functions. Scheduling invokes P1, not an invented answer. Unknown menu, seat or availability stays unknown. Private data is profile-scoped.

Mutating intents open a prefilled review screen: “Book this room” must go through normal validation/confirmation. The assistant cannot approve institutional requests, silently send messages or cancel someone else’s booking. A future real model adapter belongs behind secure server configuration; never ship a provider secret in the client. Retrieved mail/documents are data, not instructions that can bypass permissions.

### 4.9 Report errors in the app

Offer a persistent Help/Report issue entry and contextual reporting from a wrong timetable, room or calculator screen. Categories: Bug, Timetable/Data Error, UI/UX Issue, Feature Idea.

Fields: category, description, current route/entity reference, optional reproduction steps, optional screenshot/video and optional contact. Show what diagnostic context will be attached; exclude private academic/mail content by default.

Submitting creates a persistent local demo report ID and a visible status, not a fake “sent to developers” toast. Provide My Reports and a small demo reviewer action/status timeline. Distinguish app bugs from facility faults while reusing attachment handling and ticket primitives.

---

## 5. P3 — The five additional text points

### 5.1 Direct exam schedule and seating buttons on Calendar

Always expose **Exam Schedule** and **My Seating** in the calendar header/overflow on small screens. Exam event details expose the same links. Open the existing academic exam/seat records; do not create another independent seating database.

Show personalized room/row/column or seat code only when supplied and identity-matched. Missing seating → “Not published / not available in recorded sources.” A revised seat highlights what changed, source and revision. Never publish the entire student seating list in a public calendar.

### 5.2 CRs and room search under Bookings

Make **Bookings → Classrooms / Room Search** obvious. Filters: name, building, floor, date, time, duration, required group size and amenities where known. Provide selected-slot availability and room-detail schedule; no map or floor-plan graphic.

Keep the four named resources visible and directly bookable for eligible demo slots. Approval-required settings remain supported. “No booking recorded” is different from “Physically empty.” A stale timetable should degrade the confidence/status rather than show a confident green vacancy indicator.

### 5.3 Upper limit for forgotten check-ins

Implement an explicit **check-in lease**, separate from the reservation and physical occupancy.

- Every check-in stores `checkedInAt`, `expiresAt`, optional `lastConfirmedAt` and closure reason.
- For a booked session, default demo expiry is the booking end; any grace period is configurable and marked as a demo policy.
- For an allowed unbooked session, use a configurable maximum duration; suggested demo default **60 minutes**, clearly not an institutional rule.
- Warn before expiry when the app is active. “Still here” may renew only within permitted policy and without conflicting with the next reservation.
- On expiry, close the stale digital check-in with `AUTO_EXPIRED`. Do not claim the person physically left. Show “Check-in expired; physical use unconfirmed” where operationally relevant.
- Reconcile on startup, refresh, tab resume and every relevant booking query, not just a fragile browser timer. Reconciliation must be idempotent.
- A shortened booking/cancellation reconciles its linked check-in without erasing history. An auto-expired session is not silently revived after reload.
- Actual server expiry and shared-client authority are final-phase work. In the local prototype, reconcile when the app runs and describe the boundary honestly.

Booking allocation is released according to reservation policy; a stale check-in must not block the schedule indefinitely. Conversely, released recorded availability must not be presented as confirmed physical vacancy.

### 5.4 Video upload for Report a Fault

Add photo **and video** evidence to every applicable facility/equipment fault entry point, including teaching aids, sports equipment and machine faults. Reuse this component for app error reporting where useful.

Support selection, visible limits, file validation, progress/state, preview, removal, retry and an error message. Suggested demo limits: up to three attachments, 25 MB per video, MP4/WebM; treat these as configurable defaults. Avoid promising transcoding or universal playback support. Validate MIME/type and actual file handling rather than trusting only filename extension.

Do not store video as base64 in localStorage. Use browser blob storage such as IndexedDB if consistent with the existing architecture; persist attachment metadata and handle quota errors. State “Saved on this device” for local evidence. Object URLs are temporary and must be recreated after reload and revoked when no longer needed. A metadata-only upload stub is not a completed video attachment feature.

In the final shared phase, use access-controlled storage, server validation and appropriate retention. Never make fault evidence public automatically or imply a local file reached maintenance staff.

### 5.5 Multiple equipment units per time slot

The user reports **two snooker tables**. Model two distinguishable units under one facility, such as Table 1 and Table 2. This supplied count does not establish live availability or official slot rules.

- For each selected interval show counts such as **1 of 2 tables reservable in demo schedule**, with source/state qualifications.
- Show Available/Reserved/Maintenance/Unknown for each unit. Reserve a specific unit, or allocate one eligible unit explicitly when the student chooses “Any.”
- Unit-specific overlapping reservations conflict; simultaneous bookings of different units may succeed.
- Maintenance blocks only affected units. It changes usable inventory, not the original physical inventory count.
- Canceling Table 1 releases Table 1’s reservation only. Do not change Table 2.
- Preserve player/group limits as a separate value from unit count.
- Apply the same pattern to existing multi-unit sports, courts and machines where appropriate; do not invent additional inventories.

---

## 6. P4 — Screenshot-inspired enhancements, adapted deliberately

Both screenshot batches have useful patterns. Borrow hierarchy, compact summaries, contextual sheets, segmented controls, filters and clear histories. Do not copy reference names, college identifiers, grades, student photos, faculty ratings, counts or claims of live data.

| Observed reference pattern | CampusOS adaptation | Decision |
|---|---|---|
| Tomorrow’s schedule and chronological class cards | Today/Tomorrow Home switch; lecture/tutorial badges; room/faculty links; lunch marker from sourced menu hours | Include after P1–P3 |
| Attendance ring and subject bars | Compact academic summary with counts, target and text alternatives; weighted total from counts, not average percentages | Include |
| Bunk advisor impact rows | Attendance Planner scenario comparisons with exact arithmetic and configured policy | Covered in P2 |
| Expanded class history with list/calendar/graph controls | Course attendance history with available views only when meaningful data exists | Include compactly |
| Semester cards, GPA trajectory and grade chips | Academic history plus projected-versus-recorded differentiation | Covered in P2 |
| Exam cards with room and seat | Existing personalized exam records and direct calendar shortcuts | Covered in P3 |
| Subject folders and materials categories | Course → semester/subject → Lectures, Tutorials, PYQs, Books or supplied categories; counts computed from actual resources | Include |
| Exam vault search/filter/cards | PYQ type/course/semester/year filters, preview/download/bookmark only for supplied or demo files | Include |
| Empty-room search and room-detail sheet | Bookings room finder with textual location, capacity, schedule and availability coverage | Include; no map |
| Club cards with category chips | Searchable clubs/committees, membership context and “Find a meeting time” | Include |
| Lost & Found cards, My Hub, possible matches | Existing Lost & Found with saved filters, personal reports, claim flow and explainable possible matches | Include modestly |
| Faculty directory and custom-time availability filter | Search, supplied office hours/timetable, contact, appointment request, date/time filters | Include; no invented physical presence |
| Faculty rating/experience blocks | Show only if real approved data and appropriate feature policy exist | Do not fabricate or add a rating system |
| Peer Pods and resource contributions | Small optional study/project groups using the same calendar, members and approved resource links | Optional P4 stretch |
| AI prompt suggestions and report-error dialog | Campus AI and persistent bug/data reports | Covered in P2 |
| Dark calendar, month/agenda tabs, upcoming banner | Theme-aware calendar, multi-day spans and next relevant event | Include without copying black/yellow styling wholesale |
| 2D/3D maps, floor plans and virtual tour | None | Explicitly excluded |
| Placements and cutoff navigation icons | No sufficient requested workflow | Do not expand scope from icons alone |

### Resource hub details

Use the existing Course Hub as the owning module. Search by title/course code; filter by semester, type and subject; show actual file counts, provenance and last update. Missing files get an honest empty state. A bookmark should persist. Preview/download must work for real attached demo assets, or be disabled with a clear explanation rather than a fake success action.

Use a folder-stack illustration sparingly as a course header, not as the main navigation mechanism. Never make users decipher decorative stacked cards to find lecture notes. Peer contributions are labeled peer-provided, not faculty-verified without evidence.

### Faculty and community details

“No class recorded at this time” does not mean “Available in cabin.” Distinguish teaching schedule, published office hours, appointment availability and reported presence. Use initials or authorized assets for fictional demo profiles. Do not copy real people’s images/contact information from the reference screenshots.

Optional pods can have a purpose, members, capacity, next session, resources and a Calendar action. Do not build an entirely new chat platform, pretend to create a Discord server or silently send WhatsApp invitations.

---

## 7. Design philosophy — calm structure, lively response

This is an Apple-inspired interpretation of hierarchy, restraint, spatial clarity and responsive interaction, combined with CampusOS’s existing warm professional/student identity. It is not a claim to reproduce Apple’s design system or a request to copy branding.

### 7.1 Visual foundation

- Retain the accepted cream/off-white, forest/teal and warm coral direction. Use lavender/sky/mint accents selectively for academic and calendar categories.
- Establish reusable tokens rather than random module palettes. Suggested light tokens: canvas `#F7F8F6`, surface `#FFFFFF`, primary text `#17231F`, secondary text `#56635D`, action `#176B58`, warm accent `#C85E49`. Validate contrast in final combinations rather than assuming every tint is accessible.
- Dark mode uses layered charcoal with softened borders and restrained brighter accents; not pure black plus neon everywhere. Respect system preference and remember a manual override.
- Use a system font stack or existing licensed font. No need to download proprietary Apple fonts. Strong headings, readable body text, tabular numerals for times/counts, minimal all-caps microtext.
- Use an 8-point spacing rhythm, comfortable card padding, approximately 16–24 px card radii and compact controls with consistently sized icons. Dense data may use tighter spacing, but not tiny text.
- Glass/translucency is reserved for navigation, overlays and selected floating controls. Keep data panels opaque enough for contrast. Do not blur the whole application.
- Larger screens should use useful two-column layouts instead of a narrow phone-width column surrounded by empty space. Keep line lengths readable and use detail panels intentionally.

### 7.2 Five signature interactions

1. **Adaptive Today card:** smoothly changes from next class to upcoming meeting/booking based on actual recorded state. Keep critical information stable while the user is interacting.
2. **Find a time overlay:** participant avatars/initials, privacy-safe availability bands and three ranked options; selecting one opens matching rooms in the same flow.
3. **Responsive resource card:** subtle hover elevation and cursor-position highlight on pointer-capable devices; capacity and time status remain immediately readable.
4. **Stateful My Activity:** a confirmed booking becomes an active session, then a completed/history record based on real demo transitions; a canceled item visibly retains its status.
5. **What changed sheet:** compare the previous and current meeting time, exam seat or request status, with source and timestamp.

### 7.3 Cursor tracking and motion specification

- Add a faint radial highlight that follows the cursor within selected hero/resource cards; implement through CSS variables and a throttled/requestAnimationFrame update.
- Optional card lift around 2 px and very small tilt, capped around 1–2 degrees, only on non-critical decorative surfaces.
- Keep pointer effects on fine-pointer/hover devices; disable on touch and with reduced-motion preferences. Never replace the native cursor or add trails.
- Use roughly 160–240 ms for small control transitions and 240–320 ms for sheets, with subtle spring behavior if the existing library supports it. Critical notices and status changes need no dramatic animation.
- Avoid scroll hijacking, endless pulsing, marquee notices, moving form controls, particle fields, exaggerated parallax and animated numbers that conceal exact values.
- Prefer opacity/transform; avoid continuous layout recalculation or a new animation framework solely for this request.
- Focus/keyboard states must convey equivalent information. Hover never reveals the only available action.

### 7.4 What “live” should mean here

Use responsive data-derived elements: current-time line, booking countdown, expiring hold, updated poll response count, local request progression, immediate calculator output, theme adaptation and changing available-unit count after a real demo reservation.

Do not use random changing occupancy, fake online avatars, fabricated incoming messages or meaningless live badges. Where updates are simulated, place the simulator label and source chip where the user sees the resulting state. Decorative motion is not evidence of connectivity.

### 7.5 Accessibility and responsive quality

Keyboard-operable dialogs, visible focus, proper labels, Escape/back behavior, focus restoration, adequate target sizes and textual status indicators are required. Charts and heatmaps need equivalent accessible values. Reduced motion must preserve the full workflow. Calendar drag interactions need ordinary form controls as an alternative.

At mobile widths, long titles wrap or disclose full text, sheets fit the viewport, the keyboard does not hide Submit, and sticky navigation does not cover content. Use readable empty, loading, error, stale, unavailable and successful states. Do not display synthetic loading delays to look sophisticated.

---

## 8. Shared engineering contracts

### 8.1 Extend canonical entities

Adapt names to the repository; do not create parallel stores for the same concepts.

| Entity | Key additions |
|---|---|
| CalendarEvent / Meeting | Owner, audience, required/optional participants, source references, privacy, recurrence/exceptions, revision, status, linked reservation |
| AvailabilityBlock | Owner, interval, busy/tentative state, visibility, source coverage |
| MeetingPoll / PollVote | Scope, candidates, eligible voters, ballot, deadline, selection rule, finalized meeting ID |
| Resource / ResourceUnit | Type, unit IDs, capacity/value/unit/source, amenities, hours, bookable mode, maintenance |
| Reservation | Resource/unit, interval, meeting ID, owner, approval state, revision, cancellation history |
| CheckInSession | Reservation link, checked-in time, expiry, closure reason, reconciliation history |
| AcademicTerm / CourseResult | Course credits, scale, actual grade, source, pending/final state, included-quality-point policy |
| AcademicScenario | Hypothetical grades/credits and target, separate from real records |
| AttendanceRecord / Scenario | Counts or individual sessions, category, threshold source, optional future session count |
| ServiceTicket / AppIssue | Category, owner, entity/route, state/history, evidence references |
| EvidenceAttachment | Filename, type, size, storage reference, local/upload state, authorized audience |
| AssistantAnswer | Supported intent, linked source IDs, provenance, computed result, proposed action |

### 8.2 Projection and transaction rules

- One source mutation updates dependent selectors; rendering must not create notifications or duplicate events.
- Confirmation, cancellation, rescheduling and expiry use explicit commands with validation and revision checks.
- Persist demo state with a schema version and safe migration. Preserve existing records; reset only on an explicit scoped reset action.
- Use an injectable clock for reproducible expiry/countdown demos and tests. Label demo-clock mode; normal mode uses current local display time derived from valid timestamps.
- Calendar export, if supported, is a deliberate export/download action. It is not ongoing two-way sync and must not expose private metadata unnecessarily.
- Keep connected adapters optional and disabled until configured. Do not block the prototype on missing institution credentials.

### 8.3 Error handling

Failures must leave recoverable state: a full room does not erase the meeting draft; an attachment failure does not erase the complaint description; a failed reschedule does not lose the old reservation; a corrupt optional preference does not reset all student data. Display actionable error text and preserve relevant inputs.

---

## 9. Implementation order and bounded milestones

| Milestone | Work | Completion evidence |
|---|---|---|
| M0 — Foundation | Inspect relevant current code once; preserve baseline; extend shared entities and design tokens | Existing app still runs; no destructive replacement |
| M1 — Calendar core | Views, privacy-aware busy intervals, top-three suggestions, room matching, meeting lifecycle and invitations | Complete P1 journey with reload and conflict handling |
| M2 — Google Docs scope | Polls, grades/calculators, attendance planner, capacities, booking history, admin demos, Campus AI, issue reporting | G01–G12 mapped to working routes/actions |
| M3 — Five text points | Verify exam shortcuts/CRs; expiry reconciliation; working video evidence; snooker unit scheduling | Each T1–T5 demonstrated; shared code reused |
| M4 — Reference refinement | Resource hub, faculty/club improvements, Home timeline and restrained interactions | Selected P4 additions improve existing journeys; no map |
| M5 — Integration and verification | Cross-module consistency, responsive/accessibility checks, targeted regressions and demo script | Compact report of actual results and remaining dependencies |
| Final connected phase | Only when the project reaches its already agreed integration milestone: shared backend, roles, authoritative booking constraints, genuine calendar/mail connectors and delivery | Real configured evidence; never claimed complete by this local expansion |

M1 may implement a P2/P3 dependency such as classroom matching or poll primitives early. That does not change the overall priority. Do not defer required functionality merely because it appears in two source lists; implement it once and satisfy both.

---

## 10. Focused verification and acceptance

Reuse existing tests. Add only high-value checks for new logic; do not mirror every visual component with a new test suite. Group related cases where practical.

1. **Calendar intersection:** required attendees, recurrence exceptions, adjacent intervals, no-common-slot and unknown coverage behave correctly; top-three returns real candidates only.
2. **Meeting + room consistency:** confirmation, failed/successful rescheduling and cancellation leave correct linked records; stale confirmation cannot double-book a unit in the local store.
3. **Poll integrity:** eligible voters only, one current ballot per person, non-voters distinguished, ties explained, conflicts rechecked and one winner event created.
4. **Booking history/units:** booked badminton and canceled study room persist; two distinct snooker units can be reserved simultaneously; a third overlapping allocation fails; maintenance/cancellation affect only the intended unit.
5. **Expiry:** stale check-ins expire after app resume/reload, do not repeatedly notify and never assert physical vacancy.
6. **Academic arithmetic:** unequal-credit weighting, target above scale, missing grades/zero credits and screenshot-style fixture calculations work; hypothetical results never overwrite actual records.
7. **Attendance arithmetic:** exact target boundary, below-target recovery, no records, category-specific counts and 100% target edge are handled.
8. **Evidence/report workflow:** valid video persists and previews after reload where supported; invalid/oversize/quota errors are clear; no fake remote submission.
9. **Identity/provenance:** profile switching cannot expose another user’s private grades, personal event names or seating; simulation never displays as official/live.
10. **Regression smoke:** original flagship café/laundry/mail-seat flows and key routes still work; no-map rule holds; mobile/keyboard navigation completes the new main journey.

Run the repository’s relevant type/build checks and targeted tests, then one integrated manual pass. Broaden testing only for unresolved failures or meaningful changes. Report actual executed checks and any untested limitations; do not claim real backend race safety from local tests.

### Visual review points

Inspect approximately 1440 px desktop and 390 px mobile: Home, calendar suggestions, poll, room sheet, My Bookings, calculators, ticket evidence and Campus AI. Check long names, empty states, dark mode, reduced motion, keyboard focus and no sticky-control overlap. Fix substantive usability defects before adding visual flourishes.

### Definition of complete for this expansion

- P1 is a working connected local-demo workflow, not unrelated calendar and booking screens.
- All twelve Google Docs requirements and all five text points are accounted for, including explicit exclusions.
- P4 additions are bounded and functional; optional stretch work is identified honestly.
- Refresh preserves meaningful outcomes and projections agree.
- No original feature is silently removed or replaced.
- All source/authority/connectedness claims match reality.
- The code is ready for the existing preview/deployment process; no unrequested new parallel project is created.

---

## 11. Time Tax evidence and presentation value

Connect the new features to operations outcomes without making unsupported numerical claims.

| Intervention | Operational mechanism | Suitable evidence |
|---|---|---|
| Availability suggestions + polls | Fewer coordination messages and rejected meeting times | Timed comparable scheduling tasks; participant count, task and method recorded |
| Room search + linked booking | Fewer room-search trips and scheduling conflicts | Search duration, failed attempts, recorded conflicts and observed visits |
| Check-in expiry | Removes stale digital presence records | Count/age of stale records; actual occupancy still separately observed |
| Per-unit resource booking | Makes usable capacity visible and allocates units without overlap | Unit utilization, maintenance exclusions and no-show records |
| Request status and evidence | Reduces repeated follow-ups and clarifying messages | Status enquiries, resolution duration and follow-up counts |
| Academic tools | Reduces manual calculation/information-search effort | Comparable task completion times and error rates |

Measure task completion time directly during usability trials if possible. Store method, sample size, date, participant/task conditions and source. An app event log alone cannot establish the counterfactual time saved. A demonstration comparison is not a campus-wide result. Keep this aligned with the existing Time Tax dashboard and separate presentation deliverable.

---

## 12. Baseline preservation register — all 26 original features

This register prevents scope loss; the original V2 master remains the detailed contract for these behaviors.

| ID | Preserve | V3 relationship |
|---|---|---|
| F01 | Chill Spot order ahead, acceptance, queue context, pay at pickup | Shared design and activity; no payment change |
| F02 | Unified academic calendar and tasks | Main P1 expansion |
| F03 | Leave/out-time requests and separate gate verification | Complete demo request/status path |
| F04 | Gym booking, equipment and source-qualified use reports | Capacity, expiry and faults |
| F05 | SS laundry hybrid and self-service machines | Unit/evidence primitives without changing operating model |
| F06 | Badminton slots and booking lifecycle | Required booked example in My Bookings |
| F07 | Other sports: TT, pool, basketball | Two snooker units and per-slot inventory where applicable |
| F08 | Library study spaces, catalogue/loans | Study-room canceled example; scheduling reuse |
| F09 | Mess check-in/out and qualified crowd signals | Expiry logic where relevant; no fake occupancy |
| F10 | Mess menu and updates | Home and Campus AI read same menu |
| F11 | Mess fee/form reminders | Preserve external action/payment distinctions |
| F12 | Complaint tracker | Status demo and video evidence |
| F13 | Parcel/courier alerts and collection | Preserve targeted privacy and activity |
| F14 | Teaching-aid maintenance | Required issue demo and video evidence |
| F15 | Course Hub, assignments/projects/materials | Academic tools, vault refinements and course polls |
| F16 | Lost & Found and claims | Screenshot-inspired gallery refinements |
| F17 | Faculty information and appointment requests | Filtered schedule view without false presence claims |
| F18 | Best Time to Go | Preserve source-qualified demand guidance |
| F19 | Music room bookings | Reuse resource/expiry rules |
| F20 | Clubs/committees, recruitment and meetups | Polls and collaborative scheduling |
| F21 | Faculty mentorship and project groups | Reuse scheduling and invitation state |
| F22 | Chill Zone/midnight birthday spots | Preserve cross-midnight scheduling and demo authority |
| F23 | BMS Office appointment requests | Preserve request versus acceptance |
| F24 | Sports teams, fixtures and sign-ups | Calendar participation and notifications |
| F25 | Notifications, preferences and Campus Mail | Meeting/poll/request updates plus original mail demo |
| F26 | Individual exam seating and corrections | Calendar shortcuts and Campus AI source links |

Also retain the four named classrooms, CR/SR notices, Home personalization, personal activities/birthdays, printing/shuttle/Wi-Fi Time Tax categories and the final connected-phase boundary.

---

## 13. Copy-ready execution directive

> Read `CampusOS_V3_Master_Implementation_Prompt.md` and the existing `CampusOS_FINAL_V2_Master_Product_Implementation_Spec.md` in this repository. Implement this V3 expansion inside the current CampusOS application while preserving all original 26 modules, accepted decisions, working data and routes.
>
> Follow this order: **(1) collaborative calendar and integrated time + room workflow, (2) all Google Docs requirements, (3) the five additional text requirements, (4) selected screenshot-inspired refinements.** Apply the shared design foundation throughout, but finish core flows before elaborate effects.
>
> Preserve the hard constraints: **no campus map; room search under Bookings; CR Conference Hall/CR1/CR3/G12; local persistent demo first; real shared backend and external synchronization only in the final connected phase; pay at pickup for Chill Spot; existing laundry hybrid; honest provenance; private profile-scoped academic/email/seat data; one canonical record per fact.** Do not fake live data or real institutional actions.
>
> Make the UI calmer, more expressive and responsive using the design contract in §7: strong hierarchy, warm surfaces, careful depth, light/dark adaptation, purposeful transitions and restrained cursor highlights. Keep keyboard, touch and reduced-motion support. Build real stateful interactions, not clickable placeholder cards.
>
> Inspect affected code once and proceed in bounded milestones. Reuse existing components, state and stack. Do not restart brainstorming, request routine per-feature approvals, create another parallel app or spend most of the task generating audits/tests. Use clear configurable demo defaults when real campus inputs are missing and record those dependencies briefly.
>
> Verify the highest-value invariants and one integrated desktop/mobile pass. At the end, report implemented journeys, tests actually run, any genuine blockers/deferred connected dependencies, and the existing preview/run instructions. Do not claim this specification itself proves implementation or verification.

---

## 14. Source notes for this handoff

- User-supplied `collaborative_campus_calendar.md`: the full availability → room → invitation workflow, privacy/source caveats, later integration phases and efficiency metrics.
- User’s Google Docs text: twelve explicit requirements mapped G01–G12.
- User’s earlier five-point text: exam/calendar shortcuts, classrooms, maximum check-in duration, video fault evidence and two snooker tables.
- Both batches of portal screenshots: academic summaries, materials/PYQ organization, room sheets, clubs, faculty filters, AI/report dialogs, calendar styling and peer pods. Screenshot data is not imported as campus truth.
- Existing `CampusOS_FINAL_V2_Master_Product_Implementation_Spec.md`, version 2.1 consolidated: preserved 26-feature baseline, classroom names, hard constraints, provenance, local/connected boundary and compact verification posture.
- Earlier Chill Spot addendum: retained pay-at-pickup and operational distinctions; older audit-and-wait wording is superseded by the consolidated master’s implement-without-repeated-gates instruction.

**Document boundary:** This is the requested new master Markdown prompt. It does not modify the existing master file, deploy the website, send invitations or connect accounts.
