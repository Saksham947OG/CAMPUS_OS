# CampusOS — Space Reservations: Library, Music Room & Chill Zone

**Specification ID:** `COS-SPACES-001`  
**Version:** `1.0 — proposed implementation baseline`  
**Feature IDs from original brainstorm:** `F08` Library; `F19` Music Room; `F22` Chill Zone  
**Project:** CampusOS · Introduction to Business Operations · *The Time Tax*  
**Status:** Product-design proposal for review; adding this file does **not** authorize immediate implementation.  
**Target:** Functional, local-first academic prototype with controlled simulated records. Cross-client demo backend remains explicitly in the final phase.

> **Source boundary.** The group's brainstorm specifically asks for library schedule, punch-in/out, occupancy and available study spaces, room bookings, and book availability/history/due dates *if connected to a library system*; music-room availability and booking for jam sessions; and a booking idea for *approximately three* popular midnight birthday-celebration spots that otherwise work on a first-come-first-served basis. It does **not** supply the three spots' names, physical access rules, actual library catalogue, opening hours, room counts, capacities, holiday policies, equipment inventories, authorization to replace first-come-first-served access, or verified occupancy measurements. All illustrative data, book names, policies, capacities, durations and times below must be labelled **DEMO / PROPOSED**. Do not invent official campus facts.

## 1. Product objective, scope and invariants

### 1.1 Objective

Make shared campus spaces easier to find, understand and reserve; reduce avoidable unsuccessful visits and coordination overhead; provide reliable status distinctions between **published availability**, **a reservation**, **self-reported check-in** and **verified physical occupancy**. Apply the established hybrid professional × student-life design direction. Reuse the same canonical reservation architecture employed by `COS-SPORTS-001` and the in-house machine-booking part of the Campus Essentials specification.

### 1.2 Three student-facing service experiences

1. **Library:** Hours/rules; reported occupancy; individual study vs bookable group study spaces; room reservations where enabled; optional catalogue/loan-history/due-date *only if source data or an actual permitted integration exists*. A demo catalogue is explicitly fictional, not connected to a real library system.
2. **Music Room:** Published available windows; room reservation for rehearsal/jamming; optional equipment list and room-use notes *only if provided*; check-in/out as self-reported demo; closure/disruption support.
3. **Chill Zone:** Three **illustrative** celebration-spot resource cards unless actual names are supplied; midnight-crossing booking requests; overlap prevention for recorded slots; clear distinction between a **demo reservation** and institutional right to occupy a shared outdoor/public area.

### 1.3 Fixed principles

- One shared booking engine and one canonical reservation per successful booking; **no duplicate booking implementations** for Library, Music Room and Chill Zone.
- Local-first demonstrator; in-app alerts only; full external provider access, real campus enforcement and cross-browser live synchronization intentionally deferred.
- Imported/reference data is read-only to a student; local demo settings are separately labelled; students can only edit their own permitted reservations and preferences.
- Use `Asia/Kolkata` unless the project configuration specifies otherwise. Overnight intervals use actual start/end date-times; no false same-day assumptions.
- No unsupported claims: *available to book* ≠ *physically empty* ≠ *approved by institution*. A calendar entry doesn't confer permission.
- Source and freshness shown on time-sensitive data. Unknown availability or occupancy stays `unknown`, never a numeric zero.
- No unauthorised display of other students' names, room numbers, birthday details or reservation reasons.
- All seeded scenarios are deterministic and resettable, explicitly labelled DEMO, and isolated per demo profile where data is personal.

### 1.4 Non-goals

Not a real library management system; no scanning books, automated circulation, fines or payments; no actual access control, physical keys, turnstiles or physical room sensors; no verified campus permission management; no real-time crowdsourced location or covert occupancy monitoring; no privileged automated room allocation; no messaging strangers' private numbers; no event-ticket sales or external push notifications; no full studio equipment checkout; no live institutional backend until final project phase.

## 2. Site map, navigation and layout

| Route | Screen | Main content and available actions |
|---|---|---|
| `/bookings` | Shared Booking Hub | Library, Music Room, Chill Zone and previously implemented sports resources; active personal reservations; known demo-label data |
| `/bookings/library` | Library Overview | Hours / occupancy source / study areas / bookable study rooms / catalogue tab (conditional) |
| `/bookings/library/spaces/:resourceId` | Study Space Details | Room description, sourced amenities, slot grid, rules, reserve, existing personal reservation |
| `/bookings/library/books` | Books (conditional) | Search/filter imported or explicitly fictional demo catalogue; no invented real-time inventory |
| `/bookings/library/loans` | My Loans (conditional) | Source-backed or clearly simulated loans, return due dates, loan-status source |
| `/bookings/music-room` | Music Room | Sourced hours/rules, optional verified equipment, availability, book, self-check-in/out demo |
| `/bookings/chill-zone` | Chill Zone | Three demo spot cards (or true sourced spot count), availability, midnight-aware reservation, group information guidelines |
| `/bookings/my` | My Bookings | Every booking category from common engine, grouped upcoming/past/cancelled/disrupted |
| `/bookings/my/:bookingId` | Reservation Details | Exact resource, interval, record source, permission caveat, cancel if eligible, check-in when enabled |

Use existing route conventions if the codebase has equivalents; avoid duplicate alias pages. In desktop, left service summary + main availability grid + contextual rule/details pane. In mobile, facility tabs/cards → date selector → large accessible slot choices → confirmation sheet. Reuse project tokens, type, icons, status badges, forms, empty/loading/error states and reduced-motion support.

**Navigation cross-links:** Home Quick Actions / My Activity, Calendar booking entries, Notifications, optionally Time Tax, and a consistent Bookings hub. A deep link to a cancelled or unavailable booking must open the historical status rather than an empty page.

## 3. Shared canonical booking contracts

Do not introduce a second competing booking database. Inspect existing `COS-SPORTS-001` domain implementation and reuse its entities and conventions. The following are conceptual contracts, not mandatory TypeScript identifiers.

| Entity / concept | Minimum information | Invariant |
|---|---|---|
| `SpaceResource` | stable ID, service type, display name, capacity **if supplied**, location **if supplied**, provenance, time zone | Shared resource registry; number of real rooms not guessed |
| `SpaceHours` | bounded weekly availability or dated availability, exception/closure windows, as-of/source | Unknown hours never represented as open |
| `BookingPolicy` | resource ID, slot length, advance window, per-user limits, cancellation/no-show rules, approval mode | Demo defaults configurable; not institutional policy |
| `Reservation` | stable ID, owner demo-profile ID, resource ID, start and end exact timestamps, status, created/updated timestamps, source, audit events | A unique recorded reservation with ownership and chronological events |
| `OccupancySnapshot` | resource/facility ID, count or qualitative level (nullable), reportedAt, method, completeness and source | Self-report ≠ verified presence; stale/unknown status distinct from zero |
| `SpaceCheckIn` | reservation ID, check-in/out timestamps, self-reported or staff-verified method | Booking does not automatically imply check-in |
| `ResourceClosure` | resource/time interval, reason if provided, source and verification, impact on existing reservations | Prevent new colliding bookings; flag existing affected bookings |
| `SpaceEquipment` | optional sourced resource/equipment type and status | Missing equipment info means unspecified |
| `BookRecord` | stable catalog ID, title/author where provided, optional circulation status and as-of/source | No library catalogue claims without actual source or clear demo label |
| `LoanRecord` | profile ID, book ID, issue/due/returned dates where supplied, status and provenance | Do not imply a self-recorded loan is university-verified |
| `DemoSpaceOperation` | scenario ID, performedAt, actor = `demoSimulator`, operation, before/after | Simulator must be identifiable and not shown as institutional staff action |

### 3.1 Availability mathematics

Use half-open time intervals `[start, end)` for conflict calculations: existing reservation `[a,b)` overlaps proposed `[c,d)` exactly if `a < d && c < b`. A reservation ending at 18:00 doesn't conflict with another beginning at 18:00, subject to explicit turnaround buffers if later configured.

- A slot is **reservable** only if its full interval is within a published permitted window, outside known closures, and within configured booking limits/capacity.
- A successful local reservation reduces the *recorded reservable capacity*, not necessarily actual physical occupancy.
- An unbooked spot may nevertheless be physically in use; label availability as **recorded booking availability** rather than universally vacant.
- For exclusive rooms/spots, recorded concurrent accepted capacity default `1`; if real venue supports sharing, capacity and occupancy are distinct fields and must be configured with evidence.
- LocalStorage is not an atomic multi-user backend. Promise only conflict prevention within one local state/profile context; real concurrent validation belongs to final backend.
- Unknown policy/hours means offer an informational demo, not fabricated official bookability. An explicitly configured demo-hours fixture may permit *demo* reservations with a clear disclaimer.

### 3.2 Shared reservation lifecycle

`draft` → `confirmedDemo` → optional `checkedInSelfReported` → optional `completedSelfReported`.

Alternative transitions: `draft` abandoned; `confirmedDemo` → `cancelled`, `noShowSimulated`, or `disrupted` (with documented resolution). Completed/cancelled reservations remain in history; no status backdating without audit. If a configured resource requires approval, model `requestedDemo` → `confirmedDemo`/`rejectedDemo`, with explicit simulated approval and no institutional implication.

**No hidden operator action.** An idle browser must not silently mark someone's physical departure, machine/room occupancy, staff approvals or return of a key. Evaluate elapsed-time conditions deterministically but use visible, simulator-authorized transitions for no-show and handover events.

### 3.3 Defaults (team-review proposals, NOT actual campus rules)

| Parameter | Illustrative value | Requirement |
|---|---|---|
| Advance reservation horizon | 7 days | Configurable by resource; label DEMO |
| Active future reservation limit | 2 per profile across these space services | Configurable; cross-module existing limits remain separately scoped unless expressly unified |
| Library group-room slot | 60 minutes | Example; never claim actual campus rule |
| Music-room slot | 90 minutes | Example; configurable |
| Chill Zone celebration slot | 30 minutes, capable of crossing midnight | Example; do not assume occupancy rights |
| Check-in grace interval | 10 minutes | Demo rule; no invisible physical vacancy claim |
| Cancel window | Up to slot start for demo | Actual policy unknown; show configurable demo label |
| Midnight start example | 23:45 → next-day 00:15 | Use timezone-aware exact date-time; verify date rollover |

Existing Sports policy defaults may differ and must not be overwritten. Reuse common engine but configure policy per service and resource. The above values cannot silently be adopted as university regulations.

## 4. F08 — Library experience

### 4.1 Information architecture

Four subsections under Library, with conditional visibility:

1. **Overview:** library location if provided, opening schedule, special closures, reported occupancy/last-updated/source, a clear explanation of what is measured, and navigation to spaces and catalogue.
2. **Study Spaces:** sourced or demo-labelled space list; individual/general reading areas may be informational rather than reservable; group rooms have slot booking only where configured.
3. **Catalogue:** only show book records from actual supplied source or explicitly seeded fictional/demo book data. Search, titles, optional author and status; absence of integration prominently acknowledged.
4. **My Loans:** only show actual user-provided, permitted loan data or obviously fabricated demo loan records. Show due dates and in-app reminders where source-backed; cannot certify returns or fines without authoritative system.

### 4.2 Library UI

- Library header with reading-room atmosphere (restrained image or icon, no huge decorative hero), hours-source indicator, occupancy/availability card with `unknown` state.
- Split view for **Study Spaces** vs **Books & Loans**, avoiding a single huge mixed listing.
- Resource cards: room name/code **only when provided**, group capacity **only when sourced**, published amenities, booking status, purpose; opening times not invented.
- Date and time selector uses the shared Booking UI. Student selects slot, reviews guest count/room constraints if defined, confirms demo booking, receives stable reference.
- Book search uses available data only. If no real books supplied, show a demo library catalogue with explicit DEMO banner or a meaningful `Catalogue not connected` state; don't fabricate real titles/availability.
- On loan details: separate student-entered notes from verified circulation data; date-only due dates don't gain invented due times; no automatic overdue fine claims.

### 4.3 Library occupancy and punch-in/out

Occupancy is a sourced snapshot: **self-reported, sample historical, simulated, or verified if actual source later exists**. Check-in/out on demo-profile can update a local self-reported counter only if the logic accounts for duplicate check-ins and active sessions. It must not imply all physical users are counted. A room reservation does not equal attendance, and an absence of active check-ins doesn't prove the library empty.

- One active self check-in/session per profile per facility; duplicate click idempotent.
- No auto-checkout on page close. An abandoned session can be flagged stale; don't infer physical presence indefinitely.
- Show `reportedAt` and scope of counts, or explicit unknown.

### 4.4 Library-specific edge cases

- Lending catalogue unavailable → honest empty/unconnected state; study-space booking still works in demo.
- All bookable rooms reserved → no slots available; optional alternate day; no fictional seats.
- Room closure appears after booking → mark reservation disrupted and notify; don't silently relocate.
- Book marked `available` in a snapshot → not guaranteed physically on shelf now.
- Due date updated from source → same canonical loan updates reminder; no duplicated loan.
- A student lacking book-loan access → no leakage of another profile's history.

## 5. F19 — Music Room experience

### 5.1 Main student page

- Header: *Music Room — Reserve a jam session*; available date picker / resource summary / sourced opening hours and access rules.
- Single bookable room unless actual source lists multiple; do not assert instrument inventory, acoustic conditions or capacity without evidence.
- Distinguish `Free to reserve in recorded schedule`, `Reserved`, `Closed` and `Unknown physical occupancy`.
- Basic booking: choose permitted slot, optionally label session privately (`Jam session`, `Practice`), optionally invite/group-size **if allowed by configured policy**, confirm local demo booking, show details and Calendar entry.
- Check-in/out via self-report where enabled; reported occupancy distinct from future booking.
- Existing reservations show time windows but **not** student identities or private session notes to unrelated profiles.

### 5.2 Optional equipment and facilities panel

If staff or user supplies a reliable inventory, show instrument/equipment type and operational status. Otherwise display `Equipment information not supplied`. Do not create an inventory from general assumptions or imply microphones, amps, drums, or soundproofing exist. Equipment fault reports later link to `F12/F14` ticket engine without copying that workflow into Music Room.

### 5.3 Music-specific safeguards

- Bookings across class and other reservations can trigger **Calendar overlap warning**; intentional personal overlaps allowed when booking rules permit.
- Future source-based maintenance closure blocks new intervals and flags existing reservations.
- A group leader's cancellation affects their booking, not another profile's unrelated events.
- Session lasting longer than the reserved slot isn't automatically authorised; no claim actual room is physically vacant at end time.
- No audio capture, recording or microphones needed for the prototype.

## 6. F22 — Chill Zone birthday-celebration spots

### 6.1 Source-derived purpose and boundary

Group noted **about three** commonly used spots for midnight birthday celebrations, which can be busy in September and are currently used roughly first-come-first-served. CampusOS explores whether a booking schedule *could* improve coordination. **It cannot unilaterally replace campus access rules or guarantee exclusive use.** In prototype, all reservations are demo coordination requests/records until an authorized institution adopts a process.

### 6.2 Chill Zone landing and booking

- Warm celebratory but not childish aesthetic; three illustrative spot cards `Demo Spot 1–3` without fabricated geographic names or photos of actual locations. Replace with supplied official names only after verification.
- Date selector designed for evening and midnight; explicit start and end **date-time** labels, e.g. `Sat, 14 Nov 11:45 PM → Sun, 15 Nov 12:15 AM` (illustrative only), never just `12 AM` without date.
- Availability card lists already recorded local demo reservations, not guaranteed physical vacancy or campus rights.
- Book button opens review: spot, local start/end, hypothetical demo slot policy, optional party-size indicator if sourced/configured, minimal private occasion label, privacy disclaimer.
- On save: conflict validation; create demo reservation; view in My Bookings and Calendar spanning correct dates; optionally attach birthday personal event only with permission and explicit user choice.
- Student can cancel their own demo coordination reservation and receive in-app confirmation. A disputed or over-capacity real-world situation would require actual staff policy; do not auto-enforce rights.

### 6.3 Midnight, crowding and fairness

- Use normalized exact date-time intervals across day/month/year boundaries (including Dec 31 → Jan 1). Define a start-date policy in the UI and show start/end dates visibly.
- Same resource cannot hold two overlapping exclusive **recorded demo** reservations; adjacent intervals can be allowed unless a turnaround buffer is configured.
- A `Reserved in demo` tag must not mean the area is exclusively allocated by college authorities. This matters particularly if the real spot is a public/shared open space.
- Two requests competing for same slot in a single local store: first successful validated write wins; the other receives an explicit conflict message. Cross-device race resolution only in the final backend.
- No public guest names, birthday person identities, private group lists or sensitive event details in availability cards.
- Offer alternatives (other available demo spots/times) but do not promise the spots are officially bookable.

## 7. Shared interactions, notifications and cross-module contracts

### 7.1 Student journeys

**Library:** Bookings → Library → Study Spaces → select source/demo-labelled room & slot → review policy → confirm → My Bookings / Home My Activity / Calendar event → optional reminder and demo self-check-in → completion/cancellation status, audit kept.

**Music:** Bookings → Music Room → select date/slot → review privacy and equipment information if sourced → confirm demo reservation → Calendar / Home → optional self-report check-in / check-out.

**Chill Zone:** Bookings → Chill Zone → choose labelled spot → choose cross-midnight interval → explicit review of *demo-only* access → confirm recorded coordination reservation → Calendar spans both dates → student can cancel.

### 7.2 Event to display mapping

| Source record change | Calendar | Home | Notification Center |
|---|---|---|---|
| Confirmed local demo booking | Exactly one generated booking occurrence linked by ID | My Activity / upcoming booking | `Demo reservation recorded` |
| Cancelled booking | Same canonical record marked cancelled; user views can hide by preference but history remains | Active booking removed; history accessible | Cancellation notice |
| Service closed or resource disrupted | Affected booking retains ID and shows conflict/disrupted state | Flag affected upcoming booking | Source-labelled disruption notice |
| Student self-check-in/out | No new distinct duplicate booking event | Current activity optionally updated | Only on explicit configured trigger |
| Loan due date from source | Optional date-only personal reminder, not a fabricated fixed-time event | Academic/service reminder if opted in | In-app reminder only with proper status/source |

No automatic creation of a second, competing booking record on the Calendar. No automatic birthday event from a Chill Zone reservation. A booking cancellation changes its canonical status; dependent views derive from that status, and only one notification per uniquely identified event/transition.

### 7.3 Suggested default in-app reminders (configurable)

- Upcoming reservable-space booking: `30 minutes before` only when exact time known and profile enabled; a date-only reservation is invalid.
- Library book return due date: `9 AM on preceding local calendar day` if due date exists **and** source is known; not an invented 9 AM due time.
- Resource/room closure affecting booking: alert when a *recorded* closure is applied, no invented external notification delivery.
- Chill Zone birthday booking: 30 minutes before booked interval; birthday greeting separate from booking and opt-in.

Reminder delivery in the initial prototype means in-app visibility when the app runs/reopens; it is **not** push while browser is closed or a sent message to a real provider. Deduplicate by `(profileId, eventType, recordId, transitionId)` or equivalent.

### 7.4 Settings and privacy

- Per-demo-profile display preferences and reminders persist in local storage.
- Availability for a booked resource may show `Reserved`, but must not expose who reserved it or why.
- Student cannot mark staff-confirmed clearance, physical security access or official institutional approval.
- `Reset Demo Data` clears only demo-created personal state and resets labelled scenario seeds according to the existing project's reset contract; do not erase user-supplied/imported source files.

## 8. Shared availability UI and accessibility

### 8.1 Desktop layout

1. Header breadcrumb `Bookings / [service]`, title, description and demo badge.
2. Availability summary and source/freshness label.
3. Select resource and date; week-strip or time-slot grid with legend.
4. Persistent selection summary: resource, exact date/time and policy (as demo when applicable).
5. Confirm dialog; then booking detail with ID, cancel action, manage calendar link.
6. Secondary information in tabs (library loans/catalogue, music equipment, celebration guidelines).

### 8.2 Mobile layout

- Facility selection as compact card/tab; calendar strip and large touch targets; resource status never color-only; confirmation as bottom sheet with scroll-safe action.
- Overnight Chill Zone slots must show both calendar dates even in compact cards.
- Keyboard focus, correct button labels, accessible modal/dialog focus management, visible validation errors, reduced-motion support and layout testing at multiple widths.
- Empty/loading/error states are intentional: `No spaces available in this demo`, `Hours not supplied`, `Catalogue not connected`, `Occupancy not verified`.

## 9. Time Tax — service-specific operations metrics

No unverified claim of minutes saved. Provide an **interactive scenario** and later optionally a field-observation mode, each distinctly labelled.

| Service | Plausible improvement | Required evidence | Non-claim |
|---|---|---|---|
| Library study spaces | Reduced failed visits to full/unavailable bookable rooms | Failed-visit baseline, arrival and availability observations | A reservation doesn't create extra seats |
| Music Room | Reduced coordination and waiting to find a free jam session slot | Attempts per successful session, search/coordination time | Booking doesn't guarantee equipment availability |
| Chill Zone | Reduced scheduling disputes and time searching for an available spot | Attempts, conflicting gatherings, coordination time | App doesn't grant institutional exclusivity |

**Scenario formula:** `potential person-minutes avoided = eligible visits × max(0, baseline wait/coordination minutes − hypothetical intervention minutes)` where comparison definitions and assumptions are visible. If recording failed trips, avoid counting the same journey twice across multiple categories. Convert to student-hours by dividing person-minutes by 60; never show projected hours as measured actual results. A reservation confirmation cannot by itself prove time saved.

## 10. Demo scenarios / local simulator

**Demo Scenario L — Library room full:** Two seeded illustrative group rooms, one already booked; student attempts same slot and gets a recorded conflict; picks alternate slot; Calendar/Home reflect it. Do not assert real room count.

**Demo Scenario M — Music disruption:** Student books music room; explicitly labelled demo control records a closure in the reserved interval; reservation is flagged disrupted and an in-app alert appears. No phantom staff action.

**Demo Scenario C — Midnight birthday:** Three demo spots, one reserved `23:45–00:15` crossing midnight; user inspects both dates; competing booking is rejected; alternate spot available in same local scenario. Confirmation says recorded *demo* slot, not campus approval.

Local simulator lives in an existing demo-only Settings / Operations surface or clearly gated panel, following Chill Spot's design. It should not become three full operator dashboards. Each action has before/after records and audit trail. Real separate-device updates intentionally deferred.

## 11. Failure cases and required responses

| Situation | Expected behavior |
|---|---|
| No official library timetable | Mark hours unknown; show demo scenario separately |
| Library book catalogue unavailable | Do not invent book availability; provide clear unconnected state |
| Self-reported library occupancy stale | Display source time/stale or unknown; never 'empty' |
| Room booked but no check-in recorded | Keep recorded reservation; no inferred physical use |
| Cancellation after start time | Apply configured demo rule and explain; no silent deletion |
| Two bookings collide in same local store | Reject second if capacity exceeded; show conflicting interval |
| Closures overlap existing reservations | Mark disruption; notify; don't silently assign another room |
| Group size exceeds sourced capacity | Block and show configured cap; if capacity unknown don't invent a cap |
| Music room equipment is missing or faulty | Show 'unverified' or sourced fault, not guaranteed equipment |
| Chill Zone is a first-come public spot | Label reservation illustrative, never institutional permission |
| Reservation crosses midnight | Store end on next date; appear correctly on both dates and in checks |
| Birthday isn't shared publicly | Do not expose person or date to another profile |
| User closes/reopens app | Personal demo reservations and preferences persist per project rules |
| Browser refresh while booking | No duplicate confirmed booking or phantom hold |
| Notification delivery unavailable | Persist action and show in-app status; no external delivery claim |
| No slots available | Empty state with alternate date/service, no false success |
| Existing shared booking code differs from this draft | Adapt to canonical engine and record discrepancy before implementation |

## 12. Suggested implementation sequence (incremental)

- **SR-0 — Dependency review:** Inspect current Booking engine, sports/washer resource policies, Calendar data adapters, Home My Activity, Notifications, demo Settings and reset mechanism. Identify conflicts; don't create second engine.
- **SR-1 — Shared domain extension:** Add configurable `space` resource metadata and policy, closure handling, timezone-safe overnight intervals, sourced availability and privacy fields. Add type-safe validation and deterministic demo fixtures.
- **SR-2 — Library:** Sourced vs demo hours; bookable rooms; availability/booking; occupancy information; optional guarded catalogue/loans. Tests.
- **SR-3 — Music:** Room detail/booking, optional equipment section, self-check-in/out, disruption simulation. Tests.
- **SR-4 — Chill Zone:** Three clearly fictional placeholder spots, midnight-aware booking, cross-date calendar entry, conflict handling, institutional-permission caveat. Tests.
- **SR-5 — Integration and QA:** Home, Calendar, Notification Center, Time Tax scenario hooks, reset, accessibility, mobile, documentation; visual inspection and manual scenarios.
- **FINAL PROJECT PHASE ONLY:** small backend with shared records, staff/demo updates and cross-client synchronization. No backend/API or real staff dashboard in this module's initial phases.

Every SR phase must have a test report and explicit sign-off; don't skip earlier accepted work or overwrite sports booking policies.

## 13. Acceptance tests (`SR-AT-*`)

Status: **planned acceptance criteria**, none claimed executed merely by being in this file.

1. **SR-AT-01:** All three modules reachable from existing Booking Hub and appropriate navigation.
2. **SR-AT-02:** Library/Music/Chill Zone reuse canonical booking logic rather than maintain parallel reservation stores.
3. **SR-AT-03:** Every service displays data provenance and unknown/last-updated states as applicable.
4. **SR-AT-04:** No actual campus names/hours/equipment/fees/capacities are fabricated.
5. **SR-AT-05:** Library shows spaces and can open details for supplied or labelled demo rooms.
6. **SR-AT-06:** Eligible demo group-room reservation creates exactly one canonical reservation.
7. **SR-AT-07:** Library occupancy distinguishes self-report from verified presence and unknown from zero.
8. **SR-AT-08:** Duplicate library self-check-in does not increment occupancy twice.
9. **SR-AT-09:** Missing real catalogue renders unconnected state or explicit fictional demo content.
10. **SR-AT-10:** Loan due dates remain date-only; no invented due hour, fine or return confirmation.
11. **SR-AT-11:** Student cannot access another profile's private loan history.
12. **SR-AT-12:** Music booking validates slots, permitted hours and capacity from configuration.
13. **SR-AT-13:** Equipment unknown displays unknown, not an invented inventory.
14. **SR-AT-14:** Music closure blocks new colliding demo bookings.
15. **SR-AT-15:** Music closure affecting existing booking preserves record and marks disruption.
16. **SR-AT-16:** Music session checkout is not inferred merely from end time.
17. **SR-AT-17:** Chill Zone shows three explicitly labelled demo spot cards until actual sources supplied.
18. **SR-AT-18:** Chill Zone booking can cross midnight without losing the next day's portion.
19. **SR-AT-19:** Two overlapping exclusive recorded Chill Zone reservations cannot both confirm locally.
20. **SR-AT-20:** Adjacent non-overlapping slots pass if configured turnaround rules allow.
21. **SR-AT-21:** Chill Zone confirmation explicitly states no institutional access authorization.
22. **SR-AT-22:** No other student's identity or birthday appears in public availability.
23. **SR-AT-23:** A booking produces one Calendar-linked occurrence and Home My Activity entry.
24. **SR-AT-24:** Cancellation updates canonical record and all linked views without duplicate records.
25. **SR-AT-25:** Booking disruption generates one deduplicated in-app alert with a deep link.
26. **SR-AT-26:** Slot-reminder settings are per profile and cannot falsely claim push delivery while closed.
27. **SR-AT-27:** Per-profile demo reservations and settings persist across refreshes.
28. **SR-AT-28:** Reset restores deterministic seeds without modifying imported source data.
29. **SR-AT-29:** Keyboard navigation and dialog focus work on all main booking forms.
30. **SR-AT-30:** Mobile layout at narrow widths displays exact intervals without clipping critical actions.
31. **SR-AT-31:** Time Tax scenario calculation is correctly labelled hypothetical and has transparent assumptions.
32. **SR-AT-32:** An unknown-source facility cannot be presented as officially reservable.
33. **SR-AT-33:** Student cannot directly mark institutional approval or staff-verified presence.
34. **SR-AT-34:** Invalid intervals (end <= start; non-existent DST/local dates if later TZ supported) fail validation, with cross-midnight handled by explicit next-day end date.
35. **SR-AT-35:** No regression to Sports/Gym/Laundry booking tests, Home and Calendar integration.

## 14. Decisions and unresolved real-world inputs

### Confirmed by user/group

- Include F08 Library study-space availability/booking and conditional catalogue/borrowing capability.
- Include F19 Music Room booking for jams and similar sessions.
- Include F22 Chill Zone coordination for approximately three commonly used midnight birthday spots.
- Use modular, phased implementation with shared booking infrastructure.
- Academic working prototype first, explicitly simulated data and no live operator backend until final phase.
- Hybrid professional × student-life visual design.

### Proposed defaults for implementation planning (reviewable)

- Shared Booking Hub / subroutes; seven-day horizon; 60-minute library room slots; 90-minute music slots; 30-minute celebration slots; ten-minute grace; two upcoming space bookings per profile.
- Library catalogue/loan tabs hidden or display an unconnected state until trustworthy source or clearly labelled demo data is present.
- Student self-check-ins optional and labelled self-reported; simulated maintenance closures kept behind explicit demo control.
- Chill Zone reservations are *demonstration coordination records*, never real space allocation.

### Inputs to acquire later; do not block the current demo

- Library actual hours, study-room count, booking policy, book catalogue integration, privacy and borrowing records.
- Music Room name/location, permitted hours, equipment list, capacity and usage/approval policy.
- Chill Zone actual three spot names/locations, any rules about late-night access, capacity and whether reservations would be permitted by campus management.
- Real student-waiting observations if we want measured rather than projected Time Tax improvements.

**Implementation readiness:** This specification is detailed enough to plan and implement clearly labelled local demo flows; it is **not** permission to assert official operational facts. Register this under `docs/features/`, cross-check against shared booking interfaces, and implement only in its explicitly approved phase.
