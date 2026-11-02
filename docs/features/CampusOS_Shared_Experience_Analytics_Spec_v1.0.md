# CampusOS — Shared Experience: Notification Center, Best Time to Go, Exam Seating & Time Tax

**Specification ID:** `COS-SHARED-001`  
**Version:** `1.0 — V1 coverage baseline; V2 design deepening required`  
**Group brainstorm IDs:** `F18` Best Time to Go; `F25` Notification Center and Preferences; `F26` individual Exam Seating notifications.  
**Cross-cutting project concept:** *Time Tax* — time lost waiting, searching and following up, plus credible analytical demonstrations of how proposed interventions may affect it. Not a separate original numbered feature; a project-wide analytical product requirement.  
**Status:** PROPOSED scope/architecture baseline. Source-grounded requirements are described separately from recommended prototype behavior.  
**Immediate build mode:** Local-first, static/approved source data + explicit simulated changes. **Actual backend, real push delivery and multi-client synchronization are final-phase work and not authorized here.**

## 0. Source intent and non-assumptions

The group proposes (1) a personalized notification center that lets students turn off irrelevant categories while important alerts such as exams, class cancellations, and leave status remain on; (2) a busy-space / best-time-to-go forecast for mess, gym and laundry after some weeks of data; (3) individual exam seating notifications identifying room, row and column. The larger IBO project emphasizes cumulative student waiting at campus services and queueing/peak-load analysis.

**Not provided:** Actual class/cancellation feed, university-approved mandatory notification policy, student-level seating list, official exam timings, live room occupancy, machine telemetry, queue histories, sample sizes or experimentally established savings. The prototype must never fill these gaps with implied real campus information.

## 1. Shared design and architectural boundary

### 1.1 Concept

**CampusOS should communicate only what it knows, to the people it is appropriate to tell, and show exactly how its operational estimates were produced.** Notifications, congestion patterns, exam seating and Time Tax are **shared systems**, not disconnected pages with independent data copies.

- Home derives relevant upcoming notices, saved preferences, and impact summaries from shared records.
- Calendar is canonical for scheduled classes, exams, deadlines, personal blocks, bookings and correctly sourced fixture updates.
- Notifications contain links to canonical source records, but are not themselves evidence that an external system received or acted on information.
- Congestion analytics derive from a source-labelled occupancy or waiting dataset; a graph is not proof of live service availability.
- Exam seating is confidential profile-scoped information and should not be available via public search or unrelated profiles.
- Time Tax is a methodology and analytics layer. It must always distinguish observed inputs, assumptions, simulation outputs and verified before/after results.

### 1.2 Module routes

Suggested routes, subject to existing app conventions:

| Route | Purpose |
|---|---|
| `/notifications` | Notification inbox, read/unread controls, categories, deep links |
| `/notifications/preferences` | Personal notification preferences, quiet categories, reminder defaults, delivery limitations |
| `/services/best-time` | Space/service selector, historical/simulated busy-by-hour chart, data-quality indicators |
| `/academics/exams` | Known exam schedule and demo-profile-specific exam seating |
| `/academics/exams/:examId` | Private exam detail, seating and source/version history |
| `/time-tax` | Time Tax overview, service comparisons and measurement methodology |
| `/time-tax/scenarios` | Interactive assumption-based scenario calculator |
| `/time-tax/observations` | Field-supplied baseline observations, sample size and limitations if provided |

All these routes should be accessible from appropriate existing shell destinations, not new top-level menu items unless design review calls for them.

## 2. F25 — Notification Center and Preferences

### 2.1 Student problem and structure

The group observes that indiscriminate messages cause students to stop reading and then miss important notices. The Notification Center must help triage **relevant, source-backed** updates.

The inbox provides newest-first records, `All / Unread / Important` filters, category chips, a meaningful empty state, and a per-notification detail/deep link. A notification card shows: short factual title, category, timestamp, source label, read/unread state and recipient scope. It must not quote private content in notifications belonging to another profile.

Important features:

- View notifications and mark one or all visible permitted notifications read.
- Filter by source feature: Academics, Exams, Administration, Orders, Laundry, Bookings, Parcels, Community, Maintenance, Other.
- Open a notification at the exact canonical record (order, ticket, assignment, rescheduled fixture, exam seating) rather than a generic landing page.
- Notification preferences by category and optional subtype; quieting promotional/community updates is different from suppressing a critical source change.
- Unread counts are derived; refreshing does not recreate already-processed notifications.
- Clear/archiving inbox records is distinct from deleting the underlying source record.

### 2.2 Priority policy and user control

The original source explicitly requests some **locked-on** alerts. For the prototype, the proposed in-app `critical` classes are (a) published exam changes, (b) sourced class cancellations or important reschedules, (c) transitions affecting the student's own leave-request status, and (d) changes to their own active confirmed demo reservation or safety-relevant closure when applicable. This is **a product-design proposal**, not a university-mandated alert policy. Changes to this list must be deliberate and recorded in Decisions.

Priority is metadata separate from category: `critical`, `important`, `standard`, `optional`. Only critical/important records from a legitimately authorized or clearly labelled demo source may bypass a category mute. Do not promote arbitrary announcements to critical to inflate engagement. The app can preserve critical in-app alerts even when an optional category is muted. Quiet hours are optional in V2; no false claim of device-level Do Not Disturb integration.

### 2.3 Event-to-notification contracts

Every notification-generating change needs `sourceType`, `sourceId`, `transitionId/version`, `recipientProfileId`, `kind`, timestamp, priority, deepLink, and provenance. Deduplicate using `(recipient, source, transition/version, notificationKind)` so refresh/remount or repeated actions cannot flood an inbox. A rejected or rolled-back operation generates no success notification.

| Event | Recipient | In-app behavior |
|---|---|---|
| Chill Spot order Ready | Owner of order | Important; navigate to order pickup detail |
| SS Laundry specific load Arrived | Load owner | Important; link to load, not generic provider visit |
| Parcel logged for a profile | Intended recipient | Important; link to parcel; sample/real source explicit |
| Booking cancellation/closure | Affected reservation owner | Important; link to booking |
| Faculty demo appointment accepted | Requesting demo profile | Standard; state clearly `DEMO accepted` |
| Class cancellation | Relevant supplied course audience | Critical when published, sourced; never invented |
| Exam seating change | Affected profile only | Critical, avoid exposing seat/roll details in broad preview |
| Club event announcement | Subscribed/eligible profiles | Optional; respects preferences |

**Delivery boundaries:** In-app display while app is open; catch-up on reopening from persisted local events; no promise of email, SMS, WhatsApp, native push or closed-app scheduling until that mechanism exists. For source data imported before a demo profile was created, avoid spamming the entire history as if just published.

### 2.4 Failure/edge cases

No notifications → intentional empty state. Corrupt source links → show unavailable source with detail rather than broken navigation. Unknown audience → do not broadcast globally. Category mute → suppress only permitted optional/standard creation or display as specified by the preference model, while critical policy remains consistent; document which behavior is chosen. Source record deleted → retain audit-safe notification summary but no private source content. Demo role switch → do not show another profile's inbox. Reset Demo → deterministic seeded state.

## 3. F18 — Best Time to Go

### 3.1 Problem and representation

Students spend time walking to a service and waiting without knowing demand patterns. Best Time to Go should show **interpretable patterns of previously observed or deliberately simulated congestion**, helping students choose when to visit, while never claiming certainty about the future.

Supported service cards: Mess, Gym and Laundry Machines; additional queue-enabled services only after their metrics are defined and integrated. Each screen contains service selector, date/day-of-week/hour filters, source badge, date range covered, sample count and caveats. A heatmap or hourly bar chart shows `historically reported activity`, `average observed wait`, or `historical utilization`—not a generic unsourced `crowd score`.

### 3.2 Data-quality levels

| Level | Meaning | Label |
|---|---|---|
| No data | Missing or insufficient recorded observations | `No reliable pattern available` |
| Demo scenario | Synthetic records deliberately seeded | `Illustrative simulation — not actual crowd data` |
| Field observation | User-supplied observations with sampling details | `Observed sample` with dates and count |
| Validated forecast | Only future phase after enough quality data and backtesting | `Estimated future pattern` with method/limits |

**V1 recommendation:** Do **not** build a predictive model. Begin with deterministic historical/simulated aggregation and explain the limitation. If hourly bins have too few observations, suppress precise recommendation and display `insufficient sample`. Minimum sample thresholds, coverage and confidence rules are V2 decisions, not arbitrary hardcoded campus truths.

### 3.3 Busy-period logic

An observation record should include service ID, observed timestamp, local date/hour, metric type, value, measurement mode (`manual_count`, `self_report`, `simulated`, `device_verified` if and only if truly integrated), sample window, source, and optional reliability notes. Never compare occupied seat count to waiting minutes as though they were the same measure. Colour should not be the only carrier of status.

For an example `best time` suggestion, candidate hours must be eligible operating hours if known, and the estimate must be computed from comparable recorded samples. If hours are unknown, do not claim the site is open. When two hours are indistinguishable, show tied/uncertain rather than fake decimal-level ranking. A historical pattern cannot claim current availability.

### 3.4 Interactions and limits

Service selector → choose metric → change day/time bin → inspect chart and source. Selecting a candidate time can open the target service page or create an optional **personal reminder** in Calendar, never an automatic reservation. The feature may show ``historically quieter`` but cannot promise ``no wait``. Notifications for high crowd or space available are excluded from initial prototype without reliable event data.

### 3.5 V2 deepening

Study the actual fieldwork sampling schedule; decide metric definitions per service, minimum sample count, anomaly handling, class timetable peaks, weather/holidays, confidence labels, chart accessibility, proper forecasting validation and intervention-based effect measurement. No speculative model accuracy.

## 4. F26 — Personalized Exam Seating

### 4.1 Goal, security and source boundaries

The original example imagines notifying a student of examination hall, column and row details. This is private, high-consequence academic information. The first prototype can demonstrate it only with **fabricated demo profiles/seats** or user-supplied records handled under an explicitly approved privacy workflow; it must not manufacture official seat allocations.

Screen hierarchy: exam list with subject/date (when supplied), status, and `View my seating` if a matching record exists. Detail shows exam source, date and start time only when known, exam venue, room/hall, row/column/seat when provided, updated-at and a clear information-status badge `provided/unverified/demo`. Unavailable data should say `Seating not provided for this demo profile`. A date-only exam remains date-only.

**Audience rule:** The seat record is keyed to a specific authorized demo profile and exam ID, not searchable by anyone entering an arbitrary public roll number. Do not display real registration IDs or bulk seating charts in a public shared application. Role/profile switching must isolate the data. Export/share should be off by default in V1.

### 4.2 Seating updates and notifications

A `SeatAllocation` record references an existing canonical `Exam` object, has `profileId`, room, optional row/column/seat, `source`, version and timestamps. `Version` changes only on an explicit sourced import or Settings-gated simulation; one new in-app notification is created for the affected demo profile. Avoid placing personal seat/row/column in a generic public notification preview. Seating updates do not silently rewrite the exam's authoritative date/time.

If data conflicts (two allocations for same profile/exam/version, or an exam changed without new seating), mark the record `Needs verification` or unavailable; do not choose one as fact. If a seating assignment is revised, retain safe local previous-version information so the student can see that a change occurred.

### 4.3 V2 deepening

Actual exam office dissemination process; data import format and consent; authoritative source/versioning; emergency reschedules; release timing; privacy-safe notification preview; role access, retention and deletion; student identity verification; printer-friendly/export views only if authorized.

## 5. Time Tax — Project-wide Analytics Layer

### 5.1 Why this exists

The original IBO project asks students to quantify time lost to queues/waiting across campus and design interventions. CampusOS must make the operations research legible and avoid turning speculative improvements into fabricated results.

The dashboard distinguishes:

- **Observed baseline:** actual recorded wait/trip measurements with method, date, service, denominator/sample.
- **Simulated scenario:** user-selected baseline, service frequency, adoption and post-intervention assumptions; hypothetical outputs only.
- **Observed pilot comparison:** if and only if real before/after pilot samples are collected and compared with honest limitations.
- **Causal effectiveness:** never claimed merely because historical and pilot averages differ; confounding factors and sampling matter.

### 5.2 Primary measures and formulas

**On-site waiting avoided per relevant visit (minutes):**

`max(0, baselineOnSiteWait - scenarioOnSiteWait)`

A negative raw difference should be preserved elsewhere as possible worsening; use `max` only for an explicitly labelled `avoided time` KPI, so the dashboard doesn't hide deterioration in comparative charts.

**Illustrative weekly student-hours avoided:**

`eligibleStudents × visitsPerEligibleStudentPerWeek × adoptionFraction × averageOnSiteMinutesAvoided / 60`

Assumes uniform visit frequency and wait change for participating students; make each editable with units. Revisit denominator and selection bias before any real-world extrapolation. Services that save **walking/failed trips** should calculate those separately and only add them when event types are non-overlapping and measurement definitions align.

**Total time-cost metrics should not double-count:** e.g. Chill Spot already includes pre-order physical waiting and pickup waiting in a single journey; do not separately add a queue metric that measures the same wait. Service completion duration, preparation time, staff work, notification response time and student on-site waiting are different quantities.

### 5.3 Dashboard and methodological UI

Top section: measured baseline cards if data exists, scenario summary if simulation is active, prominently distinguished by labels. Service selector; editable assumptions panel; charts; methodology/source information panel; observations table when provided. Show empty state `No field observations imported` instead of populated fake field-study graphs. Give users the ability to reset assumptions without deleting field observations.

A complete dashboard card should show statistic, unit, time horizon, evidence type, input records/count and date range or scenario label. If no post-intervention sample exists, show **estimated potential**; not `actual hours saved`. A full semester headline may be presented as a *scenario projection* using an explicit number of term weeks, not a guess.

### 5.4 Example scenarios as demos, not field evidence

- Chill Spot: preparation waiting relocated offsite; pickup/payment waiting remains. State that the order may still take just as long to prepare.
- SS Laundry: avoid a failed trip to pick up an undelivered bag; count walk/wait time only when measured or modelled explicitly.
- Sports/Study bookings: avoid finding facilities occupied; do not treat virtual reservations as proof the physical resource was empty.
- Administration: reduce office trips and follow-up visits through tracked requests, while the approval duration may remain unchanged.
- Community: avoid search/coordination steps, but avoid speculative large 'hours saved' without observations.

### 5.5 Acceptance of a quantitative claim

To describe a result as `field-observed`, retain observation protocol, sample size, units, observation windows, data provenance, missing-value treatment and field date. To describe as `measured improvement`, define comparable baseline/follow-up groups and acknowledge limitations. Never turn demo order timestamps into a real student-hour field study.

### 5.6 V2 deepening

A complete measurement manual, sampling design for each campus service, heatmap instrumentation, demand-peak analysis, service-specific time decomposition, potential queueing-theory calculations where assumptions hold, pre/post comparison plan, uncertainty bands and compelling professor-facing demo narratives.

## 6. Shared schema contracts

Before adding any model, inspect established repositories and existing features. These are *logical data contracts*, not permission to build duplicate stores:

| Entity | Important fields |
|---|---|
| `Notification` | id, recipientProfileId, sourceType, sourceId, transitionVersion, kind, category, priority, title, timestamp, readAt?, deepLink, dataMode, source |
| `NotificationPreference` | profileId, category/subtype, enabled, reminderOffset?, createdAt, updatedAt |
| `CongestionObservation` | id, serviceId, metricType, value, unit, observedAt, sampleWindow?, source, measurementMode, dataMode |
| `ServiceSchedule` | serviceId, operatingHours?, exceptions?, source, lastUpdatedAt? |
| `Exam` | id, courseRef, name, date/time?, status, source, version |
| `SeatAllocation` | id, examId, ownerProfileId, hall?, room?, row?, column?, seat?, source, dataMode, verificationStatus, version, updatedAt |
| `TimeTaxScenario` | id, serviceId, user-entered assumptions, createdAt, basis, saveStatus? |
| `WaitObservation` | id, serviceId, journeyStage, observedAt, waitMinutes?, measurementMethod, sampleContext?, provenance |
| `ImpactMetric` | derived function of eligible input records or assumptions; never store disconnected duplicate totals unless versioned/cached safely |

## 7. Cross-module invariants and error handling

1. One source record, many derived UI views. No parallel source-of-truth notifications or exam dates.
2. Profile-specific information is private even in the demo environment; no real birth dates, exam roll numbers, seat coordinates or phone numbers in generic seed fixtures.
3. Critical in-app alerts require explicit priority policy; hidden display is not equivalent to external delivery failure.
4. Notification deduplication is stable across refreshes and duplicate state transitions.
5. Event timestamps are relative to the configured project timezone (`Asia/Kolkata`), with date-only values distinct from timed values.
6. Data that is stale, unknown, contradictory or unsourced is visibly labelled—not inferred to be accurate.
7. Reset Demo affects local/demo records according to documented scope; no irreversible deletion of supplied academic source files.
8. Derived analytics show units, denominator, sample/time horizon, and whether inputs are observed or simulated.
9. Global search results must not reveal private exam seating or notification data to unrelated profiles.
10. Accessibility: keyboard actions, accessible charts/tables, non-colour states and mobile-responsive filter controls.

## 8. Implementation phases — only after approval

**SH-0** — Audit existing app, Calendar and Home notification/task handling and Time Tax formulas; identify dependencies and schema differences.  
**SH-1** — Shared notification inbox/preferences and event-deduplication domain logic with local persistence.  
**SH-2** — Exam seating demo-profile data model, private detail screen, change alerts.  
**SH-3** — Best Time to Go historical/simulated observation aggregation and transparent chart UI.  
**SH-4** — Time Tax scenario and observations foundations, source-aware metrics, explicit formula/units.  
**SH-5** — Cross-module integrations, visual/keyboard/mobile tests, full regression, precise evidence report.  
**Final phase only** — If separately approved, backend source updates and cross-client sync with proper authorization; no implementation here.

## 9. Proposed acceptance tests (not executed)

### Notifications `SH-AT-01`–`SH-AT-11`
1. `SH-AT-01` Personal inbox shows records only for current demo profile.
2. `SH-AT-02` All/Unread/Important and category filters show correct counts.
3. `SH-AT-03` Marking read updates counts and persists after refresh.
4. `SH-AT-04` Muting optional club messages suppresses them according to documented setting.
5. `SH-AT-05` Sourced critical academic changes remain available under critical policy.
6. `SH-AT-06` Replaying the same transition creates no duplicate notification.
7. `SH-AT-07` Deep link goes to correct canonical record and handles missing record.
8. `SH-AT-08` No external push/email delivery is claimed when not present.
9. `SH-AT-09` Another demo profile cannot view private notification content.
10. `SH-AT-10` Read state or preferences do not alter underlying source records.
11. `SH-AT-11` No records presents a useful empty state.

### Best Time `SH-AT-12`–`SH-AT-19`
12. `SH-AT-12` Selecting service/metric changes chart to the correct dataset.
13. `SH-AT-13` No sample data displays no-reliable-pattern, not zero crowd.
14. `SH-AT-14` All synthetic charts visibly show scenario labels.
15. `SH-AT-15` Date/hour and unit bins are consistent and testable.
16. `SH-AT-16` Unsupported operating hours never become open-now claims.
17. `SH-AT-17` Recommendations are withheld when quality rules aren't met.
18. `SH-AT-18` Metric differences (occupied count versus wait minutes) remain explicit.
19. `SH-AT-19` Selecting a time navigates or creates an optional reminder only, not automatic booking.

### Seating `SH-AT-20`–`SH-AT-28`
20. `SH-AT-20` Each profile sees only its own demo seat allocations.
21. `SH-AT-21` Exam with no seat shows honest unavailability.
22. `SH-AT-22` Conflicting allocations are flagged for review, not chosen silently.
23. `SH-AT-23` Date-only exams do not gain fabricated start times.
24. `SH-AT-24` A simulated seating change preserves version history.
25. `SH-AT-25` Changed seat generates one relevant in-app alert only.
26. `SH-AT-26` Public search cannot reveal a private seat record.
27. `SH-AT-27` No claim of an official university allotment from demo data.
28. `SH-AT-28` Responsive/keyboard detail navigation works.

### Time Tax `SH-AT-29`–`SH-AT-40`
29. `SH-AT-29` Changing scenario inputs recalculates dependent metrics.
30. `SH-AT-30` All time-based metrics have correct units and consistent periods.
31. `SH-AT-31` A hypothetical 20→4 minute visit reduction yields 16 minutes avoided.
32. `SH-AT-32` Negative raw change is not silently advertised as a positive benefit.
33. `SH-AT-33` Adoption and visits are explicit assumptions in weekly-hour projection.
34. `SH-AT-34` The dashboard cannot label synthetic data field-observed.
35. `SH-AT-35` Empty observed dataset has no fabricated observation chart.
36. `SH-AT-36` Incompatible metrics cannot be summed as total saved time.
37. `SH-AT-37` A service's same wait interval cannot be double-counted.
38. `SH-AT-38` Reset scenario does not erase sourced observation records.
39. `SH-AT-39` The methodology explains denominator, source, sample and limitations.
40. `SH-AT-40` Metric chart accessibility and responsive display are checked; manual checks identified if incomplete.

## 10. V2 deepening priorities and source requests

- **Notifications:** precise recipient targeting, emergency/mandatory classification governance, preferences UX and delayed event reception.
- **Best Time:** realistic observation protocol; comparison thresholds, chart information density and forecasting policy.
- **Exam Seating:** authoritative import and permission workflow, actual exam data structure, privacy/security and high-stakes update semantics.
- **Time Tax:** IBO professor criteria, service wait data collection template, queueing analysis assumptions, before/after sample design and final report/storyboard.

Do **not** silently fill these gaps with generic assumptions. The V1 purpose is complete architectural coverage with honest limitations; V2 will refine them independently.

## 11. Claude Code handoff

Save as `docs/features/CampusOS_Shared_Experience_Analytics_Spec_v1.0.md`. Register `COS-SHARED-001` for `F18, F25, F26`, and attach Time Tax as a shared cross-module system. Mark proposed baseline, V2 pending, and implementation pending approval. Audit current Home/Calendar/Services schemas, Notification Center and Time Tax implementation before proposing changes. Preserve prior tests and actual feature progress. Do not introduce new server, real device push or private student data integration until separately approved in the final phase.
