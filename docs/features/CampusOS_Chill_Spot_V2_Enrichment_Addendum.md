# CampusOS — Chill Spot V2: Service Experience, Hybrid Queue Operations & Time Tax Evidence

**Document ID:** `COS-CHILL-V2-001`  
**Version:** `2.0.0-rc1` (V2 enrichment proposal)  
**Scope:** Original brainstorm feature `F01`  
**Date:** 2026-11-02  
**Status:** **PRODUCT DESIGN PROPOSAL — not implementation authorization**  
**Depends on:** `CampusOS_Chill_Spot_Spec_v1.0.md`, `CampusOS_Home_Dashboard_Spec_v1.0.md`, `CampusOS_Unified_Calendar_Spec_v1.0.md`, global Notification Center and Time Tax contracts.  
**Implementation target:** Enhance an *existing* locally running Chill Spot prototype only after approval and a code/spec compatibility audit. **Do not build a production backend, multi-client synchronization, or real operator authentication until the project's final backend phase.**

> **Source boundary.** The original group brainstorm explicitly proposes a student-run café with waits of up to approximately 30 minutes, menu/price/availability browsing, advance ordering, a café-side accept/decline mechanism, and ready notifications. The user separately approved **order ahead with pay-at-pickup**, awareness of the **existing physical line and preparation backlog**, and **hybrid queue intelligence with source timestamps and qualified recorded-order positions**. Real menu entries, prices, opening hours, staffing, processing stations, actual queue discipline, payment procedures, service-time data, and pickup operations have **not** been supplied. All detailed V2 ideas below are proposed design/engineering choices, not assertions about the physical Chill Spot.

## 0. V1 inheritance and V2 change control

### 0.1 V1 invariants preserved without modification

1. `pending → queued → preparing → ready → collected`; student may cancel `pending`; simulator/operator can reject `pending`; no invalid transition or automatic progress.
2. Accepted recorded walk-ins and accepted digital orders contribute to **one recorded preparation backlog**. **Physical counter-line headcount** is separately observed; **ready orders awaiting handover** are separately counted. Never sum unlike units into an allegedly unified queue length.
3. Submission is a **request**, not acceptance. Digital payment, refunds, actual institutional integration, verified pickup ETA, SMS, real push and food delivery are excluded. A collected order is **not** evidence of payment.
4. Unknown is not zero. Every manually reported observation has a source, observation timestamp, coverage and freshness. User can see what is simulated versus supplied versus genuinely observed.
5. All active order statuses, notifications and Home My Activity projections derive from **one canonical order repository**, not UI-specific copies.
6. No production operator portal or backend before the separately approved final project phase.

### 0.2 How this V2 file should be applied

- Treat V1 as the **minimum behavioral contract**. V2 *adds detail and proposed enhancements*; it does not silently supersede V1.
- Any proposed V2 behavior that conflicts with V1 must be recorded in `docs/DECISIONS.md`, explicitly approved, and applied to tests and affected specifications before code changes.
- Do not assume anything in this addendum is already implemented, tested, or signed off. Do not update the feature registry to `verified` based on this document.
- Preserve working existing code. In Claude Code: inspect it and run existing tests **before proposing changes**; provide a screen-by-screen gap report. Enhance incrementally, not by replacing Chill Spot wholesale.

---

## 1. Product outcome, operational boundaries, and service blueprint

**User outcome:** A student can request food before travelling to the counter; understand whether the request is accepted; distinguish a reported busy café from an actual personal order status; track when food is ready; and collect and pay at the counter without having to stand near the café for the full preparation interval.

**Operator outcome (simulator now; actual operator later):** A demonstrator can show walk-in workload, incoming digital requests, acceptance/rejection, preparing/ready/collected transitions, rush-hour pauses, and qualified queue counts without displaying fake live data.

**Business Operations outcome:** Compare conventional walk-in physical waiting to potential order-ahead physical waiting, separating customer waiting from kitchen service time, counter congestion and order turnaround.

### 1.1 Actors and provenance

| Actor / source | Can do now (local demo) | Cannot claim to do |
|---|---|---|
| Student demo profile | Browse, manage cart, submit own request, cancel pending request, view own tracking and notifications; optionally log **self-reported** arrival at pickup | Accept or prepare an order, verify payment, edit another profile's order, claim actual counter status |
| Demo Operations role | Explicitly simulate existing recorded walk-ins, report physical counter line, pause orders, accept/reject and progress eligible orders | Act as an authenticated real café worker or create real off-device updates |
| Seed dataset | Supply repeatable, visibly fictitious menu, orders, queue events and activity scenarios | Represent real café sales, stock, staff or verified queue data |
| Real field observer (later study) | Provide separately labelled observation logs and methods | Auto-convert an anecdotal “30 minutes” into measured outcomes |
| Future authorized café operator | Intended to control real transitions through a server-backed role | **Not implemented in this V2 phase** |

### 1.2 Physical and digital lanes

```
WALK-IN PATH                         DIGITAL PATH
Arrive at counter                   Open CampusOS / browse
Wait to place order                  Submit order request
Pay/order at counter [unverified]    Pending café acceptance
             \                       /
              Accepted *recorded* orders
                       |
             One recorded preparation backlog
                  /          \
             Queued       Preparing
                  \          /
                     Ready
                       |
                Pickup / handover
                (digital: pay at counter)
```

The diagram represents **recorded accepted demand only**. Walk-in orders missing from the log remain real work but invisible to the platform. Payment for real walk-in orders and the exact payment workflow are not established by the source file.

### 1.3 Design performance goals, not promises

- A new student should understand the distinction between *request submitted*, *accepted*, and *ready* at a glance.
- Queue visibility must reduce uncertainty **without fabricating an ETA**.
- The active order should be reachable from Home in at most one direct activation of its My Activity entry.
- Even at high congestion or missing data, the module must communicate clear next actions rather than showing reassuring but invented numbers.
- Returning to the module after refresh should preserve the supported local order history and detail context.

---

## 2. Screen architecture — enriched interaction design

### 2.1 Page A: Chill Spot landing (`/services/chill-spot`)

**Above-the-fold desktop:**

1. Shared CampusOS breadcrumb and title, *Chill Spot*, warm-but-restrained café accent, visible `Demo` / source context, accessible page actions.
2. **Active order strip**, shown first if one exists: reference, truthful status, last change, `Track order` link. When multiple orders are active, show a count and one most recently updated record; open all from `My Orders`.
3. **Café Conditions** panel: reported busy state; separately labelled counter headcount if reported; **recorded** unfinished preparation orders; recorded ready-for-collection orders; `as of` times, source labels and coverage caveat. Use `Unknown`/`Last reported` correctly.
4. Menu entry, search and actually populated category filters; persistent cart indicator.
5. Secondary explanation: “Ordering ahead may reduce on-site waiting; preparation and pickup may still take time.”

**Desktop layout:** two-column primary menu area and sticky cart/active-order rail at comfortable widths. **Mobile:** single column, compact condition card, bottom sticky `View cart` control that does not occlude content or keyboard. Keep the global CampusOS aesthetic; use coffee/terracotta sparingly as contextual accents, not a second design system.

**Important UI differentiation:**

- `Busy` = a *reported* qualitative operational observation, never a computed readiness prediction.
- `Paused` = no **new** digital requests accepted by the interface; existing requests stay visible.
- `Unknown` = lack of recent reliable observation, not a quiet café.
- Show `Reported counter line: 6 people, 4:10 PM (demo)` separately from `Recorded unfinished orders: 12 (demo)`, never “18 people ahead.”

**Empty state:** If there is no menu record, show “Menu not provided” and disable ordering; leave informational café context visible. If no active order, show a clear menu/ordering entry point rather than a fake status.

### 2.2 Page B: Menu browser and item detail

**Menu grid/list toggle (proposed):** List is preferable on narrow displays; desktop may offer compact tile/list modes. A product item shows verified or demo availability, a readable name, optional description, listed price when known, an appropriately sourced image or intentional visual placeholder, and `Add` or `View options` action.

**Search:** Case-insensitive text search over names and supplied descriptions; show empty result count and `Clear filters`. No invented category, tag, rating, dietary label or photo. Optional sorting: name or listed price **only when valid**; do not sort unknown price as zero.

**Item detail sheet:**

- Item name, sourced description, availability, listed price, only **provided** option groups and valid quantities.
- Distinct states: `available`, `unavailable`, `unknown`; unavailable and unknown (under current V1 default) cannot be checked out.
- If a menu source changes a price while the cart is open, flag and revalidate before ordering. No silently applied option substitutions.
- Photos should be accessible and avoid misleading images. Never generate a specific real dish photograph and present it as the cafe's real menu photo.

### 2.3 Page C: Cart and confirmation

**Cart detail:** grouped line items, edit/remove quantities/options, listed item subtotal in INR, no undisclosed fees, no fabricated GST or final bill. Warn if an item has invalid current availability or price. The checkout remains explicitly **Order Ahead · Pay at Pickup**.

**Final review contract:**

- Show a brief “Request pending until café acceptance” note.
- Show qualified current conditions; a busy café or a long recorded backlog is not a readiness promise.
- Confirm that payment occurs at the counter; no card/UPI credentials, online payment confirmation or financial processing.
- Disable duplicate clicks while saving; idempotency key persists a single `pending` request.
- On save failure: preserve full cart, keep user informed, no success toast.
- On successful submission: create canonical order snapshot, clear cart only after successful persistence, navigate to exact order details, emit one in-app submission event.

### 2.4 Page D: Order tracker (`/services/chill-spot/orders/:id`)

Prioritize a **human-readable current status** above a progress bar. A five-segment bar should indicate **steps**, not percentage of elapsed cooking duration. Timestamps appear only for events actually recorded.

**Tracker stack:**

1. Order reference and `Demo`/source tag.
2. Current status and most relevant next step, with short contextual message:
   - `pending`: “Awaiting café acceptance; this is not a confirmed order.”
   - `queued`: “Accepted and in the recorded preparation backlog.”
   - `preparing`: “Preparation started. No verified ready time available.”
   - `ready`: “Ready for pickup. Pay at café counter.”
   - `collected`: “Collection recorded. Payment not verified in CampusOS.”
   - `rejected`/`cancelled`: reason/history and allowed next action.
3. For `queued`, qualified count of **older recorded unfinished** orders **if calculable**; distinguish this from actual start order or an ETA.
4. Timeline of actual recorded transitions and statuses (not fabricated transit animations).
5. Order contents and immutable snapshot subtotal.
6. `Cancel request` **only while pending**; `Reorder` as a new editable cart for history; `Return to menu` always available.
7. A low-emphasis optional **Next scheduled class** link from actual Calendar data—never “we'll finish before your class.”

**Important nuance:** An order starting preparation while earlier accepted orders remain unfinished is not automatically fraud or unfairness; different items can be prepared in parallel. The student tracker should **not** show “Position #5” as a guaranteed cooking rank.

### 2.5 Page E: Ready-for-pickup ticket

- Show only when order status is `ready`.
- High-contrast readable short demo pickup reference (not a verified QR scanner ticket).
- Order number, item summary, `Pay at Pickup`, optional sourced collection location, `Ready at` timestamp if recorded.
- Helpful action `Show pickup ticket` should work offline within the existing browser session; do not claim facility-wide scanner acceptance.
- Opening the ticket must **not** mark `collected`. Only explicit eligible simulator/operator action can do so.
- If collection point is not provided, say “Collection point not provided” rather than inventing a pickup window/door.

### 2.6 Page F: My Orders

Two tabs: `Active` (`pending, queued, preparing, ready`) and `History` (`collected, rejected, cancelled`). List stable reference, current status, order date, amount as snapshotted listed subtotal and item summary. No cross-profile leakage. Deep links reopen the exact order, with safe not-found / wrong-owner state.

**Reorder:** Construct a *new* editable cart using the **current** menu. Present unavailable or changed-price lines for review. Never resubmit a prior snapshot silently.

### 2.7 Page G: Local Demo Operations Lab (presentation-only)

**Strict visual separation** from student mode: an explicit label such as `Simulated café controls — local browser only`; never imitate logged-in actual staff. Could be a separate local route or an expandable panel accessible only via a deliberate Demo Mode control. This is **not an authentication boundary**.

Use four purpose-based areas instead of one large arbitrary form:

1. **Demand:** seed/reset fictional walk-ins, add a recorded walk-in order, show digital pending requests.
2. **Queue snapshot:** set independent counter headcount `0..N` or `Unknown` and reported busy state, observation time and source; view coverage and stale badge.
3. **Order operations:** accept/reject, start preparation, mark ready, record collection, inspect immutable event history. Invalid controls disabled with explanation.
4. **Presentation scenarios:** scenario reset, show process diagram, replay the *manual* demo script. No auto-progress tied to wall clock.

Every operation must pass through the canonical domain service, append a transition event and update existing order projections. No UI-only string replacement. Reset must confirm exact scope and never erase unrelated Calendar/Home data.

---

## 3. V2 queue and capacity model — accurate rather than decorative

### 3.1 Terms and units

| Concept | Unit / source | Must not be confused with |
|---|---|---|
| Counter line | **People** observed waiting to place orders | Accepted preparation orders |
| Digital pending | Submitted **requests** not accepted | Actual accepted workload |
| Recorded preparation backlog | **Orders** `queued` or `preparing`, both channels | People at counter, queue ETA |
| Recorded ahead by acceptance | Number of earlier-sequence **unfinished orders** | Physical rank, exact work remaining, guaranteed finish order |
| Actively preparing | Orders marked `preparing` | Actual workstation utilization unless stations are tracked |
| Ready for collection | **Orders** `ready` | Pickup line **people**, verified payment count |
| Arrival-to-collection wait | **Minutes physically on site**, requires separate observation | Digital order turnaround |
| Total turnaround | Submitted/accepted-to-ready/collection elapsed time | Avoided physical waiting |

### 3.2 Backlog selector contract

`recordedUnfinished = count(orders with status in {queued, preparing} and matching queue context)`.

`recordedAhead(order) = count(matching accepted orders with status in {queued, preparing} and queueSequence < order.queueSequence)` when the order is accepted and currently queued. When `preparing`, show **Being prepared**, without positional claim. For rejected, pending, ready or collected, suppress `ahead`.

Requirements:

- Walk-in and digital accepted orders use one **stable acceptance sequence** in the local recorded queue.
- A physical headcount observation does not generate order records; a ready count does not mean physical pickup queue length.
- Rejected/pending/terminal or already-ready orders never count as unfinished preparation orders.
- The count must say **“recorded unfinished orders ahead”** and disclose missing walk-in coverage.
- An order may finish later/earlier than its sequence implies. Acceptance sequence is not a reliable estimated start time.

### 3.3 Parallel preparation and differing item complexity

**New V2 conceptual layer:** Actual order completion may depend on independent stations/equipment, batch preparation, item composition, staffing and availability. Thus FIFO **admission** should not be conflated with FIFO **completion**.

For the initial prototype, the **minimum viable approach** is:

1. Keep the V1 order-level state machine and acceptance sequence.
2. Let the presenter manually choose when a queued order becomes preparing and when a preparing order becomes ready. Do not infer progress from the number ahead.
3. If demonstrator progresses later accepted orders first, record an **exception reason or preparation note** for this out-of-order behavior; do not claim an immutable strict service-order policy.
4. Show counts and timestamps honestly; do **not** calculate cooking ETA, queue wait minutes, or kitchen station occupancy from count alone.

**Optional V2 enhancement after approval:** A *fictional, explicitly configured* `Preparation Stations` board (e.g. Station A and B) and tagged order dependencies for classroom demonstration of parallel operations. This board is an educational model, **not** evidence of actual Chill Spot equipment. Do not allow a station simulation to automatically alter student order statuses without an explicit manually executed transition. Avoid introducing a multi-item item-level fulfillment engine unless approved; v1 remains all-or-nothing order acceptance.

### 3.4 Fairness and exception policy

**Proposed fairness model:** Recorded acceptance sequence governs the default **right to be considered** for preparation; no automatic privilege for digital orders over earlier accepted walk-ins. Preparation can be operationally non-FIFO when justified by available stations, item complexity, a correction, or an operator-recorded exception. Do not show a guaranteed prep rank.

When a later-accepted order is started first while an older order is queued, proposed simulator behavior is to require a `handlingNote` drawn from `parallel_station | item_ready_in_batch | operator_exception | other`, with explanatory text for `other`. This preserves transparency in the simulated event log. It does **not** turn the reason into proof of actual café policy.

Do not rank customer urgency, social identity, semester or friend networks. No unapproved priority lane.

### 3.5 Freshness and confidence

**Three independent update clocks:**

- Counter-line observation timestamp.
- Last queue-order transition timestamp (for recorded backlog).
- Current order's last transition timestamp.

Never call all three “Updated just now” after an unrelated user action. Refreshing a page does not refresh an old observation. If the reported counter line is stale, show its original count with `Last reported` or suppress current-status styling; if no observation, show `Unknown`. Proposed V1 configurable stale threshold remains **10 minutes for manual counter reports**, not for order histories.

**Café condition state:** `quiet | moderate | busy | paused | unknown`, manually reported or simulated; busy alone does not disable checkout, paused does. If hours are missing, do not infer `open now` from a recent busy report.

### 3.6 No ETA until adequate inputs exist

A valid readiness forecast would need a declared model plus data such as observed historical service durations by item/category, processing configuration and staffing, order mix, accepted workload completeness and validation against holdout observations. The initial app lacks those sources. Therefore:

- Student interface: **No verified pickup estimate available**.
- A possible *future* queue lab can compare **hypothetical service-rate scenarios** (clearly labelled and controlled by the presenter). Such a chart is **not** a personalized promise or a real café forecast.
- Do not display a countdown inferred from `recordedAhead × arbitrary minutes`.

---

## 4. Detailed state, cancellations and exception handling

### 4.1 Legal transitions (inherit V1 unchanged)

| From | To | Actor | Notes |
|---|---|---|---|
| Cart | `pending` | Student | Persisted, idempotent, immutable order snapshot |
| `pending` | `queued` | Demo Ops | Accept, timestamp, assign queue sequence |
| `pending` | `rejected` | Demo Ops | Terminal; optional reason |
| `pending` | `cancelled` | Owning student | Terminal, log event |
| `queued` | `preparing` | Demo Ops | Explicit step; possibly require handling note |
| `preparing` | `ready` | Demo Ops | Explicit step, send one in-app notification |
| `ready` | `collected` | Demo Ops | Explicit handover, payment remains not verified |

All other transitions invalid. A student cannot “mark ready” or mark an order collected. `Ready` is not a promise that the customer has arrived. A customer opening a pickup ticket does not complete the order.

### 4.2 Distinct exception cases

| Case | Proposed handling |
|---|---|
| Pending item out of stock | Demo operator rejects request with reason; student can create new cart |
| Accepted but cannot be prepared | **Do not** silently use `rejected` transition after acceptance; keep current state and show a clearly logged `needsAttention` *annotation* pending a separately approved exception-resolution workflow, or explicitly leave this scenario out of the prototype |
| Student wishes to cancel accepted order | Explain current demo policy; no automatic cancel/refund |
| Student arrives before ready | Optional self-reported arrival marker; no status change or priority boost |
| Student arrives after ready | Remain ready until explicit recorded collection; no auto-expiry absent source policy |
| Item substitution request | Out of scope; do not silently change immutable order snapshot |
| Cafe pauses new ordering | Pending/accepted orders remain intact; no auto-rejection |
| Duplicate rapid checkout | Same idempotency key yields one order; repeat with a new deliberate checkout is a new request |
| Storage or browser refresh failure | Preserve cart until confirmed persist; report unrecoverable local data without fake success |
| Different demo profile | No visibility into another profile's orders/history |

**Proposed V2 exception annotation, not a new order state:** `exceptionFlag?: {kind, recordedAt, note, source}`. It must not allow an unfinished order to disappear from backlog without a valid state transition; high-impact resolution logic is reserved for a later approved change.

### 4.3 Arrival and collection measurement markers (optional)

For Time Tax research demos, a student may explicitly press `I arrived at pickup` after the order is ready or earlier, recording `studentReportedArrivalAt` and source `selfReportedDemo`. This **does not** prove physical arrival, modify order status, establish payment, or trigger collection. To measure real physical waiting, an observer or validated check-in method is required. Never use a fabricated click timestamp as field evidence.

---

## 5. Notifications and cross-module contracts

### 5.1 Notification policy

- One in-app event per unique order transition ID/version; never regenerate on React renders, refresh or view switching.
- Default standard: submitted, accepted, preparing (optional), collected, cancelled. Important: rejected and ready.
- Notification body must say `Demo` for simulated transitions and deep-link to the *owning profile's* order record.
- If notification preference suppresses optional alerts, the order state still updates. A delayed/stale notification must not replace current canonical status.
- No claim of real mobile background push, SMS, email or WhatsApp messages.

### 5.2 Home and Calendar

- **Home → My Activity:** active order with exact status and latest transition time; link to detail. Once collected/rejected/cancelled, leave active group and remain in history.
- **Quick Actions:** Chill Spot route; when an active order exists, offer `Track Order` shortcut.
- **Calendar:** Only use verified stored schedule to show `Next recorded class` with sourced timing, not a readiness promise. Food orders do not automatically become calendar commitments.
- **Time Tax:** Read observational/scenario data through a separate analytics source; never infer physical waiting solely from order timestamps.

### 5.3 Search, favorites and reorder

- Existing product search uses only current menu records, no AI-generated dishes.
- Optional Favorites stored per demo profile; missing/unavailable items remain identifiable but cannot be ordered under V1 policy.
- Reorder requires a new checkout with current menu availability/prices and duplicate-detection safeguards.

---

## 6. Operational analytics: make the IBO story defensible

### 6.1 What can be truthfully measured in the prototype

From explicit recorded events, CampusOS can show:

- Number of **recorded** walk-in versus digital accepted orders (within the demo dataset).
- Accepted unfinished backlog and per-state counts.
- Submission-to-acceptance delay for digital requests where both timestamps exist.
- Acceptance-to-preparation-start waiting within the **recorded** workflow.
- Preparation-start-to-ready duration *for logged events*, not a promise for future orders.
- Ready-to-collected interval *for logged events*, not necessarily physical pickup line waiting.
- Rejection rate and pending cancellation rate based on eligible local records, with denominators and sample counts.

None of those automatically proves saved student-hours or the actual café's throughput.

### 6.2 Fieldwork data model to request from the team

| Indicator | Walk-in observation | Digital observation | Source / caveat |
|---|---|---|---|
| Sample ID | Anonymous ID | Anonymous ID | No unnecessary personal identifiers |
| Day/time and demand window | Observed | Observed | Compare matched windows where feasible |
| Physical arrival at counter | Observer/self-report | Usually not applicable | Do not invent |
| Order placed / digital request submitted | Observed | Logged | Different starting points |
| Request accepted / food preparation begins | If observable | Logged in demo only | Real records require operator participation |
| Food ready | If observable | Logged in demo only | Doesn't tell whether customer stayed on site |
| Physical arrival for pickup | Observer | Observer or self-report | Required for physical wait estimate |
| Final handover | Observer | Observer | Payment completion is separate |
| Menu complexity / order category | Simple sourced classification | Same | Possible confounder |
| Staffing / open stations | Recorded if available | Same | Critical when comparing throughput |
| Coverage and missingness | What could not be observed | Same | Never fill gaps with synthetic field results |

**Primary estimand:** Difference in on-site physical waiting under a clearly defined baseline-versus-intervention comparison, preferably comparing similar service windows and order complexity. Observational comparisons may be confounded; baseline-only measurements can support *potential* savings scenarios but not a verified achieved reduction.

### 6.3 Metrics and formulas

Define separately:

- `counterWait = orderPlacedAt − physicalArrivalAtCounter` (walk-in, when observed).
- `onSitePrepWait = onSiteTimeAfterOrderBeforeReady` (requires observation of whether the customer remained present; do not calculate simply as `readyAt − orderPlacedAt`).
- `pickupWait = handoverAt − physicalArrivalAtPickup` if the journey is accurately recorded.
- `digitalRequestTurnaround = readyAt − submittedAt` for a digital request; **not** physical waiting.
- `recordedQueueDelay = startedPreparingAt − acceptedAt` when both timestamps exist; not physical waiting.
- `illustrativeNetWaitingDifference = baselineOnSiteWait − advanceOnSiteWait`. If negative, display **increased** waiting, not zeroed saving.
- `hypotheticalWeeklyStudentHoursAvoided = qualifiedEligibleOrderCount × illustrativePositiveAvoidedMinutes ÷ 60`, only in Scenario Mode with explicit assumptions and unit notes.

**Example scenario (hypothetical only):** Traditional trip = 6 min counter queue + 20 min on-site preparation wait + 4 min handover = **30 min**. Advance-order trip = 0 min counter queue + 0 min on-site preparation wait + 4 min handover = **4 min**. Difference = **26 min of hypothetical on-site waiting**, not faster cooking and not an observed CampusOS result. If the student arrives before food is ready or pickup becomes congested, the savings shrink or may become negative.

### 6.4 Proposed analytics view — distinguish modes visually

**Scenario Lab:** adjustable numbers and operation assumptions, labelled `Simulation · Not measured`. Show baseline and proposed physical waiting components side by side, plus signed difference. A small sensitivity chart may vary pickup delay and order-ahead arrival timing. No fixed claim like “saved 100 hours this week” without assumptions and denominator.

**Field Observations:** separate imported, timestamped observations with method, sample size, missing data and comparison limitations. If field observations have not been supplied, display empty research state rather than invented bar charts.

**Operations View:** counts and logged transition durations for the demo dataset, labelled `Recorded in prototype`. Distinguish counts of people and orders.

### 6.5 Three operations insights the presentation can teach

1. **Waiting relocation, not cooking acceleration:** Digital ordering allows preparation to occur while the customer is elsewhere; back-of-house service time might remain unchanged.
2. **Arrival and capacity mismatch:** The same system can experience a physical counter line and a preparation backlog simultaneously; neither count is interchangeable with the other.
3. **Fairness versus throughput:** Acceptance sequence, parallel preparation and item complexity create trade-offs; order-ahead should not be assumed to leapfrog walk-ins or guarantee readiness.

---

## 7. Distinctive design ideas — ranked by value and feasibility

| Idea | Student value | Prototype treatment | Decision status |
|---|---|---|---|
| **My order first** landing strip | Prevents hunting across menu | Include when active order exists | Proposed V2 enhancement |
| **Provenance-aware queue cards** | Trustworthy context | Include source, units, coverage and as-of time | Reinforces confirmed V1 requirement |
| **Step-based order tracker** | Clear next action, no fake ETA | Include | Proposed refinement |
| **Digital pickup ticket** | Smooth collection | Already V1; strengthen visuals/accessibility | V1 requirement |
| **Class-aware context** | Helps plan pickup around lectures | Optional, grounded in Calendar | V1 optional |
| **Recorded orders mini-flow** | Teaches queue dynamics in demo | Presenter-only operations board | Proposed V2 enhancement |
| **Busy-hour scenario compare** | Strong IBO argument | Optional Time Tax enhancement | Proposed, not empirical forecast |
| **Favorites / intelligent reorder** | Faster repeat interaction | Add only after core workflow verified | Optional enhancement |
| **Item-level cooking status** | Granular kitchen workflow | Defer: changes state model and workload | Deferred |
| **Guaranteed ready ETA** | Attractive but unsafe without data | Exclude until validated | Excluded |
| **Priority paid pickup / digital leapfrog** | Changes fairness/payment policy | Exclude pending actual café policy | Excluded |
| **Group ordering/payment split** | Social use case | Defer | Deferred |

### Motion and visual hierarchy

- Reuse existing CampusOS warm light design, type, keyboard/focus behavior, spacing and card components.
- Use color to encode semantic statuses and relative importance, always accompanied by text/icons—not color alone.
- Optional subtle transition when tracker changes status; no fake continuous progress animation or shimmering ETA that implies computation.
- Order cards should provide clean text hierarchy: **status > next action > timing/provenance > subtotal**.
- Mobile sticky checkout and pickup ticket must remain accessible with screen reader, focus management, larger text and reduced-motion settings.
- Don't require decorative stock food images or introduce another component library just to make the café page look richer.

---

## 8. Acceptance matrix (V2 additions, in addition to all V1 CH-AT-01..30)

**Legend:** Planned = required candidate test; `PASS` only after executed, dated evidence. Existing V1 tests must continue passing.

### Queue truthfulness and fairness

- **CH2-AT-01** Independently update counter people and accepted-order backlog; neither changes the other automatically.
- **CH2-AT-02** A `pending` request never gains an order-ahead count or enters preparation backlog.
- **CH2-AT-03** Accepted existing walk-ins precede a newly accepted online order in recorded acceptance sequence.
- **CH2-AT-04** Starting an order out of acceptance sequence requires a logged explanatory handling note if the V2 exception feature is enabled.
- **CH2-AT-05** In parallel preparation demonstration, accepted queue position is never shown as guaranteed finish rank or ETA.
- **CH2-AT-06** `ready`, rejected, cancelled and collected orders do not inflate the unfinished backlog.
- **CH2-AT-07** No counter observation renders `Unknown`, not zero or a fabricated busy status.
- **CH2-AT-08** Staleness derives from the observation timestamp, not page-load time.
- **CH2-AT-09** Independently changing an order does not refresh the counter-observation as-of time.
- **CH2-AT-10** Paused blocks new submissions but leaves all existing requests available for processing.

### Checkout, order and pickup

- **CH2-AT-11** Distinct checkout attempts do not collide; repeated same submission token creates one order.
- **CH2-AT-12** Invalid/unavailable/unknown-priced menu entries cannot bypass validation through direct action or stale cart state.
- **CH2-AT-13** Confirmation clearly says request pending and Pay at Pickup; no fake final charge, refund or payment success.
- **CH2-AT-14** Later menu edits do not modify immutable order snapshot.
- **CH2-AT-15** Tracker shows next actions for all seven canonical order states, with no unsupported progress percentages.
- **CH2-AT-16** Pickup ticket only appears at Ready and opening it cannot mark Collected.
- **CH2-AT-17** Student cannot cancel after acceptance under current demo policy.
- **CH2-AT-18** Accepted-but-unfulfillable exception is not handled via invalid `queued → rejected` transition.
- **CH2-AT-19** Cart and order history persist as specified after refresh, and remain profile-scoped.
- **CH2-AT-20** Reorder reloads current prices and availability and requires new confirmation.

### Integration, analytics, and UX

- **CH2-AT-21** Ready transition creates exactly one in-app notification even after reload.
- **CH2-AT-22** Home, My Orders, tracker and Notification Center agree on the canonical status.
- **CH2-AT-23** Deep links to another demo profile's order fail without leaking details.
- **CH2-AT-24** Calendar next-class note never predicts food-ready time or creates an implicit event.
- **CH2-AT-25** Analytics separates request turnaround, queue delay and physical waiting; no substitution of one for another.
- **CH2-AT-26** Scenario Model labels all assumed values and shows negative outcomes honestly.
- **CH2-AT-27** Empty field-observation dataset produces an explicit unmeasured state, not generated findings.
- **CH2-AT-28** Simulator reset is deterministic and does not erase unrelated global modules.
- **CH2-AT-29** Desktop/mobile/keyboard/reduced-motion inspections are performed and documented.
- **CH2-AT-30** Preset demo scenario can be completed from existing accepted walk-ins to student collection, with visible source and timestamp caveats.

### Regression and evidence

Run all relevant original `CH-AT-01..30`, plus `CH2-AT-01..30`. Log for each: test command or manual action, observed outcome, expected outcome, pass/fail/not-run, date and code revision. Do not assert 60 tests passed simply because 60 tests are listed. Distinguish theoretical UI specification from verified browser behavior.

---

## 9. Incremental engineering and demonstration gates

The user has previously viewed a running CampusOS prototype and shared a Claude Code report of Chill Spot implementation. **This does not authorize replacing its existing code or assuming its tests remain green.**

| Gate | Work | Exit evidence | Backend? |
|---|---|---|---|
| **CH2-0 — Baseline audit** | Inspect existing Chill Spot screens/models/tests, compare V1 behavior and this addendum; capture a working revision | File-by-file gap analysis, regression baseline, prioritized implementation proposal | No |
| **CH2-1 — UX refinement** | Page hierarchy, active-order strip, item detail, robust tracker/pickup, mobile polish | Manual browser walkthrough + accessibility sanity checks | No |
| **CH2-2 — Queue integrity** | Improved recorded-order selectors, provenance/freshness UI, optional logged out-of-order handling | Unit tests proving independent counter/backlog, no fictitious ETA | No |
| **CH2-3 — Simulation experience** | Local Demo Operations Lab and repeatable scenarios; ensure all transitions use the domain service | End-to-end scenario with walk-ins, accept, process, ready, collect and reset | No |
| **CH2-4 — Time Tax rigor** | Clear Scenario/Operations/Fieldwork views, editable assumptions and data-source statements | Formulas tested; no observed-result claim without observations | No |
| **CH2-5 — Regression and sign-off** | Tests, responsive/accessibility review, decision reconciliation and honest completion report | Existing V1 + approved V2 acceptance evidence | No |
| **Final project phase** | Protected demo operator client, shared persisted order data and real cross-client status updates | Separate explicit architectural approval | **Only here** |

**Stop after each approved gate.** Do not modify unrelated Home/Calendar behavior merely to match screenshots; identify conflicts and seek authorization if the semantics change.

---

## 10. Presentation script — operational story, not fake “live” claims

**Demo setup:** A clearly labelled *fictional* menu and an accepted backlog containing several recorded walk-ins; independently report that a counter line exists (e.g. `6 people · demo observation at 4:10 PM`). Do not present those numbers as real campus observations.

1. **Show two different queues.** Point out physical people waiting to order versus accepted unfinished orders. Explain different measurement units.
2. **Submit digital request.** The student chooses items, reviews Pay at Pickup and sees `Pending`. Recorded preparation backlog does not increase.
3. **Accept request.** In Demo Operations, explicitly accept it. It joins the same recorded accepted-order sequence behind earlier logged walk-ins; display qualified ahead count.
4. **Demonstrate parallelism (optional).** Start a later order only with an explanatory handling note if an older one is waiting. Explain why accepted sequence does not guarantee finish time.
5. **Move earlier order to ready.** Recorded backlog changes; independent physical counter observation stays unchanged. No fabricated live snapshot.
6. **Prepare student order.** Advance to Preparing and then Ready; tracker, Home and Notification Center update within this local browser.
7. **Show pickup ticket.** Show “Pay at Café Counter,” then explicitly record collection in the simulation. Payment is not verified.
8. **Show service pause.** Disable new order submissions while continuing pre-existing work.
9. **Show Time Tax.** Contrast hypothetical physical waiting with order turnaround; explicitly state that an observed intervention effect has not yet been measured.
10. **Show unknown/stale information.** Suppress or qualify old counter data. Explain the data-integrity design choice.

The **future** separate-device backend demo will replay a simpler subset of this flow after the final infrastructure phase is explicitly approved.

---

## 11. Team inputs still needed (do not fabricate)

- Current Chill Spot menu, item prices, categories, availability and supported add-ons.
- Café location/collection point, opening hours and whether order-ahead pickups are operationally feasible.
- Current walk-in order process (pay first or later), current handover process, accepted-order queue discipline and any justified prioritization rules.
- Staff/equipment capacity, if known, and whether separate preparation stations exist; no inferred count.
- How existing walk-in accepted orders could be logged with reasonable effort, or whether recorded queue coverage will remain partial.
- What source and refresh cadence could substantiate physical counter-line headcount and busy condition.
- Café policy on cancellations after acceptance, uncollected food, refunds and item substitutions, if applicable.
- Any real time-and-motion observations of counter wait, preparation duration, pickup wait and student movement; sampling notes and limitations.
- Whether an anonymous arrival/check-in measurement is feasible or should remain simulation-only.

Where unknown, use the exact V1 constrained/demo behavior; **never** silently fill a gap with generic café assumptions.

---

## 12. V2 decision register — explicit approval boundary

| ID | Proposed decision | State |
|---|---|---|
| CH2-D01 | Keep order ahead / pay at pickup and existing seven-order-state workflow | **Inherited user-confirmed V1 scope** |
| CH2-D02 | Separate physical line, pending digital requests, recorded preparation backlog and ready collection counts | **Inherited user-confirmed hybrid queue intent** |
| CH2-D03 | Avoid numeric ETA, guaranteed cooking rank and unqualified “people ahead” | **Required by V1 honesty rules** |
| CH2-D04 | Enrich landing with active-order-first and source-aware queue snapshot | Proposed V2 UX |
| CH2-D05 | Explicitly acknowledge parallel stations/complexity without inventing station counts | Proposed V2 operational refinement |
| CH2-D06 | Optional handling-note requirement for out-of-order preparation | Proposed V2 enhancement |
| CH2-D07 | Optional self-reported arrival marker; not observed field data | Proposed V2 enhancement |
| CH2-D08 | Separate Scenario, Operations and Fieldwork analytics views | Proposed V2 enhancement |
| CH2-D09 | Optional Favorites/Reorder visual refinement | Proposed V2 enhancement |
| CH2-D10 | Keep multi-client backend and production operator authentication to final project phase | **User-confirmed scope constraint** |

**Sign-off condition:** User approves particular proposed V2 changes (or a subset), then the repository decision log and registry are updated and an implementation gate is separately approved. Until then this addendum informs brainstorming and gap analysis only.

---

## 13. Claude Code handoff — read-only V2 audit prompt

> Read `docs/features/CampusOS_Chill_Spot_Spec_v1.0.md` and `docs/features/CampusOS_Chill_Spot_V2_Enrichment_Addendum.md`, plus `README.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/FEATURE_REGISTRY.md` and any current Chill Spot code/tests. This V2 document is a **proposal addendum**, not permission to replace V1 or start coding. Compare actual implemented features to both documents and return: (a) existing verified functionality and test evidence, (b) missing proposed V2 improvements grouped by CH2-1..CH2-5, (c) potential conflicts, (d) exact data/API model changes, and (e) a minimal regression-safe implementation plan. Do **not** build a backend or modify files in this audit. Wait for approval of the next implementation gate.

