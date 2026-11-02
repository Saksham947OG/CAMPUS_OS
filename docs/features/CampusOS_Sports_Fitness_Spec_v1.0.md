# CampusOS — Sports & Fitness: Gym, Badminton and Other Sports

**Specification ID:** `COS-SPORTS-001`  
**Version:** `1.0 — proposed implementation baseline`  
**Original brainstorm feature IDs:** `F04` Gym; `F06` Badminton; `F07` Other Sports (table tennis, pool, basketball)  
**Project:** CampusOS · Introduction to Business Operations · The Time Tax  
**Implementation target:** interactive, local-first academic prototype; small cross-client demonstration backend deliberately deferred to the **final project phase**.  
**Approval status:** **Proposed for review**, not automatically added to current implementation scope.

> **Source boundary:** The group brainstorm explicitly requests gym schedule, punch-in/out, equipment availability/maintenance, optional capacity-limited gym slots and occupancy; badminton court hours, individual/group booking, future-booking limits, no-show release, cancellations and waitlists; and coverage of table tennis, pool and basketball. It does **not** provide verified facility names/counts, hours, slot lengths, capacities, no-show policies, operator procedures, equipment inventories or measured wait times. All numbers and example rules below are **configurable DEMO defaults**, never institutional policies. Future sports fixture/team signup is original feature **F24** and remains a separate Community/Sports Events scope; it is not silently implemented here.

## 1. Vision, principle and non-goals

**Purpose:** Show students when campus sports facilities are published as open, help them reserve eligible resources, check in/out, see relevant maintenance disruptions, avoid unnecessary trips, and understand where potential waiting can be reduced. Integrate bookings into Home → My Activity, the unified Calendar, in-app Notifications, and the Time Tax scenario model.

**Core architectural principle:** one **shared, typed resource-booking engine** configured for distinct facility types; three student-facing experiences. Gym occupancy is **not** synonymous with booked capacity; badminton is a court/slot reservation; other sports may differ by activity and whether the resource is bookable.

**Out of scope for this module:** verified sensor-based occupancy; actual institutional booking authorization; access control at a physical court/gym; digital key/turnstile; payments; external push delivery; automatic confirmation of a player's physical presence; sports tournaments, team recruitment, match fixtures or results (`F24`); real incident/maintenance operations dashboards; AI-generated wait estimates; automatic high-stakes enforcement; live operator backend. Links to upcoming `F12` complaint tracking and `F24` fixtures may be honest placeholders until specified.

**Fixed invariants:** `Asia/Kolkata`; no invented campus facts, exact live counts or published rules; stable canonical IDs; provenance (`provided`, `demoSeed`, `userCreated`, `simulated`) separate from verification; per-profile privacy; local-first, deterministic demo scenarios; no automatic fake provider/operator activity; no invisible mock-status advancement. Existing approved Home/Calendar/Chill Spot and proposed Campus Essentials behavior must not break.

## 2. Sitemap and shared navigation

| Route | Screen | Main information and actions |
|---|---|---|
| `/bookings` | Bookings hub | Gym, Badminton and Other Sports cards; next personal bookings, status and a clear demo label |
| `/bookings/gym` | Gym | Schedule, reported occupancy, capacity when provided, available eligible sessions, equipment/closures, check-in/out demo |
| `/bookings/badminton` | Badminton | Court/date selector, slot grid, partner or group field, reserve, cancel, waitlist, my reservations |
| `/bookings/sports` | Other Sports | Activity selector: Table Tennis / Pool / Basketball; per-activity resource cards, availability/booking where configured |
| `/bookings/resources/:resourceId` | Resource detail | Location (if provided), opening information, rules, published availability, bookings, closure status, freshness |
| `/bookings/my` | My Bookings | Active, upcoming, past, cancelled and disrupted records; deep links to booking detail |
| `/bookings/my/:bookingId` | Booking detail | Resource, time, members if permitted, check-in state, cancel action, timeline and Calendar link |
| `/bookings/waitlist` | My Waitlists | Position only when grounded in complete local demo records, offers, accept/decline and status |

The sidebar entry is **Bookings**; Gym/Badminton/Other Sports appear as obvious tabs/cards. Shared profile selector and Demo Mode indicator remain part of application shell. Never present a non-implemented destination as a working page. The latest valid booking record, not a copy in Calendar or Home, is authoritative.

### Visual direction

Preserve CampusOS **hybrid professional × student-life** design: warm paper canvas, deep-ink type, teal positive action, terracotta for warnings, restrained category accents. Use a compact weekly slot grid, accessible status badges, clear empty/unknown states, and responsive mobile-first resource cards. Sports-specific personality should come from simple sport imagery/icons and useful context; do not build a disconnected sports-themed mini-site. Avoid decorative sport images that obscure availability data.

On desktop: resource summary on left, main date/slot grid center, contextual rules and current booking on right. On mobile: activity/category tabs above date selector and accessible slot cards; booking review in sheet. Keyboard users must be able to select dates/slots and operate menus; reduced-motion and contrast settings respected.

## 3. Booking-domain design — the shared engine

### 3.1 Core entities (conceptual; exact TypeScript names may match existing architecture)

| Entity | Required concepts | Important distinction |
|---|---|---|
| `Facility` | `id`, name, type, published location/hours, status/source/as-of, timezone | Gym ≠ court ≠ shared sport space |
| `Resource` | `id`, `facilityId`, category, unit label, configured capacity, rules, maintenance status | A badminton court, TT table, pool table, basketball court or gym session |
| `ResourceAvailabilityRule` | resource ID, recurring hours or explicit windows, closures and exceptions | Published slot availability is not verified physical vacancy |
| `BookingPolicy` | slot minutes, advance horizon, per-profile limit, grace period, cancel window, group size | DEMO defaults unless campus confirms |
| `Reservation` | stable ID, resource ID, owner profile ID, exact start/end timestamps, status, members, provenance, created/updated timestamps, audit trail | Booking engine is source of truth |
| `AttendanceRecord` | booking/profile ID, self-check-in and out timestamps, method, verification label | Self-report does not equal verified presence |
| `OccupancySnapshot` | resource/facility ID, count or level, method, recordedAt/asOf, completeness | Missing count means UNKNOWN, never zero |
| `EquipmentReport` | equipment ID/type, status, report source/time, linked complaint ID if available | A fault report is not a verified completed repair |
| `WaitlistEntry` | resource, requested slot, profile ID, queue sequence, offer state, createdAt | Waitlist is not a confirmed booking |
| `DemoOperation` | operator simulation action, actor label, scenario, previous/new state, timestamp | Audit local simulation separately from real-world actions |

Each owned record must also carry the project's `dataMode` and permitted audience. Do not add actual students' IDs, personal phone numbers, precise location tracking, or sensitive profile details to public demo fixtures.

### 3.2 Reservation versus physical use

The following are distinct:

1. **Published availability:** service hours and no conflicting *recorded* booking; may still be wrong if real usage is untracked.
2. **Reservation:** profile holds a defined interval, subject to policy.
3. **Check-in:** student self-reports arrival; never label this automatically verified.
4. **Occupancy/use:** directly reported/simulated indicator; not necessarily implied by reservation or check-in.
5. **Maintenance closure:** blocks new reservations and flags affected existing ones.

Do **not** turn `reservation expired` into `court is physically empty`; do **not** turn `no reservation` into `gym has zero users`.

### 3.3 Default reservation lifecycle

`confirmedDemo` → `checkedIn` → `inUse` → `completed` as applicable. Alternative terminal outcomes: `cancelled`, `noShow`. A new service disruption is tracked with a separate `disrupted` flag/event until a clearly authorized simulator action resolves/rebooks/cancels it. Some activities may not need separate `inUse` and `checkedIn` stages; avoid fabricated steps.

**Student actions:** select a published resource and slot, review constraints, confirm local demo reservation, inspect, cancel if eligible, self-check-in/out where enabled, join/cancel waitlist. Student cannot directly mark a maintenance issue repaired, verify their own presence as staff-confirmed, or declare a physical court free for others.

**Simulator-only actions:** seed recorded occupancy, record facility opening/closure, simulate no-show expiry, staff check-in confirmation, resolve a maintenance issue, process waitlist offers. Clearly separate controls from the student UI; no automatic invisible status timers.

**No auto-advance:** A clock passing the slot start does not prove arrival or use. An end time does not prove the court is clear. Grace rules may be *evaluated* deterministically, but any demo action that releases/updates a physical state should be explicit and visible.

### 3.4 Validation and fairness

- A new reservation requires resource ID, student profile, start and end, eligible local date/time, allowed opening window, non-closed resource, and rule compliance.
- Exclusive-capacity slots may not exceed configured concurrent capacity. A basketball court with a one-group reservation is not eight independent guaranteed court reservations.
- Reservation intervals overlap when `max(startA,startB) < min(endA,endB)`; adjacent slots do not overlap, though a configured turnover buffer may apply.
- Use deterministic local repository checks, including conflict among the selected profile's own bookings. These prevent collisions only within the **same local data source**, not across disconnected browsers before the final backend.
- The app may warn about collision with known academic commitments (via Calendar), but the user may save an otherwise valid reservation with a schedule warning unless the resource's own policy prohibits it.
- A failed save must preserve form contents. Duplicate clicks must not create duplicate reservations: disable during save and use an idempotency key.
- A waitlist entry is not equivalent to a reservation. Show honest queue semantics; never promise a place until explicitly offered/accepted/confirmed.
- Cancellation must release the recorded reservation without marking the physical resource empty. Follow explicit policy, with a stored cancellation reason only if needed.

## 4. Gym (F04)

### 4.1 Student experience

Top section: published hours, *reported* occupancy status and its source/as-of time, closure banner if any, next eligible session (only if capacity rules are configured), equipment and maintenance notices. Sections: `Overview`, `Sessions / Bookings` (conditional on configured capacity booking), `Equipment`, `My Visits` (self-reported demo check-ins).

**Primary CTA:** `Check published hours` or `Book demo session` depending on configured policy; never show a fake bookable schedule when none exists. If no gym capacity or slot rules are supplied, show a **labelled demo schedule** or honest `Booking rules not provided` state.

### 4.2 Occupancy and punch-in/out

Optional student `Check in` / `Check out` records local self-reported presence for the current demo profile. The interface must prominently say **Self-reported demo count**, **Simulated snapshot**, or **Unknown**. A user's self check-in does not create a verified headcount or live access event. Prevent repeated active check-ins by the same profile; allow explicit correction or check-out. Do not silently auto-check-out at closing time.

Snapshot example display (FICTIONAL ONLY): `Reported active check-ins: 7 · Demo dataset · As of 16:20`. If source does not cover all users, avoid occupancy ratios or `7 of 20 seats occupied` unless both count and capacity are specifically supported and the data's completeness is qualified. We may show a simulated `Quiet / Moderate / Busy` label only if demo thresholds and data provenance are visible.

### 4.3 Equipment and maintenance

Each configured equipment item can be `reportedAvailable`, `reportedUnavailable`, `underMaintenance`, or `unknown`. Student can browse, see last update, and report a fault through the future shared Complaints workflow (`F12`), or a **clearly labelled local demo report** if independently specified. An equipment fault is not necessarily a whole-gym closure. An authorized simulator can disable a resource and link to the complaint ticket when that module exists. Never claim a technician was dispatched or a repair completed without action/source.

## 5. Badminton (F06)

### 5.1 Core workflow

Select **date** → choose **court** → view eligible **time slots** → optional partner or group → review rules and any known academic conflicts → `Confirm demo reservation` → booking detail, Calendar projection, Home My Activity, in-app confirmation notification. Users can revisit or cancel; cancellation follows rules and may release a slot to the waitlist.

Use a clear distinction between **court label**, **sport activity**, and **partner details**. A partner is not an additional booked court. If a partner has not accepted an invitation, show `Partner listed (unverified)` rather than an authenticated acceptance. Do not expose profile details without permission. The prototype can avoid invitations entirely and use an optional text/display-name field labelled personal notes.

### 5.2 Waitlist design

A full slot may offer `Join demo waitlist`. Store a deduplicated entry per owner/resource/slot with creation sequence. When an eligible reservation cancels, the simulator can generate an offer to the earliest eligible recorded entry under the **explicitly configured demo queue policy**. `Waiting` → `Offered` → `Accepted`/`Declined`/`Expired`; once `Accepted` passes reservation-capacity validation, create one confirmed reservation. An unaccepted offer does **not** immediately grant ownership. A clearly labelled default offer lifetime is configurable and should not be silently enforced by a nonexistent background worker. Any queue position shown is only relative to *recorded local demo entries*. If the list is incomplete, don't display an exact campus-wide rank.

### 5.3 No-show and fair access

Proposed demo defaults, **not official policies**: maximum **two future badminton reservations** per profile, a **10-minute check-in grace period**, and reservations up to **seven days ahead**. Preserve these as configurable example values, not unchangeable institutional rules. When an eligible no-show is explicitly processed by the simulator, the *booking claim* is released; no assertion that the court is physically vacant is made. On-site use may require a separate check-in/occupancy action.

The system must prevent a student from making multiple simultaneous reservations for the same exclusive court under the same or duplicate profile action. Separate demo profiles in separate browsers have no real concurrency protection until final backend deployment.

## 6. Other Sports (F07): Table Tennis, Pool, Basketball

Present three activity cards under `/bookings/sports`, each with optional published rules, location (only if supplied), available demo resources, and deep links into the shared booking screen.

**Table tennis:** resources are tables; a slot may optionally record participants or partner. **Pool:** resources are pool/billiards tables (confirm intended meaning from actual campus data before final labeling); a slot may show single group reservation. **Basketball:** resources are courts, and a single slot may reserve a full court for a group; it does not automatically implement team formation, lineup management or fixture scheduling (`F24`).

Rules are *data-driven per resource*, not blindly copied from badminton. If the relevant sport is not actually reservable on campus, show hours/information and an explicitly disabled `Booking not configured` action. Do not silently invent a court or table count, hours, groups, fees, equipment or operating procedures.

Optional participant count must respect configured resource/group size, when known. If no participant limit exists in source records, don't claim an official one.

## 7. Interactive simulation and demo scenarios

All data-driven scenarios clearly expose **Demo Mode** and deterministic reset. Simulated staff controls must be isolated in a labelled `Demo Controls` sheet, NOT presented as genuine authorized personnel functionality; local-only separation is UI organization, **not a security boundary**.

**Required scripted scenarios:**

1. **Court booked:** Seed an empty sample badminton slot → student A confirms → court is unavailable in the same local data source → My Bookings, Home and Calendar reflect the same reservation.
2. **Conflict prevented:** Student B (within the same shared local demo repository) requests the exclusive overlapping court interval → rejection with explanation; no duplicate booking. Never claim separate-client atomicity yet.
3. **Cancellation/waitlist:** Existing booking fills court; another demo profile joins queue; original booking cancels; simulator issues the next eligible offer; student accepts; new reservation appears after validation.
4. **No-show:** Existing booking not checked in after configured grace; simulator marks no-show and releases *reservation* but leaves actual court occupancy as `unknown` until independently updated.
5. **Gym uncertainty:** Student self-checks in → reported/limited occupancy indication changes; explicit incomplete coverage label remains. No implied verified campus-wide count.
6. **Maintenance:** Simulator flags a court out of service → new booking blocked; existing booked students see `disrupted` with next steps, not an automatic silent cancellation.
7. **Cross-module:** Valid reservation appears once in Calendar, once in Home My Activity, creates one in-app reminder/notification, and disappears or becomes cancelled consistently when status changes.

**Demo setup:** use stable fictional resource IDs (e.g. `DEMO-COURT-1`) and clearly fictitious times, counts, and locations. No real campus capacity or venue assumptions. Provide seeded scenarios with a fixed clock for automated tests. Demo reset must be explicit, independent of widget preference reset, and must not delete user-provided timetable files.

## 8. Notifications, Calendar, Home and Time Tax integration

### 8.1 Notifications (in-app only)

| Trigger | Notification | Rule |
|---|---|---|
| Demo booking confirmed | `Reservation saved in CampusOS demo` | One notification keyed to booking+transition |
| Waitlist joined | `Added to recorded demo waitlist` | Explicitly not a reservation |
| Offer issued | `A demo slot offer is available` | Requires eligible offer and visible expiry rules |
| Booking cancelled | `Your demo booking was cancelled` | Link to booking detail |
| No-show processed | `Demo booking released after no-show` | Do not imply physical vacancy |
| Facility closed or resource disrupted | `Your demo reservation may be affected` | Include affected IDs and available next steps |
| Check-in recorded | `Self-reported check-in recorded` | Never imply security/access verification |
| Reminder due | `Upcoming demo booking` | Default 30 minutes before, per Calendar spec; in-app only |

Use deduplication by `(recordId, transitionId, recipientProfileId)` and create notifications only on state changes, not on page refresh. No push/email/WhatsApp guarantees. Deep links must point to owned canonical booking detail.

### 8.2 Calendar

Projected reservation records carry resource/activity, exact start/end, owner, status, source and verification label. These are visible in Week, Day, Month and Agenda under the **Bookings** layer, and use `Manage booking` to deep-link to the owning module. The student cannot delete a reservation directly from Calendar, and the source booking cannot be changed by editing a copied event. Cancelled/disrupted records follow the Calendar's display rules consistently; no false future active booking. A booking is a timed commitment in Free Pockets; a mere recorded gym occupancy sample is not.

### 8.3 Home

`My Activity`: next active bookings and alerts. `Up Next`: include only upcoming, time-specific valid personal reservations based on the Home spec's ranking rules. `Quick Actions`: Gym / Badminton / Other Sports can be favorites. Context cards can mention an upcoming reservation without inventing travel times or campus availability. Card visibility preferences cannot delete bookings.

### 8.4 Time Tax measurement (strict scope)

Primary outcomes: *unsuccessful physical trips avoided*, *observed time waiting to access a court/machine/gym*, *booking success rate*, *self-reported vs observed facility utilization*, and *peak demand versus capacity* when credible observations are collected. Do **not** equate a booking with a measured wait-time saving; do **not** equate reservations with physical utilization; do **not** extrapolate from unrepresentative self-check-ins into campus-wide occupancy.

Illustrative calculation (scenario, not fact): if 25 attempted visits per week each would otherwise incur 8 minutes of preventable waiting, potential avoided waiting = `25 × 8 / 60 = 3.33 student-hours/week`, **only under those assumptions**. Fieldwork would require baseline wait times, unsuccessful visit counts, and ideally post-intervention comparable observations to claim observed changes. Keep simulation separate from field observations and experimentally validated outcomes.

## 9. Failure cases and exact semantics

| Case | Required handling |
|---|---|
| Hours/capacity not supplied | Unknown or labelled demo; do not invent campus policy |
| Gym punch-in without punch-out | Retain stale/incomplete self-report; do not claim live occupancy |
| Resource has no future slot rules | Show information; do not offer fabricated reservation slots |
| Two conflicting local bookings | Validate, reject second; no partial writes |
| Separate browsers book same slot pre-backend | Explicitly unsupported concurrency; never claim atomic cross-client guarantee |
| Reservation save/storage fails | Preserve form and selected slot, show error, no false confirmation |
| Student taps reserve twice | Idempotent one booking per submission attempt |
| One user opens a waitlist twice | Deduplicate entries |
| Waitlist offer not accepted | Keep slot unconfirmed; do not silently promote |
| Past/no-show booking | Immutable or guarded history; no false ongoing check-in |
| Court closed after booked | Flag disruption and communicate; no silent cancel or auto-refund |
| Booking cancelled | Recompute Calendar/Home/notifications from canonical state; physical occupancy unchanged |
| Gym equipment fault | Do not infer entire facility unusable without separate closure |
| Partner is listed | Do not imply identity verification or consent |
| Unknown source timestamp | Show `Last update unknown` or `Demo snapshot`, not fake live freshness |
| User's known class overlaps requested slot | Warn; booking rule independently determines whether allowed |
| Date/time ambiguity or DST | Use IANA timezone, local date selection and exact timestamps; never guess input |
| Demo reset | Explicit confirmation; restores deterministic demo fixtures, not real imported records |

## 10. Proposed demo configuration — not official policy

These values help make an interactive presentation reproducible. Store them in separately labelled `demoSportsConfig`, not hidden throughout components.

| Setting | Illustrative default | Scope |
|---|---|---|
| Badminton future booking limit | 2 per profile | Demo only |
| Badminton no-show grace | 10 minutes | Demo only |
| Badminton advance booking horizon | 7 days | Demo only |
| Booking reminder | 30 minutes before | In-app per Calendar defaults |
| Waitlist offer lifetime | 15 minutes | Manual/visible simulation, not background enforced |
| Gym reservation limit | Configurable / unknown | Do not invent official requirement |
| TT, pool, basketball slot duration | Configurable / unknown | Fixture data not supplied |
| Occupancy labels | Unknown unless sourced/simulated | Must show provenance and completeness |
| Court numbers, venues, opening hours | No real defaults | Add clearly fictional fixtures only to demonstrate UI |

## 11. Acceptance tests — feature and integration contracts

The IDs are stable references for future automated/unit/E2E tests. They are **planned tests**, not tests claimed executed.

### Hub and information

- `SP-T01` `/bookings` shows gym, badminton and all three other sports with accessible links.
- `SP-T02` Missing source-provided hours/capacities display unknown; no fabricated campus figures.
- `SP-T03` Desktop, mobile and keyboard users can navigate slots, detail panels and controls.
- `SP-T04` Source/dataMode/as-of/verification labels remain visible for time-sensitive statuses.

### Booking engine

- `SP-T05` A valid eligible slot creates exactly one persisted reservation with stable ID.
- `SP-T06` Duplicate submission creates no duplicate reservation.
- `SP-T07` Overlapping exclusive reservations in the same repository are rejected.
- `SP-T08` Adjacent intervals do not conflict unless explicit turnover buffer is configured.
- `SP-T09` Resource closure blocks new reservations.
- `SP-T10` Existing reservation disrupted by later closure remains traceable; no silent cancellation.
- `SP-T11` Cancelled reservation updates resource slot availability without asserting physical vacancy.
- `SP-T12` Invalid time, past slot, out-of-policy date or excess future-booking count is rejected with explanation.
- `SP-T13` Storage failure preserves form and never displays success.
- `SP-T14` Demo booking remains after refresh in same profile and is not visible in unauthorized demo profiles.

### Badminton and groups/waitlist

- `SP-T15` Optional partner/group details do not imply verified partner acceptance.
- `SP-T16` Waitlist entry deduplicated for same profile/resource/slot.
- `SP-T17` Waitlist participant is not listed as confirmed reservation.
- `SP-T18` Eligible recorded waitlist offer is issued in configured sequence and requires acceptance.
- `SP-T19` Accepted offer revalidates capacity before confirming booking.
- `SP-T20` No-show simulator releases booking claim while physical occupancy remains unknown.

### Gym and other sports

- `SP-T21` Self-check-in cannot be repeated while profile is checked in without explicit correction.
- `SP-T22` Self-reported occupancy never displays as verified live headcount.
- `SP-T23` Equipment fault status does not automatically close unrelated gym resources.
- `SP-T24` TT, pool and basketball each use their own resource/policy configuration.
- `SP-T25` Resource without configured booking support never shows an active fake reserve action.

### Integrations, time and evidence

- `SP-T26` Confirmed active booking appears exactly once in Calendar projection and in My Activity.
- `SP-T27` Cancellation/disruption changes propagate to Calendar and Home without orphaned active bookings.
- `SP-T28` Notification fires once per real local state transition, not on refresh.
- `SP-T29` Time Tax labels hypothetical savings as simulation, never observed outcome.
- `SP-T30` Demo reset returns deterministic seed state without changing imported academic data or widget preferences.
- `SP-T31` Existing Laundry machine booking semantics remain compatible with shared booking contracts.
- `SP-T32` F24 team/fixture behavior is not falsely advertised as delivered by this module.
- `SP-T33` Reminders remain in-app and do not claim closed-browser delivery.
- `SP-T34` Unknown/stale availability and occupancy result in explicit states, not inferred zero values.
- `SP-T35` No background transition pretends the court becomes vacant merely because slot time ends.

## 12. Development phases — after current approved work

Do **not** jump to this module while previously approved Home/Calendar phases are underway. Register and plan it first.

- **SP-0 — Contract reconciliation:** Read `CLAUDE.md`, Home, Calendar, Campus Essentials, and registry. Map shared booking types and decide reuse versus a minimal compatible abstraction. Record decisions; no premature replacement of Laundry booking records.
- **SP-1 — UI shell and fixtures:** Routes, Sports Hub, labelled fictional resources/hours, accessible resource cards, explicit unknown states and demo configuration.
- **SP-2 — Shared reservation slice:** Resource/date/slot selection, capacity validation, local persistence, cancellation, My Bookings, profile privacy.
- **SP-3 — Gym and other sports:** Gym hours, reported occupancy, equipment, voluntary self-check-ins; data-driven TT/pool/basketball configurations.
- **SP-4 — Badminton extensions:** Optional partner/group fields, waitlist, offers, cancellation and explicit no-show simulator.
- **SP-5 — Cross-module integration:** Calendar projections, Home My Activity, in-app Notifications and clearly labelled Time Tax scenario model.
- **SP-6 — QA gate:** Test IDs, mobile/keyboard, concurrency caveat, mock data provenance and repeatable demo script.
- **Final project backend phase ONLY:** shared server repository/transactions, multi-client updates, minimal authenticated Demo Operations console, audit log and source-aware status freshness. This is not authorized now.

Each phase uses plan → approval → implement → run tests → report evidence → stop. No automatic expansion into F24 fixtures, F12 general complaints, or unrelated modules.

## 13. Inputs still needed from campus (do not guess)

- Actual gym opening hours, bookability, capacity, current check-in practice, equipment list and reporting process.
- Actual badminton court count, operating hours, real maximum booking limits, slot duration, partner booking norms, waitlist/no-show/cancellation rules.
- Whether “pool” refers to a billiards table and whether TT/basketball are bookable or merely accessible first-come-first-served.
- Court/table locations, condition, any maintenance/closure schedules.
- Whether the institution authorizes any official booking through the prototype; if not, demo must never be interpreted as reservation rights.
- Representative baseline wait-time, unsuccessful-visit and usage data for the Time Tax study.

Until supplied, use **clearly invented demo fixtures with labels**, not unsupported campus assertions.

## 14. How to register this specification in Claude Code

Save as `docs/features/CampusOS_Sports_Fitness_Spec_v1.0.md`.

1. Read the file and identify dependencies on `COS-HOME-001`, `COS-CAL-001`, `COS-ESSENTIALS-001`, and shared `BookingReference` domain.
2. Add entry `COS-SPORTS-001` for `F04`, `F06`, `F07` to `docs/FEATURE_REGISTRY.md` with status `specified / proposed, not implemented`; do not mark approved without user approval.
3. Add a `docs/DECISIONS.md` entry distinguishing source requirements, user-approved overall prototype choices, and this document's proposed demo policies.
4. Surface clashes with existing machine-reservation rules; decide a shared interface without silently changing Laundry or Calendar specs.
5. Do not start implementing unless current phases are completed and the user authorizes the relevant sports phase.
6. Do not build real authentication, backend, WebSocket channels or server-wide occupancy until final backend phase.

**Done means:** verified local workflows and explicit test evidence, not just attractive screens or this document existing.
