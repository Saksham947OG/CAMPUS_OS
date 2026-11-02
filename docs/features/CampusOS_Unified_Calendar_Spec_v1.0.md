# CampusOS — Unified Calendar + Integrated Task Panel

**Specification ID:** `COS-CAL-001`  
**Version:** `1.0.0` — Round 2 baseline design freeze  
**Date:** 2026-11-01  
**Product:** CampusOS — Business Operations / Time Tax academic prototype  
**Status:** **Ready for engineering decomposition, subject to source-data mapping; not implemented or tested.**  
**Related contracts:** `CampusOS_Home_Dashboard_Spec_v1.0.md` (`COS-HOME-001`), `CampusOS_Information_Architecture_v1.md`, original group brainstorming (`ibo grp 5 (1).md`).

> **Authority and traceability:** User-approved decisions are distinguished from implementation defaults proposed in this document. Do not infer user approval for an unsourced faculty timetable, room number, deadline, birthday, mess menu, or institutional permission. Unknown data remains unknown. The Calendar design may be frozen while campus-specific data remains pending. The optional demonstration backend is explicitly deferred to the final project phase.

## 0. Decision register

| ID | Decision | Status | Binding rule |
|---|---|---|---|
| C-D01 | Smart Layered Calendar with customizable defaults | **User confirmed** | Academic and personal layers are prominent, context layers configurable. |
| C-D02 | Mess information contextual by default + optional dining-time overlay | **User confirmed** | Do not automatically fill week grid with four daily meal blocks. |
| C-D03 | Integrated Calendar + Task Panel, rather than separate planner | **User confirmed** | Details / Tasks / Day Context live in the Calendar's contextual panel. |
| C-D04 | Hybrid professional-and-student aesthetics | **User confirmed** | Reuse global design tokens; avoid disconnected calendar design. |
| C-D05 | Highly personalized Home, including Agenda/Week, Free Pockets, tasks | **Previously confirmed** | Calendar supplies canonical data/view models to Home. |
| C-D06 | Live-update demonstration backend at final development phase | **User confirmed** | No backend prerequisite for first Calendar implementation. |
| C-D07 | Four views: Month, Week, Day, Agenda | **Implementation baseline** | All views use the same canonical records and filters. |
| C-D08 | Main Calendar initially opens Week; its preference persists | **Implementation baseline** | Independent of the Home Agenda/Week preference. |
| C-D09 | Five broad layers plus subcategory and course filters | **Implementation baseline** | Presets change visibility only. |
| C-D10 | Distinct commitments, deadlines, tasks, and contextual records | **Implementation baseline** | Never turn date-only deadlines into timed commitments. |
| C-D11 | Desktop left filters + center calendar + right contextual panel | **Implementation baseline** | Collapsible; responsive bottom sheets on mobile. |
| C-D12 | Timed overlap warnings, no automatic rescheduling | **Implementation baseline** | Booking-module capacity rules may independently block reservations. |
| C-D13 | Bounded recurring schedules and per-occurrence exceptions | **Implementation baseline** | Do not edit entire series when a single class changes. |
| C-D14 | In-app reminders, with no claim of delivery when app closed | **Implementation baseline** | Browser push, email, SMS, WhatsApp are NOT in MVP. |
| C-D15 | Dates, privacy, authenticity and provenance | **Implementation baseline** | Asia/Kolkata, explicit source and visibility, profile isolation. |

Any change to an implementation baseline requires an explicit decision-log entry, updated examples, and updated tests. User-approved choices should not be silently reversed.

## 1. Purpose and scope

**Goal:** Give a demo student a coherent place to see schedule commitments; track source-provided academic dates; discover consented birthdays and campus activity; view contextual meal information; manage personal events and tasks; and use known free calendar gaps to plan study time.

**In scope:** Month/Week/Day/Agenda; four object types; layers and saved presets; academic timetable import and recurrence exceptions; birthdays; contextual mess panel and optional dining overlay; assignment details and personal checklists; task/time-block creation; deterministic conflict flags; local in-app reminders; integration with Home and Bookings via shared records; repeatable demo reset.

**Out of scope in initial build:** Official Google Calendar/LMS/ERP two-way sync; actual institutional edits by students; verified assignment submission; guaranteed background notifications; automatic booking/leave approvals; live attendance or occupancy; algorithmic optimization of a student's entire day; automated AI scheduling; institutional payment processing. Future demo backend is separate.

**Users:** Demo student (creates own records), presentation evaluator (may switch demo profiles), future demo operator (not implemented in this phase). No separate faculty/admin portal required for the calendar prototype.

## 2. Information architecture and routes

**Primary route:** `/calendar` with four selectable views `month`, `week`, `day`, `agenda`. State may be serialized via URLs, e.g. `?view=week&date=2026-11-09`; route format is a proposal, not a requirement to adopt a specific routing library.

**Navigation:** Header contains previous interval, Today, next interval, visible date range, view selector, search, Layers/Filters, and `+ Add`. Desktop: 220–260 px filter rail (collapsible), flexible calendar stage, 320–380 px right inspector (collapsible). Mobile: compact toolbar, day strip/list, layers drawer, event detail bottom/fullscreen sheet, task panel as tab/sheet. Keep primary actions keyboard-accessible and avoid horizontal page overflow at 320 px.

**Right panel tab model:**

| Tab | Default content | Actions |
|---|---|---|
| **Details** | Selected event/task/deadline, provenance, status, linked course/location | Contextual actions based on ownership and record type. |
| **Tasks** | To-do, in progress, personally complete; assignment-linked checklists; unscheduled tasks | Add/edit/delete personal tasks, set progress, schedule focus block. |
| **Day Context** | Selected date: meal menu, dining hours, birthdays with permission, important notices | Open Mess/Event modules; enable dining overlay. |

**Selection behavior:** Selecting an event focuses Details. Selecting an empty date updates Day Context without inventing an event. Tasks tab retains its own filter and scroll position while panel remains open. If no event is selected, Details shows an intentional empty state and clear Add action. On mobile, a deep link to an event opens the appropriate sheet.

## 3. View contracts

### 3.1 Month

- Monday–Sunday weeks, 6-row grid when necessary; previous/next-month dates may be muted but navigable.
- Short event chips for space; at most 2 visible chips per day plus `+N more` at narrow widths (configurable based on accessible layout, never drop records). At wider widths, additional chips may be shown.
- Timed events show concise times when space allows; date-only deadlines use deadline icon without invented time; birthdays use subtle icon/dot.
- `+N more` opens selected day's full list in Details/Day Context, including filtered counts in a way that does not imply hidden events don't exist.
- Dense days may show a factual deadline count, not a fabricated stress or productivity score.

### 3.2 Week (Calendar default)

- Seven-day header and scrollable local-time hourly grid. Use actual event start/end for vertical position/height; overlapping commitments render alongside each other.
- A **deadline/all-day lane** above the hourly grid contains date-only deadlines, birthdays, holidays, and other applicable all-day records. These do not occupy timed free/busy space.
- Cancelled occurrences remain identifiable in details/history but may be subdued in grid; no ghost duplicate from the recurrence rule.
- An optional dining overlay adds visually subdued bands to known breakfast/lunch/snack/dinner service windows; these do **not** count as busy student commitments or booking conflicts.
- Configurable visible hour range; default derived from `08:00–22:00` Home preference, not campus opening-hours evidence. Users can scroll outside default visible range.

### 3.3 Day

- Timed timeline with all-day/deadline lane, visible current-time marker when applicable, and right-side selected-day context.
- Display event type, known location, and source label; unprovided fields read `Not provided`, not fabricated values.
- Selecting open space may prefill a personal-event draft's **date and start time only**, leaving end time unconfirmed and required for a timed event.
- Optional suggested gaps listed in Tasks/Day Context; no automatic booking or saving.

### 3.4 Agenda

- Group by calendar date; dates sorted chronologically; within each date, all-day/date-only lane then timed events sorted by start time. Show date-only deadlines with no fictitious hour.
- Filters and search affect the same records as other views. Long result lists paginate/virtualize as needed without changing semantic order.
- Date headers and accessible type labels; show an explicit empty/filter state when no records match.

### 3.5 Navigation across views

- Switching views preserves anchor/selected date, active filters, and selected event if visible.
- `Today` navigates to current Asia/Kolkata date using the actual app clock. No hardcoded demo date unless a specifically labelled **demo date override** is active.
- Previous/Next advances one month/week/day as appropriate; Agenda advances a defined 7-day browsing window by baseline.
- Home deep links to `/calendar` carry event/occurrence ID and date; if filters hide it, explain that and offer `Show this event` (temporary reveal, no permanent filter mutation without confirmation).

## 4. Canonical domain model

The following is a **logical schema**, not a requirement to choose a particular database. All records require stable identifiers and `source` / `dataMode` metadata.

### 4.1 Source and metadata

- `sourceKind`: `provided` (user-supplied academic/menu files), `demoSeed` (explicit illustrative seed), `userCreated` (per-profile actions), `connected` (reserved; not active).
- `sourceLabel`: human-readable file name/provider/user attribution; `sourceRecordId` when available.
- `authority`: `authorizedInstitutional`, `unverifiedProvided`, `personal`, `demoIllustration`. Do **not** infer `authorizedInstitutional` simply because a PDF looks official.
- `confirmationStatus`: `confirmed`, `tentative`, `cancelled`, `rescheduled`, `unknown`; status is about record confirmation, **not** identity/official authorization.
- `dataMode`: `provided`, `simulated`, `personal`. Unknown/stale operational updates must identify their origin and last verified/edited time.
- `profileId` and `visibility`: `private`, `selectedAudience`, `campusPublic` according to authorization; student-specific record queries are profile-scoped.

### 4.2 Record kinds

| Kind | Mandatory fields | Optional fields | Ownership |
|---|---|---|---|
| `ScheduledEvent` | id, title, local date, type, source, time model | start/end time, timezone, location, instructor, courseId, recurrenceSeriesId | source system or student for personal events |
| `Deadline` | id, title, `dueDate`, source, status | `dueTime`, courseId, assignment details, linked task IDs | academic dataset or user for personal deadlines |
| `PersonalTask` | id, ownerProfileId, title, state, source | dueDate/time, relatedDeadlineId, subtasks, priority, description | student profile |
| `FocusBlock` | id, ownerProfileId, startAt, endAt, title | taskId, description, reminder rules | student profile |
| `BirthdayReminder` | id, displayName, month/day, visibility/permission, source | anniversary year stored only if legitimately needed, reminder rules | student or explicitly authorized shared dataset |
| `DiningSchedule` | id, service day/weekly rule, meal category, source | start/end, menu entries, update timestamp, special meal | provided mess dataset |
| `BookingReference` | canonical booking ID, ownerProfileId, resource, start/end, status | location | Booking module; Calendar renders derived view |
| `RecurrenceSeries` | id, type, recurrence frequency, time model, start/end range, source | weekday list, interval, count and exception IDs | source or student (if personal) |
| `OccurrenceException` | seriesId, original occurrence date, action | replacement date/time/room, reason, status | appropriate source or student (personal only) |
| `ReminderRule` | id, record/occurrence ref, offset or local-time rule, enabled | user preference, channel = inApp | profile/preferences |
| `NotificationRecord` | id, profileId, eventKey, createdAt, type, readState | scheduledFor, surfacedAt | notification domain, not calendar duplicate |

**Time representations:**

1. `date-only` (e.g. `2026-11-12`) is a distinct type; never normalize it to a made-up 00:00/23:59 deadline for user display or overdue logic.
2. `timed` events have explicit start and end, with end > start; recurring schedules use local wall-clock time in `Asia/Kolkata` with bounded term dates.
3. `unknown-time` records can be listed in a date context but cannot occupy a timed grid or contribute to conflict/Free Pockets calculations.
4. In the first release, crossing-midnight timed personal events are supported only if start/end each contain full local dates; calculate in actual instants rather than naive string sorting.
5. Do not confuse due-date `dueTime` with a reminder delivery time.

**Canonical data ownership:** Calendar is a projection over Academics, Tasks, Bookings, Community/Birthdays, and Mess. Do not replicate authoritative booking or assignment status into separately editable Calendar copies. Calendar-specific UI preferences may be persisted separately.

## 5. Layer and preset system

### 5.1 Layers

1. `Academic`: classes/tutorials, exams, graded events, assignment deadlines, project milestones.
2. `Personal`: personal events, tasks with due dates, timed focus blocks.
3. `Campus Life`: consented birthdays, sports, clubs, events.
4. `Campus Services`: bookings and optional dining-time overlay; other service notices when sourced.
5. `Administration`: holidays, important fee/form/office dates, when sourced.

Bookings are visible by default in Balanced and can have a distinct visual subcategory even though they belong to Campus Services. Academic classes/deadlines, personal records, and bookings are default-visible; consented birthdays are subtle; ordinary campus announcements may be optionally revealed; dining overlay defaults OFF.

### 5.2 Presets

| Preset | Visible default content | Dining overlay |
|---|---|---|
| Balanced Campus (first launch) | Academic, Personal, Bookings, important administrative dates, consented birthday dots, selected campus events | Off |
| Academic Focus | Academic, personal study/focus and deadlines; other campus events hidden | Off |
| Campus Life | Birthdays, clubs, sports, personal plans, bookings; academic hidden by display preference only | Off |
| Exam Preparation | Exams, deadlines, related academic commitments, personal tasks/focus blocks | Off |
| Custom | Saved user-specific combinations, course/batch/section/status filters and overlay selections | User-saved |

Preset selection changes **visibility only**. No change to source records, notification policies, actual booking statuses, or selected profile. The current date and selected event remain anchored if possible. A selected event newly hidden by the preset triggers the `Hidden by filters` indicator, not a false 404.

### 5.3 Filter contract

Category/subcategory, course, batch/section (only if present), confirmation status, record origin (`provided`/`demo`/`personal`), personal task completion, and search terms. Filter absence should be marked `Not available` when corresponding source data is absent, rather than guessed. Filter state saved per demo profile. `Clear filters` restores active preset; it never removes records. Calendar filters are independent from Home's saved schedule filters, though deep links may carry temporary shared filter context.

## 6. Integrated Task Panel (user-selected B)

### 6.1 Panel architecture

The Tasks tab contains **Today / Upcoming / Unscheduled / Completed** sections, with a search/filter control. In compact widths, use a segmented list or collapsible headings rather than four permanently expanded panels. Initial display: incomplete dated tasks ordered overdue → today → upcoming; undated tasks separate. `Add task` stays available.

A task card displays title, related course/deadline if any, optional due date/time, personal status and a context menu. It does **not** claim LMS submission. A related assignment panel shows imported assignment facts above a clearly separated `My preparation checklist` of student-owned tasks.

### 6.2 Task state and ownership

- `notStarted`, `inProgress`, `personallyCompleted`; state changes are owned by the student, undoable, and reflected in Home My Tasks and Deadline Focus where applicable.
- Optional subtasks use checklist state; completing all subtasks may suggest marking parent complete, but does **not** silently mark a course assignment officially submitted.
- Editing academic deadline details (date, title, teacher) is prohibited in the student task editor; personal description/checklist and own target dates may be edited separately.
- Link/unlink task to assignment without deleting either side; deleting a personal task does not delete the official/provided deadline.
- No mandatory estimate of task duration; missing duration must not be inferred by the app.

### 6.3 Scheduling a task

1. Open task card → `Schedule time`.
2. Choose date and explicit duration (user may select 30/60/120 min or enter valid custom length).
3. `Find open windows` optionally finds candidate free intervals from known **timed** commitments during chosen planning hours; label `Open on your CampusOS calendar`.
4. Choosing a window produces a **draft** FocusBlock, not an automatic save.
5. Display known conflicts; user can adjust or `Save anyway` for a personal focus block.
6. Confirm → save one FocusBlock referencing task ID; show it in Week/Day and Home. A task can have multiple FocusBlocks.
7. Cancel/delete FocusBlock → do not delete or mark the task complete. Complete task → do not silently delete future FocusBlocks; offer to keep or remove them with an explicit choice.

### 6.4 Free Pockets computation

- Use per-profile planning window `08:00–22:00` and minimum shown gap `45 min` as inherited Home defaults; configurable per profile.
- Collect **confirmed timed commitments** for selected date, clip to working window, merge intersecting/adjacent intervals, then return complement intervals meeting minimum duration.
- Exclude date-only deadlines, birthdays, holidays, dining overlays, untimed personal tasks and cancelled classes. Tentative timed events do not silently block time; display a caution overlay on candidate gaps if a tentative event could affect them.
- No known events ≠ definitely free. Display `No timed commitments recorded for this period` and `Open on your CampusOS calendar`, not a claim that the person is available.
- Respect time zone and actual event boundaries. Profile switching recomputes correctly.

### 6.5 Workload indicator

Show verifiable counts, e.g. `3 deadlines this week · 2 incomplete tasks · 1 planned focus block`. Do not infer difficulty, hours required, academic risk, productivity percentage, or stress score from a raw count.

## 7. Event creation and editing

### 7.1 `+ Add` categories

| Choice | Required fields | Optional | Default permissions |
|---|---|---|---|
| Personal event | title, date, all-day or valid explicit start/end if timed | description, location, reminder, recurrence | current demo profile only |
| Personal task | title, owner | due date/time, course link, description, priority, checklist, reminder | private to current profile |
| Study/focus block | title or linked task, explicit start/end | description, reminder | private to current profile |
| Birthday reminder | display name, month/day, visibility consent for any sharing | reminder settings | private by default |

No `Create official lecture`, `Change university exam`, or `Approve leave` choice in student Add menu. If actual academic records are provided, they enter through a separately documented import path. The form opens in a modal or right drawer on desktop, fullscreen sheet on mobile.

### 7.2 Date grid creation

- Click date → select it and show details; single click on empty **timed** grid space may open Add menu, while an optional double-click shortcut may open event draft. Do not make double-click mandatory for touch or keyboard users.
- Prefill known date and clicked start time only. End time remains **unconfirmed** until user chooses it. For date-only click, default to all-day mode only for personal event; never prefill an invented assignment due time.
- Form validation: trim nonempty title, date valid, end strictly after start, allowed recurrence pattern, no duplicate mutation from repeated Save click, preserve draft after validation/persistence failure.

### 7.3 Editing and deletion matrix

| Record | Edit from Calendar? | Delete from Calendar? |
|---|---|---|
| Student-owned personal event | Yes | Yes, with appropriate confirmation |
| Student-owned task | Yes | Yes, does not delete linked academic source |
| Student-owned focus block | Yes | Yes, does not delete task |
| Student-owned private birthday | Yes | Yes |
| Provided timetable class | No | No |
| Provided academic assignment/exam | No (except separate personal task layer) | No |
| Resource booking | `Manage booking` → Booking module | `Cancel booking` via Booking module only |
| Campus event/announcement | No | No |
| Mess menu/service schedule | No | No |

For student-owned recurring events, offer `This occurrence` and `Entire series`. **`This and following` is not supported in baseline** and must not appear as a nonfunctional option. Editing one occurrence creates an exception rather than copying a second event. Entire series edits require confirmation and preserve clear exception logic or explicitly warn where changes require reviewing exceptions.

## 8. Event detail panel interactions

### 8.1 Universal header

Every event detail displays: title, category, exact/date-only time model, recurrence (if any), confirmation badge, provenance/source label, record mode (`Provided`, `Demo`, `Personal`), and selected profile relevance. Omit unknown fields or explicitly say `Not provided`; do not invent venues, professors, descriptions, links or contacts.

### 8.2 Type-specific actions

| Kind | Primary CTA | Secondary actions | Forbidden claim |
|---|---|---|---|
| Class | `View course` (if course exists) | Add personal reminder, view changes/recurrence | Edit official timetable |
| Exam | `View exam details` | Add personal preparation task, reminder | Official exam seating unless provided |
| Assignment deadline | `Open deadline & tasks` | Add checklist item, schedule focus block | `Submitted` without verifiable source |
| Personal event | `Edit` | Delete, reminders, recurrence edit | Broadcast to campus without consent |
| Birthday | `View birthday reminder` | Edit if owned, set reminder | Expose birth year or unconsented name |
| Booking | `Manage booking` | Add personal reminder | Delete underlying booking via calendar-only edit |
| Club/sports event | `View event` | Save personal interest/reminder | Enrollment confirmed unless actually recorded |
| Mess contextual item | `View menu` | Enable overlay | Guaranteed current menu without source |
| Focus block | `Edit work session` | Delete block, open linked task | Automatic task completion |

### 8.3 Source and history

When a supplied schedule has an explicit change, show `Updated [known timestamp]` and old/new details where both are available. If timestamp is absent, display `Last update time not provided`; don't invent an edit history. Cancelled/rescheduled occurrences remain addressable by deep link (show correct status, original time if known) without creating duplicate active occurrences.

### 8.4 UI states

Loading (when data is being parsed), empty, filtered-empty, unavailable, malformed source record, save error, permission denied, cancelled and tentative. Every CTA either works or is absent/disabled with an explanatory message—never a decorative button that appears functional.

## 9. Reminder and notification contract

### 9.1 Channel boundary

**Initial prototype:** **in-app notifications only.** On-page notifications may appear while app is open. On app launch/resume, recalculate relevant reminder states against persisted records; do not backdate a `deliveredAt` timestamp or claim a past alert was sent when the app was closed. Notifications while app/browser is fully closed, push, SMS, WhatsApp and email are **not implemented**. The future demo backend may demonstrate event-change notifications separately during final phase.

### 9.2 Proposed initial defaults (editable per profile)

| Type | Default reminder | Exact semantics |
|---|---|---|
| Time-specific academic deadline | 24 hours before provided due instant | If deadline was entered too close to due time, show current `Due soon` state; don't fabricate a past send. |
| Date-only academic deadline | 09:00 Asia/Kolkata on **previous calendar day** | Reminder clock time is user preference, **not** the assignment due time. |
| Exam with known start | 24 hours before | Only if exam time exists; date-only exam falls back to previous-day 09:00 reminder. |
| Regular class | Off | Opt-in 15-minute reminder available. |
| Personal timed event | 15 minutes before | User can modify or disable. |
| Booking | 30 minutes before | Only for valid active reservation; cancelled bookings disable reminders. |
| Birthday | Off | If opted in, user chooses morning-of or number of days before. |
| Personal task | Off | User may set reminder only if sufficient due/scheduled information exists. |
| Mess service | Off | No default daily reminder spam. |

Default reminders are **design defaults**, not claims about campus policy. Users may change or turn off optional categories. Important academic changes may appear as visible in-app notices when data changes, but the prototype must not imply official campus-wide alert delivery.

### 9.3 Reminder settings UI

Notifications Settings contains: master in-app reminder preference; category toggles; default offsets by kind; reminder clock time for date-only records (default 09:00); quiet-hours preference (optional), with an explicit preview of what it suppresses/defers. Avoid implementing quiet hours unless deterministic deferral semantics and tests are defined; baseline can label it a future enhancement rather than a functioning toggle. For a single event/task, `Remind me` override takes precedence over category default where allowed.

### 9.4 Scheduling and duplication

- Reminder occurrence key: `profileId | canonicalRecordId | occurrenceId | ruleId | triggerAt`. This deduplicates repeated refresh/session resumes.
- If an event is rescheduled, cancel/recalculate pending rules tied to old occurrence; never surface both old and new reminder as active.
- Completion/cancellation may suppress pending task/booking reminders according to preference; user should still be able to view record history.
- Display `Triggered in-app at ...` only after actual active-app trigger; if no trigger occurred, present a status such as `Due today` on re-open, not an invented delivery record.
- Opening a reminder navigates to the underlying record and uses `Show hidden event` when its filters currently hide it.
- Notification preference changes persist per profile and do not delete source events.

## 10. Recurrence and exception contract

- Recurrence series has bounded start/end dates and a rule; initial supported frequencies: daily/weekly/monthly/yearly for student events, bounded weekly for supplied courses, annual month/day for birthdays, weekly meal-service windows.
- Weekly classes may specify multiple weekdays and local start/end clock times; occurrences generated only within source semester bounds.
- Occurrence exception key = `(seriesId, original scheduled occurrence local date/time)`; action = cancelled, rescheduled, modified details. A moved class must not also show an active original occurrence.
- Semester holidays may be displayed as potential schedule conflicts; do **not** auto-cancel classes on a holiday without explicit supplied cancellation source.
- Editing `This occurrence` on student-owned series creates/updates an exception; `Entire series` edits the rule and requires confirmation. Avoid destructive exception replacement.
- Date-only annual birthdays on Feb 29: preserve Feb 29 canonical date; non-leap-year observation policy is **not silently inferred**. Baseline: do not create a Feb 28 or Mar 1 substitute occurrence automatically; optional explicit reminder policy may be added later.
- Recurring items without a known end/semester boundary: ask for bound in personal editor; source import marks `needsReview` rather than generating unbounded occurrences.

## 11. Conflict detection and Free Pockets

**Definite timed overlap:** intervals are half-open `[start, end)`. Conflict if `max(start1, start2) < min(end1, end2)`; adjacent end/start is not overlap. Use normalized instants and chosen display timezone. Ignore cancelled events. Indicate whether record is confirmed or tentative.

**Possible conflict:** one or more intervals tentative or time uncertain. Display uncertainty, do not report a definite overlap without two known intervals.

**Deadline density:** factual count of deadlines on same day/week; not a time overlap and not a school workload diagnosis.

**Personal-event save policy:** warn and allow intentional overlaps, with `Edit time`, `Find candidate gap`, `Save anyway`. **Booking save policy:** booking module validates capacity/resource conflicts and may prohibit saving; Calendar does not bypass it. No automatic rescheduling, deletion or reassignment.

**Dining overlay:** adds information only; never blocks Free Pockets or triggers conflict detection. Birthdays and date-only deadlines similarly excluded from busy interval calculations.

## 12. Home and module synchronization

| Canonical action | Calendar effect | Home effect | Other |
|---|---|---|---|
| Add/edit personal event | Update all views | Agenda/Week and Up Next recompute | Profile scope enforced |
| Add/edit personal task | Tasks pane and deadline listings update | My Tasks/Deadline Focus update | Academics task card references same ID |
| Complete personal task | Completion visible | My Tasks/Deadline Focus recompute | Does not mark official submission |
| Create focus block | Timed grid and task link update | Agenda/Week, Free Pockets and Up Next update | Task remains separate |
| Book resource | Derived booking event visible | Agenda/Week and My Activity update | Booking module owns status |
| Cancel booking | Derived cancelled/removed status consistent | My Activity/Up Next update | Reservation slot returns only after Booking module confirms |
| Import rescheduled class occurrence | Old time suppressed, new visible with change label | Today's/weekly schedule recalculated | In-app change notice when actually processed |
| Update supplied deadline | Existing canonical deadline modified with provenance | Deadline Focus recalculated | User tasks remain linked to stable ID |
| Change birthday visibility | Only authorized profiles see it | Campus Pulse reflects permission | No privacy leak on profile switching |
| Update mess day menu | Day Context and optional overlay reflect source | Mess Preview updates | Does not create four ordinary calendar events |

**Profile isolation:** Switching demo profile changes visible personal records, preferences and notification state. Shared supplied events remain audience-filtered. `Reset Demo` must be a deliberately separate, confirmed global/local seed-data operation, never confused with `Reset filters` or `Reset layout`.

## 13. Data ingestion for the user's forthcoming schedules

**Expected inputs:** semester calendar, weekly academic timetable, course and section metadata, exam schedules, assignments/homework/projects (some tentative), mess meal hours and menus, consented birthdays, campus events. All inputs are pending; do not fabricate them.

**Import process:** raw source retained → extraction → normalize dates/times/categories/recurrence → validate against schema → flag ambiguities → human-approved canonical records → render through shared selectors. Keep an `importBatchId`, original filename, extraction notes, record-level source attribution, and a review queue for missing/contradictory fields.

**Strict source rules:**

- A source saying `Friday` without a term/date anchor is not enough to invent a calendar date; flag for review.
- A due date with no due time remains date-only, not 23:59.
- A course name without room/professor remains partially populated.
- Tentative assignments remain tentative in every view.
- The real timetable must specify applicable batch/section; if ambiguous, do not assign it to every demo profile.
- Meal menus and hours are distinct: a food item list is not evidence of serving time.
- Birthdays are private unless sharing permission and intended audience are explicit.
- Duplicate rows/sources require stable deduplication review, not automatic silent overwrites.
- User-provided files are evidence of content, not authorization to claim official campus-wide notifications.

## 14. Visual and accessibility contract

- Extend Home's hybrid design tokens: warm paper/off-white, dark ink, muted teal, restrained terracotta, coloured event categories, 8-12 px card radius, subtle borders.
- Calendar category colours **never** communicate meaning alone: also include icons, labels, badges, and accessible text.
- Week time grid supports zoom or readable row sizing; overflow scrolls inside calendar stage rather than hiding content. Avoid month-card content overflow.
- Keyboard: navigate toolbar, date grid, events, Add forms and tabs; `Esc` dismisses popovers/sheets; focus returns to invoking control; clear visible focus ring.
- Screen reader: date cells and event labels expose day/date, event count, type, time/status, selected state, and active filters. Live results announce relevant count changes without excessive chatter.
- Mobile: no mandatory hover/double-click/drag gesture; touch size ideally ≥44px; bottom sheets scroll independently; no 7-column tiny text forcing horizontal page overflow.
- Reduced-motion preference respected; calendar should work with animation disabled.
- Empty, loading, filtered-empty, parsing-failure, permission and offline/no-browser-storage states are designed, not default blank regions.

## 15. Exact interaction matrix

| ID | Trigger | Preconditions | Result | Persistence |
|---|---|---|---|---|
| C-A01 | Change view | Calendar open | Render selected view with same date/filter context | Per profile |
| C-A02 | Previous/Today/Next | Valid timezone and app clock | Navigate appropriate interval | URL/session |
| C-A03 | Click day | Date within visible range | Select date and update Day Context | Session |
| C-A04 | Click event | Visible record exists | Open correct Details with ID/occurrence | URL/session |
| C-A05 | Click hidden deep link | Record exists but filtered | Explain hidden state; `Show event` temporarily reveals | Session only |
| C-A06 | Toggle layer/preset | Available categories | Change visibility only | Per profile |
| C-A07 | Enable dining overlay | Meal service schedule exists | Show neutral bands, not busy blocks | Per profile |
| C-A08 | `+ Add` personal event | Valid title/date/time | Create profile-owned canonical record once | Local domain store |
| C-A09 | Save invalid form | Validation fails | Preserve draft; show field errors; no mutation | Draft only |
| C-A10 | Edit personal event | Owner authorized | Update single event or selected series scope | Local domain store |
| C-A11 | Delete personal event | Owner authorized, confirmed | Remove owned record; update views | Local domain store |
| C-A12 | Open academic class | Imported event exists | Read-only details; relevant course link | No mutation |
| C-A13 | Add personal task | Valid title | New profile-owned task, optionally assignment-linked | Local domain store |
| C-A14 | Complete/undo task | Owner authorized | Update personal status; do not mark official submission | Local domain store |
| C-A15 | Schedule task | User chooses time/duration and confirms | Create one FocusBlock linked to task | Local domain store |
| C-A16 | Remove FocusBlock | Owner authorized | Delete only session; task preserved | Local domain store |
| C-A17 | Find Free Pockets | Known time window and interval rules | Show possible calendar openings | Derived |
| C-A18 | Save timed overlapping personal event | Two known timed commitments | Warn and allow user choice | Local domain store after confirmation |
| C-A19 | Open booking | Booking exists | Route to owner module; no calendar-side blind delete | Booking domain |
| C-A20 | Apply imported class exception | Valid supplied source | One occurrence updates, no duplicate | Imported store |
| C-A21 | Reminder fires while app active | Enabled rule and time reached | One in-app notification; actual surfaced timestamp | Per profile |
| C-A22 | Reopen after missed reminder | App was closed | Recompute status; do not pretend a prior delivery | Per profile derived |
| C-A23 | Switch demo profile | Profile exists | Re-scope records, settings, tasks, birthdays, alerts | Per profile |
| C-A24 | Reset filters | Calendar open | Restore visibility defaults only | Per profile |
| C-A25 | Reset demo | User confirms explicit reset | Restore seed data; explain personal-data consequences | Local domain store |

## 16. Acceptance test matrix

All tests are **planned**, not executed. Implement unit/component/end-to-end checks with deterministic fixed clock, seeded data, profile switch and reproducible reset.

| Test ID | Case | Pass criteria |
|---|---|---|
| C-T01 | Shared views | Same source event appears correctly in Month/Week/Day/Agenda. |
| C-T02 | Month density | `+N more` reveals all relevant visible events; no data is lost. |
| C-T03 | Time accuracy | Date-only deadline never acquires 23:59 or arbitrary grid slot. |
| C-T04 | Recurrence bounds | Weekly classes generated only during their specified term. |
| C-T05 | Single occurrence cancellation | Only intended class removed/subdued; other occurrences unaffected. |
| C-T06 | Occurrence move | New time appears once, original not shown as active duplicate. |
| C-T07 | Holiday intersection | Holiday does not implicitly cancel class. |
| C-T08 | Timed conflict | Overlap flagged; end-at-start adjacency not flagged. |
| C-T09 | Tentative event | Possible conflict shows uncertainty, not definite result. |
| C-T10 | Dining overlay | Toggles bands; does not create busy status or time-conflict. |
| C-T11 | Cross-screen task | Personal task edit/complete reflected in Home and Calendar. |
| C-T12 | Official submission integrity | Completing task never changes assignment to `Officially submitted`. |
| C-T13 | Focus block lifecycle | Session creation edits grid; deleting block preserves task. |
| C-T14 | Free Pockets | Merge overlapping intervals, clip to window, exclude untimed/context records. |
| C-T15 | Preset isolation | Preset hides records visually but no data deleted. |
| C-T16 | Deep link hidden event | Hidden record can be temporarily revealed and opened. |
| C-T17 | Student permissions | Cannot edit imported class/exam/assignment source. |
| C-T18 | Booking ownership | Calendar route manages booking via Booking module; no orphaned slot state. |
| C-T19 | Reminder in-session | One in-app reminder per occurrence and rule; correct timing. |
| C-T20 | Reminder closed app | No false claim of push/background delivery. |
| C-T21 | Reschedule reminders | Old pending reminder suppressed; new one computed correctly. |
| C-T22 | Birthday privacy | Opt-out/private birthdays absent from unauthorized profile. |
| C-T23 | Profile isolation | Personal tasks/events/preferences don't leak across profiles. |
| C-T24 | Refresh persistence | User-owned records and display settings survive reload in supported browser mode. |
| C-T25 | Invalid forms | Data preserved, no duplicate write, accessible inline error. |
| C-T26 | Source ambiguities | Missing faculty/time/location labeled; not filled by guesswork. |
| C-T27 | Mobile + keyboard | Navigable at 320px, forms and sheets usable without pointer. |
| C-T28 | Reset separation | Reset filters/layout does not delete tasks; Reset Demo requires confirmation. |
| C-T29 | Empty states | Correct distinction no records / no matches / unavailable source. |
| C-T30 | Local clock edges | Today, due statuses and reminder dates correct across local midnight. |

## 17. Implementation sequence for Calendar only (not a coding instruction yet)

**Gate 1 — Schema and fixtures:** Implement validated domain types, local repository interfaces, fixed demo clock in tests, seeded records with provenance. Verify no fake official data. **Gate 2 — Views:** Month/Week/Day/Agenda and navigation, selected date, explicit empty states. **Gate 3 — Layers:** filters, presets, contextual dining. **Gate 4 — Detail and editor:** inspect records, create/edit personal records, read-only imported records. **Gate 5 — Tasks:** right pane, checklist, focus blocks, Free Pockets. **Gate 6 — Recurrence:** bounded rules and exceptions. **Gate 7 — Conflicts/reminders:** deterministic overlap and in-app-only reminder scheduler. **Gate 8 — Integration/QA:** Home integration, Booking links, profile privacy, mobile, tests. **Final separate project phase:** optionally attach small authorized demo backend for cross-client live updates.

Do not ask Claude Code to implement all gates at once. Every gate requires implementation review and passing tests before the next.

## 18. Deferred backend boundary (do not build yet)

Design the front end to call a repository/service interface, rather than components reading random JSON/global browser storage directly. Initial adapter = validated local fixtures + per-profile persisted actions. Future adapter can persist event changes and notifications in a small shared backend, enabling a **Demo Operations** panel to reschedule a class or update a service state and visibly update the student screen. Preserve record IDs, source labels, permissions and `simulated` status; do not call a simulated operator update an institutional official change. No web sockets, staff accounts, server architecture or realtime API is required in this Round 2 build.

## 19. Remaining external inputs and non-blocking open items

**Pending user-provided factual inputs:** semester dates, real class timetable with batch/section, deadlines and assignment details, birthdays and sharing permission, mess service hours/menu, any college event dates. These are not product-spec blockers; until provided, use clearly labelled illustrative fixtures only.

**Default design choices that can be revised before implementation:** exact right-panel dimensions, event-chip limits at breakpoints, which campus events appear in Balanced preset, notification offsets/quiet-hour treatment, personal-event recurrence edge cases beyond the supported subset, whether date-only assignment reminders default on for all imported records. Changes require a decision-log entry and test update.

**Open institutional constraints requiring explicit authorization before live deployment:** faculty/office data rights, official schedule change publishing, use of classmates' birthday data, access to booking records and service-staff data. None are falsely represented as authorized in prototype.

## 20. Definition of done (Calendar scope)

- All C-A interaction contracts implemented or explicitly identified as intentionally deferred in an approved change log.
- All C-T planned tests executed and outcomes recorded; no invented test-passed claim.
- Every visible CTA works, or is transparently disabled/omitted; no decorative dead buttons.
- All views share canonical records; Home and Bookings remain consistent; demo reset reproducible.
- Local persistence and profile isolation work under documented supported browser conditions.
- Timed/date-only precision, source provenance, privacy and simulated labels verified.
- Accessible desktop/mobile navigation and meaningful empty/error states.
- Future backend not bundled as an accidental prerequisite or falsely described as already functioning.

---

**Change protocol:** Edit this file and a `DECISIONS.md` entry together whenever a baseline behavior is revised. Preserve `C-D`, `C-A`, and `C-T` identifiers for traceability. The eventual `CLAUDE.md` must reference this spec and state that explicit source facts override demo fixtures, but may not override user-approved interaction decisions without an authorized revision.
