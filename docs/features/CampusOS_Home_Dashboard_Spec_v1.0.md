# CampusOS — Home Dashboard Product, Interaction & Visual Specification

**Specification ID:** `COS-HOME-001`  
**Version:** `1.0.0` — Round 1 design freeze  
**Status:** **Ready for engineering decomposition; not a claim of implementation or testing**  
**Date:** 2026-11-01  
**Product:** CampusOS — Business Operations / “Time Tax” academic working prototype  
**Source context:** The group's `ibo grp 5 (1).md` (26 feature ideas), `CampusOS_Information_Architecture_v1.md`, and approved Round 1 workshop decisions.  
**Design direction:** Hybrid professional productivity + warm student-life experience.  
**Backend constraint:** Live-update demo backend and demo-operator interface are **deferred to the final development phase**. Design the interfaces now; do not implement a server as part of Round 1.

> **Authority rule:** This file is the authoritative **Home screen** product contract after Round 1. It does not supersede general app architecture, the future detailed Calendar contract, or any yet-to-be-supplied college timetable, birthday list, or menu. Concrete defaults below are **design decisions made to complete this specification**, not external facts about the college. They can be changed only by updating the decision log and relevant tests.

---

## 1. Product intent and non-goals

### 1.1 User promise

When the selected demo student opens CampusOS, they can quickly understand: **(1)** what is on their schedule, **(2)** what needs attention, **(3)** which campus actions are available, and **(4)** what is happening in the campus community. Users may personalize the homepage without losing access to essential navigation or truthful data labels.

### 1.2 Intended users

- **Primary:** a student viewing a demo profile on a responsive browser.
- **Secondary:** a professor or evaluator assessing coherence, usability, operational value and interactions.
- **Future:** staff/demo operator changing data through a separate authenticated simulator (not part of this screen's initial implementation).

### 1.3 Explicit non-goals

- Not a university ERP, an official attendance/leave authority, real payment confirmation, or an institutionally verified schedule unless data has explicitly been provided and verified.
- Not a complete replacement for the Calendar, course hub, service pages, or student social network.
- Not a real-time occupancy platform during the initial prototype phases.
- Not a source of AI-fabricated events, wait times, faculty availability, birthdays, submission results, or personalized recommendations.
- Not a dashboard that requires a live backend to function. Initial interactions use validated local/seed data and local persistence.

---

## 2. Decisions frozen for Round 1

| ID | Decision | Status / precise rule |
|---|---|---|
| H-D01 | Design language | **Locked:** hybrid professional-and-student; warm, editorial, readable. |
| H-D02 | Homepage focus | **Locked:** balanced academic productivity + campus convenience + social discovery. |
| H-D03 | Schedule centerpiece | **Locked:** user-switchable **Agenda / Week** view in a single prominent widget. |
| H-D04 | Complexity | **Locked:** **highly personalized**, not minimal: saved layouts, rearrangement, quick-action editing, advanced filters, optional Free Pockets and context suggestions. |
| H-D05 | Navigation shell | **Inherited:** sidebar destinations Home, Calendar, Campus Services, Bookings, Academics, Administration, Community, Time Tax, with global Search, Notifications, Settings. |
| H-D06 | Homepage information architecture | **Design-fixed:** three zones — Immediate Priorities; Things to Do; Discover & Reflect. |
| H-D07 | Fixed core | **Design-fixed:** page greeting/identity, schedule widget, and global alert access remain visible. Optional widgets may be hidden or reordered. |
| H-D08 | Initial schedule mode | **Design-fixed:** Agenda; remember later user selection per profile. |
| H-D09 | Widget controls | **Design-fixed:** edit layout mode, show/hide, drag/drop (desktop), keyboard Move Up/Down, presets, Reset Layout, compact/comfortable density. |
| H-D10 | Birthday handling | **Design-fixed:** birthdays inside Campus Pulse; do not add a standalone permanent homepage birthday widget. Only consented, audience-visible entries. |
| H-D11 | Quick Actions | **Design-fixed:** four by default, configurable from the supported destinations, with no duplicates. |
| H-D12 | Context intelligence | **Design-fixed:** deterministic rules on actual stored records; no generative inference of schedules or activity. |
| H-D13 | Time Tax presentation | **Design-fixed:** scenarios must say **illustrative**, **potential**, or **field-observed** as appropriate; never invent a measured personal saving. |
| H-D14 | Data integrity | **Design-fixed:** one canonical record per event, task, booking, order, ticket; all cards reference records rather than duplicated data. |
| H-D15 | Backend | **Locked:** reserved for **final implementation phase only**; no separate staff dashboards or real-time network dependency now. |

### 2.1 Operational defaults, amend through decision log if needed

- Prototype timezone: `Asia/Kolkata`; interface date display: English India. No conversion of date-only deadlines into arbitrary times.
- Suggested working day for *Free Pockets*: `08:00`–`22:00`; minimum gap to display `45 minutes`; user may adjust in Settings. These are prototype preferences, **not campus opening hours**.
- Default quick actions: `Chill Spot`, `Laundry`, `Bookings`, `Mess`.
- Schedule's week starts Monday, ends Sunday. At midnight in the chosen timezone, “Today” updates, including agenda and countdowns.
- Preset selected on first launch: **Balanced Campus**; later changes are saved per demo profile.
- Card mode default: `comfortable`; optional `compact` density.
- Events and tasks default to **all categories visible** unless filtered explicitly. Filters on Home apply only to the schedule card and closely related optional workload indicators; see §7.

---

## 3. Desktop and mobile page architecture

### 3.1 Desktop shell

- Left navigation sidebar (expanded target ~248 px; collapsible); active Home destination highlighted.
- Top application bar: breadcrumb or CampusOS wordmark, search trigger, notification center, selected demo profile, settings access. Profile is labelled as a demo profile.
- Main content: width constrained at approximately 1440 px; 12-column responsive grid, 24 px gutters on wide desktop; 24–32 px page spacing.
- Page header: date-aware greeting + short, deterministic daily summary + `Customize` button, always above personalized widgets.
- Main schedule feature: large **Agenda / Week** card, occupying approximately 8/12 columns on desktop by default; beside it, a narrow feature stack (Up Next and Deadline Focus), if visible.
- Remaining optional cards flow in a rearrangeable grid, with a section heading separating Zone 2 from Zone 3. Section boundaries are kept for scanning; widgets may be reordered **within their zone**. A widget may move to another zone only by explicit `Move to zone` control; no accidental cross-zone dragging.

### 3.2 Tablet shell (768–1199 px)

- Sidebar collapses to icon rail or drawer, never overlays active controls without an accessible dismiss action.
- Schedule becomes full width; Up Next and Deadline Focus sit below in two columns.
- Optional widgets form up to two columns; widget order follows stored zone/order, not arbitrary layout positions.

### 3.3 Mobile shell (<768 px)

- Top compact header with search/notifications; bottom navigation `Home`, `Calendar`, `Services`, `More` (More opens remaining sections).
- Order on first load: greeting → Up Next → Schedule (Agenda/Week) → Deadline Focus → Quick Actions → My Activity → rest of visible widgets. This is a **mobile reading-order exception** to the desktop pinned-schedule-first layout.
- Week mode is a seven-day strip and selected-day list, not an unreadable 7×hour timetable.
- Quick Actions show 2×2 or four compact slots when width permits; preserve readable labels.
- Layout editing on mobile uses `Move up`, `Move down`, `Move to zone`, and visibility toggles. **Do not require touch drag-and-drop.**
- All buttons must be usable at 320 px width without horizontal page overflow; main actions ideally have ~44 px touch targets.

### 3.4 Initial visual wireframe

```text
┌──────────── Sidebar ───────────┐┌──────────────────────────────────────────────┐
│ CampusOS                      ││ Search              Alerts     Demo Student   │
│ Home ←                         ││ Good morning. Your day at a glance. Customize│
│ Calendar                       │├────────────────────────────┬─────────────────┤
│ Campus Services                ││ Your schedule              │ Up Next         │
│ Bookings                       ││ [Agenda | Week]            ├─────────────────┤
│ Academics                      ││ [calendar & event detail]  │ Deadline Focus  │
│ Administration                 ││                            │                 │
│ Community                      │├────────────────────────────┴─────────────────┤
│ Time Tax                       ││ QUICK ACTIONS                                │
│                                ││ [Chill Spot] [Laundry] [Bookings] [Mess]     │
│                                │├───────────────────────┬────────────────────┤
│                                ││ My Activity           │ Mess Preview       │
│                                ││ My Tasks              │ Free Pockets       │
│                                │├───────────────────────┴────────────────────┤
│                                ││ Campus Pulse         │ Time Tax Snapshot   │
└────────────────────────────────┘└──────────────────────────────────────────────┘
```

**Layout sketch is schematic.** It defines hierarchy, not pixel-perfect dimensions, content, or real campus facts.

---

## 4. Visual design contract

### 4.1 Aesthetic personality

- **Professional:** consistent grid, typographic precision, predictable navigation and clear status hierarchy.
- **Student-friendly:** warm neutrals, approachable microcopy, restrained event-category colors, modest delight around birthdays/events.
- **Editorial:** large greeting, quiet labels, carefully controlled information density; **not** a playful cartoon interface.
- **Not:** neon cyberpunk, glassmorphism everywhere, huge hero photographs, generic metric-wall SaaS, infinite student social feed, excessive gradients or animation.

### 4.2 Initial design tokens

| Token | Value | Intended use |
|---|---|---|
| `--canvas` | `#F7F5F0` | Page background |
| `--ink` | `#192B34` | Primary text |
| `--accent-teal` | `#317C72` | Primary controls, focus indicators where accessible |
| `--accent-terracotta` | `#D58A65` | Secondary emphasis, never sole danger indicator |
| `--mist` | `#E9EDF3` | Subtle secondary surfaces |
| `--surface` | `#FFFFFF` | Primary cards |
| `--border` | `#DFE3E3` | Card and input outlines |
| `--radius-sm/md/lg` | `8/12/16px` | Controls/cards/large containers |
| `--space-unit` | `4px` | Use 4/8/12/16/24/32 px rhythm |

**Accessibility condition:** tokens are initial design targets, not a guarantee of adequate text contrast. Validate color contrast for each foreground/background pair. Functional statuses require **icon/label and color**.

### 4.3 Typography and iconography

- Interface typeface: Inter or equivalent readable sans; system fallback.
- Greeting: 28–36 px desktop, 24–28 px mobile; primary card title 16–20 px; body 14–16 px; secondary metadata 12–14 px. Do not force metadata at tiny unreadable sizes.
- Icons: Lucide React; consistent size and stroke, avoid decorative mismatches.
- Use readable timestamps and human-centered wording (“Today at 2:00 PM” where known) rather than raw IDs.

### 4.4 Motion and microinteractions

- Card hover/focus and panel transitions: ~120–200 ms; respect `prefers-reduced-motion`.
- Agenda/Week switch retains card bounds when possible; no layout jump from animated full-page shifts.
- Widget drop shows the final slot; changes are announced for screen reader users.
- Birthdays may have a **single subtle decorative animation** on opening a birthday card, never auto-playing confetti continuously.
- Never imply a backend sync or server success through motion when only a local change occurred.

---

## 5. Widget inventory and contracts

| ID | Widget | Default visible | Zone | Data inputs | Primary action |
|---|---|---|---|---|---|
| H-W00 | Page header/daily briefing | Always | Fixed header | Profile, current date, canonical records | Open Customize |
| H-W01 | Agenda / Week | **Always** | Zone 1 pinned | Calendar events, bookings, relevant deadlines | Open event / switch view |
| H-W02 | Up Next | Yes | Zone 1 | Scheduled timed events | Open event details |
| H-W03 | Deadline Focus | Yes | Zone 1 | Tasks/deadlines | Open task or course |
| H-W04 | Quick Actions | Yes | Zone 2 | Configured service routes | Navigate |
| H-W05 | My Activity | Yes | Zone 2 | Orders, bookings, complaints, leave demos | Open a record |
| H-W06 | Mess Preview | Yes | Zone 2 | Provided or demo-labelled mess schedule | Open meal/day |
| H-W07 | My Tasks | Yes | Zone 2 | User tasks and linked assignments | Add / complete task |
| H-W08 | Free Pockets | Yes | Zone 2 | Timed calendar intervals | Inspect gap / create personal event |
| H-W09 | Campus Pulse | Yes | Zone 3 | Permitted birthdays, events, clubs, announcements | Open source record |
| H-W10 | Time Tax Snapshot | Yes | Zone 3 | Model metadata and optional observations | Open Time Tax dashboard |

**Count:** one fixed header, one always-visible schedule, nine optional widgets. The presence of a widget does **not** imply data for it exists. Each needs a good empty state. All widget IDs are stable for preferences and tests.

### 5.1 H-W00 — Greeting and deterministic daily briefing

- Greeting depends on local clock (`05:00–11:59` morning, `12:00–16:59` afternoon, otherwise evening); date shown in the configured timezone. If no name, say “Welcome back.”
- Daily summary generated from available current-day records, e.g., “2 scheduled classes · 1 personal task due.” If no data, say “No schedule data available for today,” not “You have a free day.”
- The header may show **one** urgent actionable alert drawn from valid records. The notification center always remains accessible.
- Actions: `Customize` opens layout editor; profile selector changes demo identity only with clear confirmation if unsaved local state would be affected.
- Do not include inspirational text or generic AI-generated affirmations.

### 5.2 H-W01 — Switchable Agenda / Week

**Common controls:** `Agenda`, `Week`, `Previous period`, `Next period`, `Today`, `Filter`, `Open Calendar`.

**Agenda mode:**
- Default shows **today**, with timed events sorted ascending by start; all-day notices grouped above timed schedule and visibly marked “All day.”
- Events show start time if known, title, category, optional location, confirmed/tentative mark. End time is shown when provided. If a record has only a date, do **not** imply a start time.
- Completed personal tasks may be hidden by filter; official academic assignment completion cannot be inferred from a personal checkbox.
- At most five events are initially listed; `Show all` expands within the card. Empty state: “Nothing scheduled in the available records for this date.”
- Previous/Next in Agenda steps one calendar day; `Today` resets to current date.

**Week mode:**
- Monday–Sunday strip. Each day shows date, a count and up to three categorized markers; a selected day is visually distinct and accessible without relying on color.
- Clicking a day updates an **in-card detail list** for that day, with times and event titles; selecting an event opens its Calendar detail drawer via route/deep link.
- Previous/Next in Week moves seven days; `Today` moves to current week and selects today.
- On desktops with adequate room, optionally show a compact distribution of daily load under the strip; do **not** embed a full calendar timetable. The detailed timetable lives at `/calendar`.

**Filtering:** see §7. Filters apply identically to Agenda and Week; switching view must not reset filters or selected date. `Open Calendar` carries current date and relevant filters when technically possible.

**Error cases:** unparseable source events are not rendered as fabricated dates; show an import warning elsewhere. Event in another profile is not displayed. Missing source event destination shows an explicit missing-record state.

### 5.3 H-W02 — Up Next

- Source only **time-specific, not-cancelled events** relevant to the selected profile, where the start is on the **current local date** and either (a) `start >= now` or (b) explicit `start < now < end` identifies an ongoing event. Rank ongoing events first, then earliest future start, tie-breaking by stable event ID. An event with no end time is not assumed to be ongoing after its start passes.
- Show title, time, location if given, relevant category, and tentative status if applicable. Cannot assert “in 10 minutes” without a genuine timestamp.
- If no remaining timed events today: “No more scheduled timed events today” (not “You're free”).
- Click opens canonical Calendar event details. Dates roll over at midnight.
- For a qualifying ongoing event, display `Happening now` only when explicit start **and end** times exist; an event already ended is excluded.

### 5.4 H-W03 — Deadline Focus

- Source: academic or user-created task/deadline records with due **date** and optional due **time**; exclude deleted and personally completed tasks when “Hide completed” filter is active.
- Ranking: overdue pending first, then due today, then nearest upcoming. For due-date-only tasks, **do not** label overdue until the next calendar day. If due time is known, use that timestamp.
- Show at most 3 tasks; `View all` deep-links to tasks/course hub; detail opens associated record.
- `Mark personally completed` may be available on student tasks. Show “Personally completed”; never “Submitted to professor” unless verified integration exists.
- Tentative deadline displays tentative badge and source description when available.
- If empty: “No deadlines found in the available records.”

### 5.5 H-W04 — Quick Actions

- Exactly **four** preferred destinations displayed by default, editable from a selection panel of known routes (default: Chill Spot, Laundry, Bookings, Mess). On narrow screens, two-column arrangement acceptable.
- Each quick action displays icon + label and navigates to a valid route; never an inert card.
- Duplicate destinations prohibited; replacing an action cannot create duplicates; selection limited to routes actually implemented. An informational feature is allowed but must display its scope honestly.
- Edit mode supports reordering these four actions. Preferences persisted per profile.
- If the preferred route is removed or renamed in a later build, fall back to the first available permitted route and report a non-blocking configuration notice.

### 5.6 H-W05 — My Activity

- Aggregates **canonical** records created/selected by the profile: active café orders, upcoming bookings, open complaints, demo leave requests, and optional tracked parcels.
- Sort active items by `lastUpdatedAt` descending; display max 4 before `View all` or routed category.
- Each item shows type, friendly label, accurate local/demonstration status, timestamp where known, and deep link.
- Records in terminal statuses (collected/cancelled/resolved) may appear only in `Recent history`, not the default active list.
- Status changes generated through local simulation must be labelled as such; operator-controlled changes must **not** occur automatically in the initial version.
- Empty state: “No active requests or bookings yet” plus `Explore services`.

### 5.7 H-W06 — Mess Preview

- Show next relevant meal based on **provided serving windows**, or today's available menu without time-based claims where windows are missing.
- May display meal type, dishes, operating window, `sourceLabel`, and reliability badge. If menu is a demonstration seed, show `Sample menu`.
- `View menu` opens `/services/mess` focused on date/meal. Does not show dietary or allergen data unless provided and verified.
- Never assert current crowd occupancy or payment status from static samples.
- Empty state: “Mess menu not supplied for this day.”

### 5.8 H-W07 — My Tasks

- Students can add a personal task with title, optional description, optional course, due date/time, and a private visibility setting (default private).
- `Complete`, `Undo completion`, `Edit`, `Delete` (confirm delete), and `Open task` work through shared task state; show status in Home and Calendar where relevant.
- No requirement to sync with an external LMS. A manual task completion is only a personal status.
- Show maximum 5 pending tasks, `Show more`; tasks without due dates appear below dated ones, not assigned invented dates.
- Validation: trimmed non-empty title, max 120 chars; due date valid; optional time requires a due date.

### 5.9 H-W08 — My Free Pockets

- Analyze intervals between known scheduled **blocking** timed events on the selected date, within configured window `08:00–22:00` by default. Merge overlapping intervals. No automatic commute/break buffers unless explicitly configured.
- Display gaps of at least `45` minutes. Sort chronologically; show at most 3 + `View day`.
- Exclude date-only events and birthdays from busy-interval calculation; include timed classes, meetings, booked slots and user events explicitly marked `blocksTime=true`. Tentative blocking events may be included with a warning; indicate that completeness is unknown.
- Label all results **“Open in your recorded schedule”**, not “You are definitely free.” Absence of all data must show “Not enough schedule data to identify gaps,” not a 14-hour free slot.
- Clicking a gap offers `Add personal event` prefilled to the gap or `Explore bookings` (which does not assert availability). No automatically booked facility or class skipping suggestion.
- If the known schedule contains just one or no blocking event, do not show artificially long inferred gaps; prompt user to review the Calendar instead. If all windows occupied or only short gaps, show “No qualifying gaps between scheduled commitments.”

### 5.10 H-W09 — Campus Pulse

- Show at most four audience-appropriate items from birthdays, campus events, sports fixtures, club announcements and academic notices; each shows source/demonstration label and applicable event date.
- Priority ordering: important verified event changes > today's permissioned birthdays > upcoming dated campus events > recently published updates. Ties use stable IDs; no popularity algorithm.
- Birthdays require opt-in visibility and should show chosen display name plus day/month, never automatically expose birth year or contact information. A birthday is an all-day occurrence, not a timed appointment.
- Clicking an item opens actual Calendar/Community/Academics record. `Explore campus` opens `/community`.
- On birthday item details, optional one-time subtle celebration, honoring reduced-motion setting.
- No data → “No campus updates in the available records.” No fabricated club recruitment or results.

### 5.11 H-W10 — Time Tax Snapshot

- **Never display an unqualified “You saved X hours”** unless actually measured with an auditable method.
- Default: descriptive prompt + example **potential waiting-time reduction** if a scenario exists; label `Illustrative scenario`. E.g. formula and unit should be available by clicking.
- `Explore analysis` opens `/time-tax`; if actual field observations are imported, label `Observed baseline` explicitly and do not imply the intervention's realized effect is measured.
- The snapshot must not update based merely on widget clicks, browsing or opening a booking screen.

---

## 6. Personalization behavior and layout editor

### 6.1 Customize panel

- `Customize` opens an accessible right-hand drawer (desktop) or bottom sheet/full screen (mobile) with the following tabs: **Layouts**, **Widgets**, **Quick Actions**, **Display**.
- Changes are previewed immediately, with a visible `Done` button to close. **Auto-save locally** on each valid committed change; show a brief `Saved on this device` acknowledgement (not “Synced”).
- `Reset Layout` presents a confirmation explaining that it resets widget visibility/order, view preference, density, quick actions and Home filters for the active demo profile; it does **not** delete event data, orders, tasks, bookings, etc.

### 6.2 Layout presets

| Preset | Default optional widgets | Reason |
|---|---|---|
| **Balanced Campus** (initial) | All nine optional widgets | Showcase full prototype; user can simplify. |
| **Academic Focus** | Up Next, Deadline Focus, Quick Actions, My Tasks, Free Pockets, My Activity | Prioritize tasks and schedule. |
| **Campus Life** | Up Next, Quick Actions, My Activity, Mess Preview, Campus Pulse, Free Pockets, Time Tax | Prioritize services and community. |

- Applying a preset replaces current **visibility + widget order**; user must confirm because it overwrites custom ordering. Does not delete records or change calendar data.
- `Custom` label appears automatically after modifying a preset; original preset remains selectable.
- Schedule and header are always visible in every preset.

### 6.3 Widget ordering and resizing

- `Edit layout` exposes drag handles for optional widgets on desktop and `Move up/down` plus `Move to zone` controls for everyone.
- **Allowed positions:** zone 1 (Up Next, Deadline Focus), zone 2 (task/action/service widgets), zone 3 (community/analytics). Widgets may move zones through the explicit zone selector. `H-W01` schedule and `H-W00` header cannot move.
- Optional widgets have `compact`, `standard`, or `wide` width where layout supports it. On mobile, all widgets use full available width and widths are ignored without being erased from stored settings.
- Never permit a drag operation to overwrite/hide a widget. Reordering changes only an `order` array and zone/size metadata, not canonical records.
- Keyboard: focus drag handle, `Enter` to activate position editing, arrow keys or visible `Move up/down` actions; announce new placement through live region.
- On breakpoint changes, reconstruct layout deterministically from `zone`, `order`, `size` without losing data. Use one canonical saved widget order with responsive rendering rules.

### 6.4 Display preferences

- `Density`: Comfortable / Compact.
- `Schedule`: default Agenda / Week (persists).
- `Homepage filters`: see §7.
- `Free Pockets`: working window and minimum gap; validate start < end and min 15 to max 180 minutes. Suggested default 45.
- `Reduced motion`: respect system setting; optional explicit override to reduce.
- Do **not** build a theme marketplace, avatar designer, background generator, free-position pixel drag canvas or arbitrary third-party widget installer for this prototype.

### 6.5 Profile and local persistence contract

- Store preferences in local browser storage keyed by active **demo profile ID**, schema-versioned `campusos:home:v1:{profileId}`. Never store confidential institutional credentials or sensitive unconsented birthday data as publicly accessible seed files.
- Persist: layout preset/custom flag, widget visibility, order, zone, size, quick-action routes, schedule mode, date filters, density, Free Pockets settings.
- Use a storage adapter (not direct calls scattered throughout components) and runtime validation on read. Corrupt, absent, or outdated settings fall back to defaults with a quiet recovery notice; never crash the page.
- If storage is unavailable or quota exceeded, continue in temporary in-memory mode and clearly say changes may not persist.
- `Reset demo` (global) is separate from `Reset Layout` and must not be triggered accidentally.

---

## 7. Advanced filters and context-aware behavior

### 7.1 Homepage schedule filter drawer

| Filter | Options | Scope |
|---|---|---|
| Categories | Classes, Exams, Homework/Assignments, Project Deadlines, Birthdays, Mess, Clubs/Events, Sports, Personal, Bookings, Administration | Agenda / Week; optional workload widgets only where relevant |
| Course | Known courses, multi-select | Academic events and tasks; not general birthdays |
| Event status | All / Confirmed / Tentative | Schedule events; `unknown` remains visible under All with label |
| Record origin | All / Supplied / Demo / Personal | Schedule records only |
| Completed tasks | Show / Hide | Task rows and deadline summary |
| Date navigation | Today / selected day or week, prev/next | Agenda and Week, not other unrelated cards |

- “Clear filters” restores defaults and does **not** delete records. Origin filter mapping: **Supplied** = `provided`; **Demo** = `demoSeed` or `simulated`; **Personal** = `userCreated`; `connected` is reserved and unavailable until an authorized integration exists.
- Filter chips show the count or type of active filters; if filters hide all content, say “No events match these filters,” not “No events exist.”
- Quick Actions, Campus Pulse, My Activity and Mess Preview **do not automatically inherit course filters**. Each is purpose-specific.
- Accessibility: filters keyboard-operable; filter changes announce updated result count.

### 7.2 Deterministic context suggestions (no AI generation)

Suggestions are an optional mini-strip inside a relevant existing widget, **not** a new permanent banner. Maximum one suggestion visible at a time. Suggestions must be traceable to a stored record and have an actionable deep link.

| Priority | Trigger (known records only) | Text family | Action |
|---|---|---|---|
| 1 | Timed deadline within 24 h, or date-only deadline due today/tomorrow, and not personally complete | “Upcoming deadline: {title}” (for date-only records, display the date/day, never a fabricated hours-left countdown) | Open task/course |
| 2 | Booking starts within 2 h (actual recorded booking) | “You have a booking at {time}” | Open booking |
| 3 | Timed class starts within 60 min, known venue | “Next class: {title} at {venue}” | Open event |
| 4 | Meal window from supplied schedule is approaching and menu exists | “See the upcoming {meal} menu” | Open mess |
| 5 | Consented birthday for today | “It's {displayName}'s birthday” | Open permitted birthday event |

- Evaluate against current user/profile, timezone and stored data; rerank when records change or the app's clock boundary changes.
- No unsupported suggestions (“Leave hostel now,” “Best time to go,” “Court is free,” “Your friend will be there”) without corresponding verified data.
- If none qualify, hide suggestion region without empty filler.
- If events conflict, show the recorded overlap as a neutral `Schedule overlap` note; do not choose which event the student should skip.

### 7.3 Time-based adaptivity

- Date/time can change greetings, meal preview and which timed event counts as next; **do not spontaneously rearrange the card grid**.
- If a rescheduled class update is **later** injected through the final-phase backend, existing canonical views recompute; until then, only local-record changes trigger updates.

---

## 8. Data contracts (TypeScript-oriented reference)

These are **conceptual interfaces** for implementation planning. The implementation should reuse project-wide types and avoid creating a second incompatible calendar model.

```ts
type DataMode = 'provided' | 'demoSeed' | 'userCreated' | 'simulated' | 'connected';
type Verification = 'confirmed' | 'tentative' | 'unknown' | 'notApplicable';
type EventCategory =
  | 'class' | 'exam' | 'assignment' | 'project' | 'birthday'
  | 'mess' | 'club' | 'campusEvent' | 'sports' | 'personal'
  | 'booking' | 'administration' | 'meeting' | 'holiday';

type CampusEvent = {
  id: string;
  title: string;
  category: EventCategory;
  date: string;                 // ISO date YYYY-MM-DD in campus timezone
  startTime?: string;           // HH:mm local; absent if unknown / date-only
  endTime?: string;             // HH:mm local, if known
  allDay: boolean;
  blocksTime: boolean;
  recurrenceId?: string;
  sourceLabel?: string;
  sourceRecordId?: string;
  dataMode: DataMode;
  verification: Verification;
  status: 'scheduled' | 'cancelled' | 'rescheduled';
  courseId?: string;
  audienceProfileIds?: string[];
  route?: string;
  location?: string;
  updatedAt?: string;
};

type HomeWidgetId =
  | 'schedule' | 'upNext' | 'deadlines' | 'quickActions' | 'activity'
  | 'messPreview' | 'myTasks' | 'freePockets' | 'campusPulse' | 'timeTax';

type WidgetLayout = {
  id: HomeWidgetId;
  visible: boolean;
  zone: 1 | 2 | 3;
  order: number;
  size: 'compact' | 'standard' | 'wide';
};

type HomePreferences = {
  schemaVersion: 1;
  preset: 'balanced' | 'academic' | 'campusLife' | 'custom';
  scheduleView: 'agenda' | 'week';
  density: 'comfortable' | 'compact';
  quickActions: string[];       // exactly 4 unique existing route IDs
  widgets: WidgetLayout[];      // 'schedule' always visible/pinned
  filters: {
    categories: EventCategory[];
    courseIds: string[];
    verification: 'all' | 'confirmed' | 'tentative';
    origin: 'all' | 'provided' | 'demo' | 'personal';
    showCompleted: boolean;
  };
  freePockets: { start: string; end: string; minimumMinutes: number };
};
```

**Canonical record rule:** orders, bookings, tickets, tasks, announcements and birthdays need their own normalized records with stable IDs and provenance; Home uses selectors/view-models. Do not copy their entire state into `HomePreferences`. Derive event recurrences and exceptions through the Calendar layer, not `new Date()` guesswork scattered through widgets.

### 8.1 Source / truth handling

- `provided`: entered from user-supplied material; may still be tentative, outdated, incomplete, or unverified institutionally. “Provided” is **not automatically official**.
- `demoSeed`: fictional, clearly labelled sample data.
- `userCreated`: created locally by the demo user; may persist only in that browser.
- `simulated`: result of explicit demo actions; cannot assert an outside operator performed them.
- `connected`: reserved for future approved integrations; not used to label initial prototype content.
- Unknown timestamps, venues, teacher names, dates or prices **remain unknown**. Never fill them with plausible placeholders displayed as fact.

### 8.2 Cross-screen ownership

| Record type | Owner module | Home representations |
|---|---|---|
| Academic & personal events | Unified Calendar | Schedule, Up Next, Free Pockets, briefing |
| Assignment/task | Academics / Personal Tasks | Deadline Focus, My Tasks, Calendar link |
| Booking | Shared Bookings | My Activity, Schedule and calendar entry |
| Café order | Chill Spot | My Activity |
| Complaint / leave demo | Administration | My Activity |
| Meal/menu | Mess | Mess Preview |
| Birthdays and campus events | Calendar / Community | Campus Pulse and Schedule (if filter enabled) |
| Time Tax scenario | Time Tax | Time Tax Snapshot |

A mutation changes the canonical owner record once and triggers recalculation in all subscribed UI views. If a record disappears, dependent views show an appropriate empty/missing state; they do not retain stale fabricated copies.

---

## 9. Interaction event map and state transitions

| Event ID | Action | Precondition | Result | Persistence |
|---|---|---|---|---|
| H-A01 | Switch Agenda/Week | Home loaded | View changes in place; date/filters preserved | Per-profile local |
| H-A02 | Previous/Next period | Schedule present | Selected day ±1 or week ±7 | Session view state |
| H-A03 | Today | Any scheduled day | Select today's date/week in campus timezone | Session view state |
| H-A04 | Select week day | Week mode | Detail list changes to selected date | Session |
| H-A05 | Open event | Valid event ID | Open Calendar detail route/drawer | None |
| H-A06 | Apply/Clear filters | Known filter values | Results and count update without changing source records | Per-profile local |
| H-A07 | Open layout editor | Home loaded | Drawer/sheet opens with current preferences | None |
| H-A08 | Toggle optional widget | Widget not pinned | Immediately show/hide, never delete data | Per-profile local |
| H-A09 | Move widget | Editing mode, allowed location | Reorder/zone change with keyboard announcement | Per-profile local |
| H-A10 | Resize widget | Supported desktop layout | Width changes within zone without overlap | Per-profile local |
| H-A11 | Apply preset | User confirms | Replace visibility/order; retain canonical data | Per-profile local |
| H-A12 | Reset layout | User confirms | Restore Round 1 defaults; preserve domain records | Per-profile local |
| H-A13 | Edit quick actions | Valid unique implemented routes | Exactly 4 shortcuts, no duplicates | Per-profile local |
| H-A14 | Open quick action | Destination exists | Navigate to correct module | None |
| H-A15 | Open activity item | Own valid ID | Open canonical order/booking/ticket detail | None |
| H-A16 | Complete personal task | Editable user-owned task | Status changes; shared summaries recalc | Local domain storage |
| H-A17 | Undo task completion | Completed user-owned task | Restore pending state | Local domain storage |
| H-A18 | Add task | Valid title, valid optional date | Create one canonical task; relevant widgets refresh | Local domain storage |
| H-A19 | Open Free Pocket | Valid gap interval | Prefill personal event editor; do not auto-book | None until save |
| H-A20 | Open pulse item | Accessible record | Open related detail | None |
| H-A21 | Open Time Tax | Route valid | Navigate to full calculator | None |
| H-A22 | Select demo profile | Named demo profile | Load correct scoped records & preferences; warn about unsaved edit | Per-profile local |

All `navigate` actions must use the application's router; browser Back works. For deleted or inaccessible IDs, show friendly missing-record feedback rather than blank screens.

---

## 10. Core states, edge cases and failure handling

| Scenario | Expected behavior |
|---|---|
| No imported schedule yet | Helpful no-data state; permit personal entries; no fictional timetable. |
| All event filters deselected | “No events match these filters” and Clear Filters control. |
| Future assignment with missing due time | Date-only deadline, never auto-set to 23:59. |
| Tentative or revised event | Explicit tentative/revised badge; event details link to source where provided. |
| Conflicting classes/bookings | Display overlap warning, never auto-resolve or choose one. |
| Time crosses midnight | Today, deadlines, greeting and upcoming recompute in Asia/Kolkata. |
| Student travels to another timezone | UI still uses declared campus timezone unless configuration changed; label date/time when ambiguity matters. |
| Different demo profile chosen | Only profile-scoped records/preferences appear; no accidental cross-profile birthdays/tasks. |
| Missing menu or campus update | Explicit no-data state; no generated content. |
| No free intervals, or insufficient data | Correct distinct empty states; no invented open slot. |
| Widget hidden | Its data still exists and navigation remains accessible. |
| Layout invalid after software update | Sanitize stored settings, retain valid choices, reset invalid parts safely. |
| Local storage unavailable | Temporary mode with visible non-persistence note; no fake Saved message. |
| Widget drag to invalid zone | Reject move with explanation; no data loss. |
| Browser back/forward | Route and detail state remain coherent. |
| User double-clicks submit | No duplicate local task or order; disable/reconcile pending action. |
| Notification has unknown record | Show not-found message, not a broken page. |
| Current day has no timed events but has birthdays | Up Next empty; birthday appears in Campus Pulse / all-day schedule. |
| Simulated service record | Label sample/simulation, never “live” or “official”. |
| Reduced motion enabled | Remove/reduce nonessential animations while retaining state feedback. |

---

## 11. Accessibility, responsiveness, performance and reliability

- Semantic landmarks: `header`, `nav`, `main`, meaningful `section` labels; one page-level `<h1>`.
- All custom controls keyboard navigable; visible focus states; screen-reader announcements for calendar changes, filter results and widget reorder.
- Mobile touch targets target at least 44×44 CSS pixels for key controls; never rely on hover alone.
- Do not use color alone for event category or critical status; include text/icon/screen-reader labels.
- Modal/drawer focus trapped while open, restored on close; Escape closes without losing already committed settings.
- Reduced-motion supported; no autoplay animation essential to comprehension.
- Calendar text and card layouts wrap long names and preserve data without truncating critical deadline dates.
- Responsive test targets: 320, 375, 768, 1024, 1280, 1440 px. No horizontal page scrolling or overlapping widgets.
- Target Home load in <2 s on local seed datasets on a typical modern laptop as a **non-binding performance goal** to benchmark; do not claim measured speed until tested.
- Avoid expensive re-sorts on every animation; memoize normalized selectors and date calculations as necessary. Virtualization only if event counts warrant it.
- No analytics or usage tracking of actual individuals is required to make the academic prototype function.

---

## 12. Verification matrix — acceptance tests

An item is **implemented** only if the relevant tests pass, not merely because its screenshot looks complete.

| Test ID | Acceptance scenario | Pass criteria |
|---|---|---|
| H-T01 | First visit with seed data | Greeting/date correct; default Balanced Campus layout; Agenda active. |
| H-T02 | Agenda/Week switching | Same canonical events, same active filters; switch without full-page reload. |
| H-T03 | Week selection | Selecting another day shows only that day's relevant records. |
| H-T04 | Today navigation | Returns correctly from past/future dates. |
| H-T05 | Recurring class exception | Rescheduled/cancelled occurrence not duplicated as ordinary class. |
| H-T06 | Unknown assignment time | Shows date-only; no invented clock time. |
| H-T07 | Personal task completion | Deadline/My Tasks/Calendar derived views agree after toggle. |
| H-T08 | Booking creation/cancel | Schedule and My Activity update from shared record; cancel removes active booking. |
| H-T09 | Quick actions customization | Exactly four unique valid routes, persisted after reload. |
| H-T10 | Widget hide/show | Optional widgets can hide/restore without losing data. |
| H-T11 | Reordering | Desktop mouse and keyboard controls produce same persistent order; no overlap. |
| H-T12 | Presets and reset | Applying preset changes layout only; Reset Layout restores defaults without deleting tasks/bookings. |
| H-T13 | Responsive behavior | Works at target widths, no horizontal overflow, mobile alternative reordering available. |
| H-T14 | Free Pockets accuracy | Overlaps merged; all-day birthdays excluded; gaps under threshold filtered; insufficient-data warning shown. |
| H-T15 | Context suggestions | Only verified record-backed triggers; no AI or fabricated availability claim. |
| H-T16 | Birthday privacy | Only consented, appropriately scoped birthday displays; no year leakage. |
| H-T17 | Demo truth | Every sample/simulated status appropriately labelled; Time Tax is not reported as measured. |
| H-T18 | Empty data | No seed data yields honest empty states; page remains useful. |
| H-T19 | Corrupt preferences | Fallback without crash and without deleting domain data. |
| H-T20 | Restricted motion/keyboard | Core navigation, cards, filters and layout editor operable with keyboard and reduced motion. |
| H-T21 | Profile switch | Correct per-profile settings and scoped records; no cross-profile state leak. |
| H-T22 | No duplicate IDs | Multiple views of same record link to same canonical ID, not cloned copies. |
| H-T23 | Dates at boundaries | Midnight, month/year transition, and due-date-only logic correct in Asia/Kolkata. |

**Suggested test layers:** unit tests for selectors, interval arithmetic and settings sanitization; component tests for filtering/reordering; Playwright end-to-end tests for interaction and responsive workflows. Do not mark any test as passed before execution.

---

## 13. Future demo backend boundary (reservation only)

**Absolutely not part of the initial Home build.** Components must consume a repository/data-service interface so they can later observe validated changes from a small backend without UI rewrite.

Later target demonstration: a separate authenticated **Demo Operations** control changes a café order to Ready, delays a laundry delivery, updates a classroom event, or marks a complaint in progress. A student browser sees the corresponding Home, Calendar, My Activity or notification update without manual refresh; record carries `dataMode='simulated'` or a suitable future authorized source label and a trustworthy update time.

Do not use hard-coded `setTimeout()` to pretend someone accepted an order. Do not claim a backend exists before it is implemented, and do not build 26 staff dashboards.

---

## 14. Engineering handoff and prohibited assumptions

### 14.1 Build sequence for this screen (not the entire CampusOS program)

1. Shared shell + static accessible semantic layout + design tokens.
2. Stable canonical selectors and profile-scoped demo data contract; deterministic empty states.
3. Agenda/Week switch, date navigation, event detail deep links and filters.
4. Up Next, deadlines, shortcuts, activity, mess, tasks, pulse, time-tax snapshot.
5. Free Pockets interval algorithm and deterministic suggestion rule set.
6. Personalization panel: presets, hide/show, editing shortcuts, density, drag/drop + keyboard fallback.
7. Local persistence adapter + resilience to bad/corrupt preferences.
8. Accessibility, mobile, integration and acceptance testing.

### 14.2 Engineering stop conditions

Do not invent institution-specific data (class timings, birthdays, room names, menus, official permissions). Do not create a live database now. Do not implement fake network requests or pseudo-operator approvals. Do not silently change the locked behavior above. If a required record or route does not exist yet, use an explicit typed stub/empty-state boundary and document it. Never replace the core product decision with a generic template dashboard.

### 14.3 Definition of done

- All default widgets render coherently with demo or supplied data and honest labels.
- Agenda/Week and advanced filters behave correctly; date boundaries tested.
- All displayed actions navigate, mutate appropriately, or say the action is unavailable.
- Preferences, shortcuts, filters, layouts, and task state persist as documented.
- Desktop/tablet/mobile layouts tested, including keyboard and empty states.
- Live backend remains unimplemented and documented as a final-phase dependency.
- H-T01 through H-T23 each have an actual test result or explicit pending status.

---

## 15. Round 2 handoff — Unified Calendar brainstorming (NOT YET LOCKED)

The Home spec depends on a robust Calendar engine. Calendar design must now settle the following before coding:

**Calendar information layers:** class timetable; exams; homework and assignments; project milestones and presentations; consented birthdays; mess service windows and special menus; campus/club events; sports fixtures; bookings; personal plans; administrative reminders. Decide which appear by default and which are opt-in overlays so the month grid is not noisy.

**Views and event density:** month, week, day and chronological agenda; choose how many badges/markers are shown for crowded dates; whether recurring mess service windows belong in a collapsible `Campus Services` overlay rather than the main default calendar.

**Event editing and authority:** user-owned personal entries editable; imported academic entries read-only initially; demo operator update/rescheduling available only in final backend phase. Source label, tentative status and recurrence exceptions must be explicit.

**Task semantics:** an event deadline is not proof of submission; personal completion is separate from official submission. Due dates without times stay date-only.

**Birthday consent and visibility:** provide day/month, chosen display name, friend/private scope; no public birth-year list.

**Cross-module events:** bookings, sports events and assignments are projected into Calendar from canonical records; cancellations and reschedules update projections without duplication.

**Evaluation question for Round 2:** Should the Calendar be an **Academic-first** experience with campus layers toggled on, an **All-in-one** experience showing every category by default, or a **Smart layered** experience with a calm default and quick layer toggles? Recommend Smart layered, subject to user approval.

---

## 16. Revision and source-of-truth protocol

- This is the frozen **Round 1 design specification**; later implementation documents may refine technical implementation while preserving the product behavior.
- New ideas after this point must be entered as a change request with rationale, affected widgets, risk, test changes and decision. Do not silently add to scope.
- Future actual imported data supersedes sample records only through an explicit import and source mapping; it cannot rewrite user preferences or personal tasks unexpectedly.
- The data-source documents, screen mapping, and general project scope remain governed by the broader CampusOS blueprint; if an inconsistency is found, flag it in the decision log rather than silently choosing one.
