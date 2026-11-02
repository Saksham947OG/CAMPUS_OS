# CampusOS — Campus Essentials: Laundry, Mess & Parcels

**Specification ID:** `COS-ESSENTIALS-001`  
**Version:** `1.0 — proposed implementation baseline`  
**Source feature IDs:** `F05` (Laundry); `F09`, `F10`, `F11` (Mess); `F13` (Parcels)  
**Project:** CampusOS, Introduction to Business Operations / Time Tax  
**Scope:** functional, local-first academic prototype; cross-client demonstration backend **deferred to the final phase**.

> **Approval boundary.** The user explicitly chose **Option C for SS Laundry**: students register their laundry submissions, while *provider-controlled changes* are demonstrated through a separate, clearly labelled simulator. The user explicitly requested faster batching of 2–3 feature areas per round. Everything else in this contract—mess operation rules, parcel behavior, timeouts, thresholds, layout details—is a **proposed prototype default**, not a claim about campus policies or user-approved institutional functionality. Review open inputs when real schedules, menus, and procedures arrive. No code is authorized by the creation of this document alone.

## 1. Product purpose and non-goals

This bundle delivers three related student service experiences under **Campus Services**:

1. **Laundry Hub:** separate experiences for external **SS Laundry** pickup/delivery and on-campus washing machines. Source brainstorm describes SS Laundry visits as approximately every alternate day, **not** as a validated fixed recurrence rule.
2. **Mess:** daily/weekly menus and meal changes, optional *self-reported demo* check-in/out indicators, fee deadlines and the campus's existing payment-form link if supplied.
3. **Parcels:** traceable parcel arrival notices, collection history, reminders for uncollected parcels, and limited issue reporting.

**We are not building:** live provider integrations, verified real-time machine sensors, official mess-account/payment verification, a payment processor, real security desk access, a full courier tracking API, remote push notifications, or a theft-prevention guarantee. The future authenticated demo operations console and live cross-client updates remain in the **last development phase**. A local *explicit* simulator may demonstrate statuses in one browser without being described as a connected provider.

**Shared invariants:** preserve `CLAUDE.md`, `COS-HOME-001`, `COS-CAL-001`, and `COS-CHILL-001`; `Asia/Kolkata`; date-only values remain date-only; data modes `provided`, `demoSeed`, `userCreated`, `simulated`; data provenance is distinct from verification; per-demo-profile data is isolated; no invented schedules, statuses, prices, amounts, dates, policies, capacities or measured savings. Missing information is **Unknown**, not zero or on-time.

## 2. Information architecture and UI

| Route | Screen | Content and interactions |
|---|---|---|
| `/services` | Campus Services | Accessible cards for Chill Spot, Laundry, Mess, Parcels, with source/availability labels |
| `/services/laundry` | Laundry Hub | Two clear tabs: **SS Laundry** and **Washing Machines**; active personal status preview |
| `/services/laundry/ss` | SS Laundry | Provider visit banner, My Loads list, add submission form, individual timeline, delays and collection |
| `/services/laundry/ss/:loadId` | Load detail | Source-aware expected return, events, delay/discrepancy banner, record provenance |
| `/services/laundry/machines` | Machines | Availability board, filter, machine detail, date/slot selection, My Reservations, cycle estimate |
| `/services/mess` | Mess Hub | Today/weekly menu, meal tabs, source timestamp, occupancy information, feedback entry, fees tab |
| `/services/mess/fees` | Fees | Supplied amount/deadline, official existing form URL if provided, personal submission status |
| `/services/parcels` | Parcel Hub | Private list of arrived/uncollected/collected parcels, collection point, history |
| `/services/parcels/:parcelId` | Parcel detail | Timeline, staff-recorded handover, issue reporting, last updated |

Design: reuse CampusOS sidebar, typography, warm-neutral base, teal action accents, status semantics, accessible drawers and cards. Make the identity of **SS Laundry vs Machines** obvious. Put student's *next practical action* first: “See next reported visit,” “View my load,” “Find machine slot,” “See today's menu,” “Collect parcel.” Do not expose non-working controls as active.

All applicable screens have meaningful loading (only when async), empty, stale, error, and success states; all forms work on mobile and keyboard. Photo assets must be licensed/provided or use tasteful, correctly labelled placeholders.

## 3. SS Laundry — approved hybrid registration/simulation approach

### 3.1 Student registration

Form collects: stable demo profile ID, optional external bag/receipt reference (avoid secrets), submitted/handed-over date and optional time, optional item count and student notes, and declared collection point if known. **Student creation is a self-reported registration, not confirmation the provider received anything.** Show that distinction in confirmation UI.

Do not force a garment-level inventory or a service charge unless real records require it. Prevent duplicate clicks from creating duplicate loads. Maintain local persistence per demo profile. Student may correct self-entered fields while status is `registered`; verified/provider-controlled fields and histories are not edited by the student.

### 3.2 Provider visit and individual load states

Represent **provider visit** and **student load** as separate canonical objects. A provider's arrival on campus must never automatically mark all student loads as returned.

**Load stages:** `registered` (student-reported) → `received` (explicit simulator/provider receipt) → `processing` → `returnedToCampus` → `readyForCollection` → `collected`. A `returnScheduled` update is a separate expectation event, *not* proof of physical movement.

**Status overlays:** `delayFlag`, `discrepancyFlag`, `underReview`, plus provider-provided `expectedReturnDate` and `expectedReturnConfidence: tentative | confirmed | unknown`. These flags may coexist with a stage. `cancelled` or `closedWithIssue` only when explicitly resolved under a documented demo rule. If only part of the load returns, set `discrepancyFlag`, record quantities only when collected, and do not close the outstanding part as fully collected.

`readyForCollection` requires explicit evidence within the simulator; arrival of the external provider alone is insufficient. A student may report “I collected this,” but it is **self-reported** until an authorized simulated handover updates the record. Avoid false confirmation.

### 3.3 Visit announcements, delays, notifications

Visit announcements can be `tentative`, `confirmed`, `rescheduled`, `cancelled` and have source, `asOf`, date/time window if provided. The campus's “every alternate day” anecdote is explanatory context, not a basis to auto-generate dates until an actual schedule is supplied.

In-app notifications: visit announced/changed; student load receipt confirmed; specific load delayed; specific load ready; collection recorded; discrepancy flagged. Notify only the correct demo profile. A missing or revised delivery date reads “Awaiting confirmation”—never a guessed date. Deduplicate by `entityId + transitionId + recipient`.

### 3.4 Local demonstrable sequence

1. Student creates a load → labelled **Student reported**.
2. Demo Operations explicitly marks receipt and subsequent processing, with visible `simulated` indicator.
3. Simulate provider visit arrival **without** changing the load; show independence.
4. Explicitly mark one load delayed with no new date; show “New date unknown.”
5. Supply a tentative revised date, then mark the load `readyForCollection`.
6. Record handover → Home My Activity changes, one in-app notification per event.

No hidden timers or fake live provider identity. Demo controls stay outside the student-facing action surface.

## 4. Self-service machines — separate booking and occupancy

### 4.1 Machine availability representation

Machine has stable ID, display label/location if supplied, `operationalStatus: working | outOfService | unknown`, independent `physicalStatus: available | occupied | unknown`, optional capacity/cycle program only if supplied, `sourceLabel`, `asOf`, `dataMode`, `verificationStatus`.

**Reservation state is not physical state.** A machine with no current reservation is not automatically physically available. A timed-out reservation releases the reserved slot but does not assert that someone physically left. A cycle timer reaching zero does not prove the machine finished, and neither assertion should be presented as sensor verified.

### 4.2 Booking workflow

Student selects machine → date → available demo slot → reviews rules → confirms → receives personal reservation ID. Reuse the eventual shared Booking Engine contract rather than inventing a conflicting booking model. For current local-first implementation, validate overlapping reservations from the local repository; **cross-client collision prevention is not claimed until the final backend**.

Suggested configurable *demo defaults, not campus rules*: one upcoming active machine booking per student, **10-minute grace period**, 7-day maximum booking horizon; these should be shown in Demo Rules and editable in the simulator, not stated as actual campus policy. Slot length and wash-cycle length remain unknown until supplied; a demonstration can use clearly labelled sample values.

Reservation states: `reserved` → `checkedIn` → `used` → `completed`; alternate branches `cancelled`, `noShow`, `blockedByOutage`. On grace expiry, a **manual labelled simulator action** may release a no-show slot; do not run background enforcement or claim actual vacancy. A breakdown blocks new bookings and raises warnings on affected reservations without silently cancelling/altering them.

### 4.3 Wash-cycle estimates

A checked-in student may log `cycleStartAt` and a configured or selected estimated duration. Display **Estimated cycle end** and offer an in-app reminder; completion is confirmed separately. If app is closed, do not pretend a background phone notification was sent. A cycle may be completed but the machine physically occupied until explicit clearance/updated observation.

### 4.4 Calendar and Home behavior

Confirmed reservation: Calendar booking projection and Home My Activity. Booking cancellation updates both. A cycle estimate may appear in My Activity but does not automatically block Free Pockets for its entire duration. Calendar meal-context conventions do not apply to machines.

## 5. Mess — menu, optional self-reported crowd indicator, fees

### 5.1 Menu and schedule

View day and week, breakfast/lunch/snacks/dinner, dietary or allergen details **only where verified**, special meal alerts, substitutions and meal feedback. Import the team's actual published menu and times when provided; **do not** fill missing days or assume recurring menu cycles. Separate the meal-service window (`date`, `start`, `end`) from the meal's menu items and update history. If only a weekday pattern is provided, show the pattern and its date applicability, not fabricated daily confirmations.

Menu records include source and last-updated, `published | tentative | changed | unknown`, and applicability. Any feedback form must clearly say it is demo feedback and store only the posting profile's data unless aggregated intentionally.

Calendar: contextual menu panel **on by default**, optional dining-time overlay controlled by Calendar preferences. Overlay is informative, **does not reserve student time**, and does not enter Free Pockets calculations. Special meals can be separate campus events only if their event records support it.

### 5.2 Mess occupancy / check-in-out

Original brainstorm proposes students punching in/out so others can gauge rush. In an opt-in **local demo**, a profile may self-report entry and exit; derive an illustrative count only from demo sessions. Label **Self-reported sample**, never **Actual occupied seats** or **Live occupancy**. Profiles can have at most one open session; repeated check-in is idempotent, repeated check-out is rejected with a helpful message. Stale sessions are flagged for review—not silently converted to reliable occupancy. If participation is incomplete or capacity is missing, do not show a percentage of full capacity or definite free-seat numbers.

Busy/quiet indicator may be manually reported in the simulator with source/time, or calculated explicitly from a fully defined **demo-only** dataset and labelled as such. No predictive model until measured input exists. A student can view the relevant meal window but should not be falsely told that a real seat is available.

### 5.3 Mess payment reminders / links

Show fees as campus-supplied `amount`, `currency`, `dueDate`, `instructions`, `lateFee` (if verified), and `authorizedFormUrl` (only if provided). Do not invent any amount, late charge or Google Form URL. Distinguish `notSubmitted`, `studentReportedSubmitted`, `verificationPending`, `verifiedPaid` (only via an explicit authorized source in a future integration) and `unknown`. Clicking an existing payment form **does not** mark the payment paid. Locally reported submission is not a receipt. A supplied deadline may generate an in-app reminder under existing preference rules, without claiming successful background delivery.

## 6. Parcel alerts and collection records

### 6.1 Data ownership and privacy

A parcel is entered by a **labelled local Demo Operations** panel, standing in for a gate/office staff log. Student cannot fabricate a staff-confirmed arrival in the ordinary student screen. Fields: `parcelId`, profile recipient ID, courier name if known, reported arrival timestamp, collection point if known, optional reference suffix (never full sensitive tracking identifiers), current status, source, provenance, append-only transition history. Parcel listings are private per demo profile; no public parcel gallery, full phone numbers, room addresses or identification documents.

### 6.2 States and notifications

States: `logged`/`awaitingCollection` → `collected`; optional `exception` for missing/misassigned/damaged/disputed cases. **Uncollected** and **overdue** are derived labels based on collection status and configurable reminder age, not contradictory terminal states. Proposed demo reminder age **72 hours** after logged arrival, configurable and visibly non-institutional. No assumption that office hours or parcel retention policies are known.

On recorded arrival: add one in-app notification with where to collect (only if provided). On overdue: show one reminder when the app next checks eligible records; no false closed-app push guarantee. On collection: require a separate explicit Demo Operations confirmation and retain a timestamped event. A student may flag a problem, but may not unilaterally record staff handover. Preserve an audit-friendly history without claiming this prevents theft.

### 6.3 User journey

1. Demo Operations logs parcel for demo profile A.
2. Profile A sees parcel, in-app notification and Home My Activity; profile B sees none.
3. A opens details; pickup point shown if known, otherwise “Ask collection desk.”
4. Demo Operations marks collected; profile A history/notifications update.
5. A separate demo parcel aged past configured threshold gets an “Uncollected” reminder—no invented policy or real notification delivery.

## 7. Shared data contracts and event boundaries

Define typed canonical models, not duplicated widget fixtures. Each persisted record has `id`, `ownerProfileId` or audience, `dataMode`, `verificationStatus`, `sourceLabel`, `createdAt`, `updatedAt`, and applicable source-time `asOf`. Distinguish exact timestamps from date-only values. Never use `new Date()` on a date-only string in ways that shift its calendar date unexpectedly.

**Suggested types** (adapt to existing architecture, do not duplicate existing abstractions):

```ts
type DataMode = 'provided' | 'demoSeed' | 'userCreated' | 'simulated';
type Confirmation = 'confirmed' | 'tentative' | 'unknown';

type LaundryLoadStage =
  | 'registered' | 'received' | 'processing'
  | 'returnedToCampus' | 'readyForCollection' | 'collected';
type ReservationState =
  | 'reserved' | 'checkedIn' | 'used' | 'completed'
  | 'cancelled' | 'noShow' | 'blockedByOutage';
type ParcelState = 'logged' | 'awaitingCollection' | 'collected' | 'exception';

type ServiceAuditEvent = {
  id: string;
  entityId: string;
  actorKind: 'student' | 'demoSimulator' | 'import';
  action: string;
  at: string; // exact ISO timestamp
  dataMode: DataMode;
  note?: string;
};
```

Use domain services for valid transitions; UI components dispatch intent, do not directly mutate arbitrary status strings. Ensure idempotent creations/transitions, append-only histories, no cross-profile disclosure, and repository adapters for future backend replacement.

### Integration matrix

| From | Home | Calendar | Notifications | Time Tax |
|---|---|---|---|---|
| SS Laundry | My Load/current status | Provider visit if sourced; personal collection reminder optionally | Visit changes, specific load delayed/ready | Avoided unsuccessful collection trips **scenario or observed only** |
| Machines | Upcoming reservation, cycle estimate | Reservation as booking; no false busy block from unattended wash cycle | Reservation, expected cycle end, outage | Reduced unsuccessful visits/physical wait **scenario or observed only** |
| Mess | Next meal/menu and fee reminder when supplied | Context panel default; optional time overlay | Verified/sourced changes and due-date reminders | Mess waiting improvements **not inferred from menu or self-reported occupancy** |
| Parcels | Uncollected items | Optional student-created pickup reminder only | Arrival, uncollected, collected | Avoided unnecessary collection visits **scenario or observed only** |

Reuse shared in-app Notification Center with event-key deduplication and per-profile privacy. Clicking an alert opens the canonical entity screen. None of these modules should create fake calendar events automatically when there is no actual timed commitment.

## 8. Time Tax measurement specification

**Never equate hypothetical savings with observed savings.** Maintain distinct source types: `simulation`, `fieldObservedBaseline`, `fieldObservedPost`, and `verifiedExperiment` only when study design justifies it. Student-registered laundry loads and self-reported check-ins do not automatically prove a time saving.

- SS Laundry: count unnecessary collection trips and time per trip, compared under clearly specified assumptions. A changed notification alone is not observed saved time.
- Machines: observed wait before finding a usable machine, trip failures, and reservation success, separated from actual wash cycle length.
- Mess: observed queue or seating wait can inform the Time Tax; menus and incomplete check-in samples cannot independently produce valid wait-time reductions.
- Parcels: failed trips prior to a confirmed arrival alert, physical collection wait, and opportunity for avoided trips—not a claim of theft prevention.

Show assumptions, measurement definitions, sample sizes and dates; where missing, render a scenario calculator with an unambiguous “Illustrative” label. Do not add together overlapping measures as if they were independent.

## 9. Failure and edge-case rules

| Case | Required behavior |
|---|---|
| Provider on campus but a particular laundry load absent | Individual load remains unchanged; show distinction |
| Student registers laundry that staff has not received | Keep `registered`, label self-reported |
| No expected return date | Show “Unknown / awaiting confirmation,” not a guessed date |
| Partial laundry returned | Record discrepancy, don't claim whole load delivered |
| Machine booking expires while physically occupied | Release booking only, not asserted physical availability |
| Machine is out of service | Stop new bookings, display impact on existing reservations |
| Cycle timer reaches zero | “Estimated finish reached,” not verified complete |
| Repeated mess check-in | Prevent duplicate active session |
| Mess occupancy observations stale/incomplete | Display limitations; no guaranteed seats |
| Mess amount or payment form unknown | Do not invent amount/link; provide clear unavailable state |
| Student reports form submitted | Mark self-reported submission, not paid |
| Parcel log belongs to another profile | No visibility or cross-profile notifications |
| Parcel overdue threshold passed | Derived uncollected reminder, not an institutional fine/policy |
| Parcel marked collected | Require explicit simulator/staff record; preserve audit history |
| Browser refresh | Preserve supported profile-scoped data; don't relabel demo information as live |
| Notification dismissed | Only read state changes; source record remains intact |
| Simulator reset | Explain which service demo records reset; don't erase unrelated Home/Calendar/Chill Spot state |

## 10. Acceptance tests (mandatory when implemented)

**Laundry — `ESS-L`**

- `ESS-L01` Student registers load; status accurately says self-reported, no false receipt.
- `ESS-L02` Separate provider arrival does not mark individual load returned.
- `ESS-L03` Demo operator advances permitted stages and records an auditable transition.
- `ESS-L04` Delay with unknown revised date shows unknown; tentative date remains tentative.
- `ESS-L05` Partial return flags discrepancy without closing the whole load.
- `ESS-L06` Ready-for-collection creates one in-app notification to correct profile.
- `ESS-L07` Machine reservations reject conflicting slots within the same local data source.
- `ESS-L08` No-show cancellation releases booking but not physical occupied status.
- `ESS-L09` Cycle estimate does not automatically verify completion.
- `ESS-L10` Home/Calendar reflect valid reservation changes without duplicate event copies.

**Mess — `ESS-M`**

- `ESS-M01` Only supplied menu and service hours display as actual data; missing values remain unknown.
- `ESS-M02` Calendar contextual menu and optional dining overlay derive from same records.
- `ESS-M03` Dining overlay does not block Free Pockets.
- `ESS-M04` Double check-in is prevented; incomplete counts are labelled self-reported.
- `ESS-M05` Missing capacity never yields a fabricated occupancy percentage.
- `ESS-M06` Fee without amount/form URL shows no invented amount or clickable payment link.
- `ESS-M07` Opening form or student reporting submission does not create verified-paid status.
- `ESS-M08` Source-provided menu changes appear consistently on Home/Mess/Calendar.

**Parcels — `ESS-P`**

- `ESS-P01` Demo Operations logs parcel; only intended profile sees it.
- `ESS-P02` In-app arrival notification links to exact parcel record.
- `ESS-P03` Unknown collection point is labelled unknown.
- `ESS-P04` Age threshold creates derived uncollected reminder without changing parcel's source status.
- `ESS-P05` Only explicit simulator transition marks parcel collected, preserving history.
- `ESS-P06` Logged arrival is never described as proof of theft prevention or actual courier API tracking.

**Shared — `ESS-S`**

- `ESS-S01` No real-time, verified payment, hardware or provider connection is falsely claimed.
- `ESS-S02` Data survives refresh only where specified and stays profile-scoped.
- `ESS-S03` New notification events deduplicate by canonical transition.
- `ESS-S04` Demo reset is scoped and cannot delete unrelated module records.
- `ESS-S05` Mobile navigation, forms, keyboard access and empty/error states work.
- `ESS-S06` Time Tax simulations never display as measured campus outcomes.

## 11. Suggested development phases (after prior approved work)

- **ESS-0:** audit existing Home/Calendar/Chill Spot contracts, define shared models, routes, seed fixtures and source labels; do not overwrite approved module models.
- **ESS-1:** Laundry Hub with SS registration, load detail, local simulator, notifications.
- **ESS-2:** Machines board, reservations, cycle estimates; integrate existing booking abstractions when available.
- **ESS-3:** Mess menu, contextual Calendar integration, qualified self-reported crowd indicator, fees/form link.
- **ESS-4:** Parcel arrival, private history, uncollected reminders and local demo simulator.
- **ESS-5:** Cross-module consistency, edge cases, accessibility, responsiveness, verified test evidence.
- **Global final phase only:** optional tiny backend and cross-client operations demo; **not** included in ESS-0..ESS-5.

Each phase needs its own read-only plan, user authorization, tests and stop gate. Feature-spec completion does not indicate code exists or tests have passed.

## 12. Missing real-world inputs and default policy

The following are **not yet supplied**: SS Laundry actual arrival dates/windows, receipt identifiers, individual bag data, machine numbers/locations, slot lengths, real campus reservation/no-show rules, mess day/weekly menu and published hours, dining capacity/participation rate, mess fee amount/deadline/payment form URL and verification process, parcel collection location and staff policy, and actual field observation dataset.

Until supplied, use **anonymized, explicitly labelled demonstration fixtures** with separate seeds for each service. Any sample values must be clearly fictional. Incompatible or ambiguous source data should be flagged for review instead of silently normalized into false precision.

## 13. Instructions for adding this to Claude Code

1. Place this file in `docs/features/CampusOS_Laundry_Mess_Parcels_Spec_v1.0.md`.
2. Add registry rows for `COS-ESSENTIALS-001` and F05/F09/F10/F11/F13 with status **PROPOSED SPEC / REVIEW** until the user explicitly accepts this combined contract. Do not mark implemented or verified.
3. Record the explicitly user-confirmed Laundry hybrid Option C as **CONFIRMED**; keep other detailed defaults labelled **PROPOSED**.
4. Read previous specs to identify compatible shared data and route conventions; resolve conflicts in an audit rather than guessing.
5. Do not displace the ongoing Home/Calendar/Chill Spot phases; plan ESS-0 only when those prerequisites are ready and user authorizes it.
6. Do not create the real backend, remote providers, actual payment verifier, hardware integration, or push notifications until the final dedicated phase.
