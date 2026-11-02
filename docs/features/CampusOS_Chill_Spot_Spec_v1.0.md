# CampusOS — Chill Spot: Advance Ordering & Hybrid Queue Intelligence

**Specification ID:** `COS-CHILL-001`  
**Original brainstorm feature:** `F01`  
**Version:** `1.0.0`  
**Date:** 2026-11-01  
**Status:** **DESIGN BASELINE — not yet implemented**  
**Related specifications:** Home `COS-HOME-001`, Calendar `COS-CAL-001`  
**Build authorization:** A future, separately approved service-module phase, following the existing Home/Calendar development plan. **Live backend remains deferred until the final project phase.**

> **Approval boundary:** The user explicitly approved **(A) Order Ahead, Pay at Pickup**, **(C) Hybrid Queue Intelligence** with sources, timestamps and qualified order position, visibility of the **existing counter line and outstanding preparation backlog**, and deferral of the actual backend to the very end. Detailed implementation decisions below are proposed engineering/design defaults for the prototype, not claims about how the real café currently operates. The real menu, prices, hours, cancellation policy and field observations have not been provided.

## 1. Product identity and limits

**Purpose:** Allow students to browse a café menu, submit an advance order request, track its acceptance and preparation, and collect/pay when ready. Demonstrate how preparation may occur while students are elsewhere, and how advance ordering interacts fairly with an **already existing queue**.

**In scope:** menu, categories/search, item details, cart, checkout, order list/history, explicit order state machine, order tracking, pickup ticket, reported queue snapshots, recorded walk-ins, local demo-operations simulation, in-app notifications, Home My Activity integration, optional next-class context, and a clearly labelled Time Tax scenario.

**Out of scope:** actual café integration; payment processing; delivery; confirmed ready-time estimates; guaranteed position in the full physical queue; food stock prediction; separate production staff dashboard; push/SMS/email; refunds; group ordering; real cross-device synchronization; and a working backend before the final project phase.

**Non-negotiable language:**
- Submit button: **Place demo order request**, not “Pay” or “Order confirmed.”
- Before acceptance: **Awaiting café acceptance**.
- After acceptance: **Accepted · In preparation queue**.
- When ready: **Ready for pickup · Pay at café counter**.
- Queue with incomplete walk-in records: **X recorded unfinished orders ahead**, never an unqualified queue rank.
- Unknown counter count is **Unknown**, not 0.
- Sample menu prices and service snapshots are visibly marked **Sample / Demo / Simulated**; no fake live or official labels.
- **Collected** does not mean **Paid**; payment happens outside CampusOS and is not verified.

## 2. Information architecture, visual design and routes

| Screen / UI | Content | Actions |
|---|---|---|
| `/services/chill-spot` | Café name, value proposition, demo badge, reported busy state, queue snapshot, active order, menu | Browse, filter, add items, open active order |
| Menu / item detail sheet | Name, category, image or placeholder, sourced price, description, availability, supported options | Set options/quantity, Add |
| Cart drawer (desktop) / bottom sheet (mobile) | Lines, amounts, changes, pay-at-pickup disclaimer | Edit, remove, review checkout |
| Checkout view/sheet | Immutable-review preview, pickup/payment conditions, queue caveat | Submit request |
| `/services/chill-spot?tab=orders` | Active and historical orders for selected demo profile | Filter, open, reorder into a new cart |
| `/services/chill-spot/orders/:orderId` | Current order status, progress, timestamps, recorded-ahead information, pickup ticket | Cancel pending, return, track |
| Local **Demo Operations** panel | Clearly marked local-only queue/order simulator | Simulate walk-ins, reports, acceptance, progress, pause |

**Layout:** Warm café-specific terracotta/coffee accents within CampusOS's existing hybrid professional/student style. Reuse global sidebar, fonts, buttons, card spacing, status chips, notifications, keyboard navigation and responsive patterns; **do not** install a second design system.

**Desktop order:** Header → active order (if any) → reported café/backlog information → menu search/category chips → item grid/list, with sticky cart summary. **Mobile:** Header → active order → compact queue snapshot → menu → sticky cart CTA. Operator-simulator controls must not be mixed into normal student actions.

**Essential visual states:** loading when actually relevant, empty menu/cart/order list, unavailable item, unknown/stale queue, submitting, accepted, queued, preparing, ready, terminal outcomes, validation failure, storage failure. All controls must be real or clearly disabled/explanatory; no decorative dead buttons.

## 3. Actor permissions and information ownership

- **Student demo profile:** May view provided/demo menu, maintain **its own** cart, submit requests, cancel **pending** requests, inspect **its own** orders, view pickup code after Ready, and create a new cart from an earlier order. Cannot set café-controlled statuses.
- **Local Demo Operations simulator:** May record simulated walk-in orders, set *reported* counter-line count and busy state, pause new requests, accept/reject pending requests, and explicitly progress preparation/collection. **Not** an authenticated café worker or connected service.
- **Seed fixtures:** May supply explicitly labelled fictional menu and backlog, not real availability. No identifiable customer/student data.
- **Future authorized operator:** Deferred until final backend. Real role checks and atomic transitions would be enforced by the server only then.

A demo-mode UI toggle is **not a security control**; no real confidential information is authorized in this local prototype. Profile-scoped stores must not expose another profile's order data.

## 4. Menu, item and cart specifications

### 4.1 Menu item fields

Stable `id`; `name`; `categoryId`; optional source-provided `description`; `priceMinor` in integer **INR paise** (or null if unavailable); `availability: available | unavailable | unknown`; optional real supported customization options and their prices; image or placeholder; `sourceLabel`, `dataMode`, `verificationStatus`, `updatedAt`, `visible`.

**Menu rules:**
1. Search and filter by categories **actually represented** in the dataset. Never invent food categories or products when the actual menu arrives.
2. `unavailable` items cannot be ordered. **Proposed default:** also block checkout for `unknown` availability; explain uncertainty and allow browsing.
3. Items with missing/invalid prices may display informationally but cannot be submitted.
4. Customization appears **only** if defined by the source menu; no assumed cheese, sugar, spice, size or allergies.
5. Never assert allergen-free or dietary properties unless independently verified in the supplied information.
6. Provided and fictional fixtures remain visibly distinct; no invented café hours or “Open now.”

### 4.2 Cart behavior

A cart line references menu item ID, validated selected option IDs and positive integer quantity. Quantity control, Remove, Clear Cart (confirm when helpful), Continue Browsing and Checkout must work. Totals derive from current validated prices while editing, using integer minor currency units.

The cart is **profile-scoped** and locally persisted as promised. Submitting does not mutate past orders. Reordering a past order creates a **new editable cart** using *current* availability/prices, warns on changes and never submits automatically.

### 4.3 Immutable order snapshot

On successful request creation, store the item names, option labels/IDs, per-unit prices, quantities, line subtotals, currency and displayed subtotal **as shown at submission**. Later menu changes must not change that order snapshot. If fees/tax/final payment rules are unknown, display **Listed item subtotal**, not a guaranteed bill.

### 4.4 Checkout contract

1. Revalidate nonempty cart, items/options, positive quantities, numeric prices, current availability, chosen profile and whether digital ordering is accepting requests.
2. Show a review panel with the listed subtotal, **Pay at Pickup**, no delivery promise, and the qualified queue information.
3. Student selects **Place demo order request**. Disable repeat submission while pending and use a stable idempotency token in the repository.
4. Persist exactly one new order with status `pending` and a stable demo reference; **clear cart only after persistence succeeds**. If storage fails, preserve cart and report failure.
5. Show **Awaiting acceptance**; do **not** advance to Accepted, Ready or Collected automatically.
6. Create one optional in-app “Demo order request submitted” notification and reflect the order in Home → My Activity.

No bank account, UPI, gateway, payment confirmation, refund, real customer phone number, or guaranteed pickup time is involved.

## 5. Canonical order state machine

The **draft cart is not an order**. An order begins only after a successful request submission.

| State | Student label | Business meaning | In accepted unfinished backlog? |
|---|---|---|---|
| `pending` | Awaiting acceptance | Submitted request, not accepted by café/simulator | **No** |
| `queued` | Accepted · In queue | Accepted and assigned stable queue sequence | **Yes** |
| `preparing` | Being prepared | Preparation explicitly started | **Yes** |
| `ready` | Ready for pickup | Food prepared, not yet collected | **No** |
| `collected` | Collected | Collection/handover explicitly acknowledged | **No** |
| `rejected` | Not accepted | Operator/simulator declined the request | **No** |
| `cancelled` | Cancelled | Student cancelled before acceptance | **No** |

**Permitted transitions only:**

| From → To | Authorized actor | Required recorded effect |
|---|---|---|
| Draft → `pending` | Student | Validated, idempotent request; immutable item/price snapshot |
| `pending` → `queued` | Simulator/operator | `acceptedAt`, unique queue sequence, transition history |
| `pending` → `rejected` | Simulator/operator | Rejection and optional reason, terminal status |
| `pending` → `cancelled` | Owning student | Confirmation and terminal status |
| `queued` → `preparing` | Simulator/operator | `startedPreparingAt`, history |
| `preparing` → `ready` | Simulator/operator | `readyAt`, one readiness notification |
| `ready` → `collected` | Simulator/operator | `collectedAt` without payment-verification claim |

All other transitions are rejected explicitly: e.g. pending → ready, rejected → queued, collected → preparing, ready → cancelled. No timer or student UI automatically advances café-controlled states. Terminal states are immutable.

**Cancellation:** The approved *prototype design default* permits student cancellation **only while pending**. After acceptance, show **Cancellation isn't available for accepted orders in this demo**. Real cancellation/refund policies are unknown and must not be invented. No partial order acceptance or silent item substitutions. Pending requests that can no longer be fulfilled may be rejected with a reason; the student can submit a **new** order.

**Events:** Each transition has ID, order ID, previous/new state, actor, timestamp, order version and optional reason. History is append-only. All screens read the canonical order state; Home cannot maintain its own divergent order status.

## 6. Hybrid queue intelligence — precise definitions

### 6.1 The three distinct queues

1. **Physical counter line:** Persons waiting to place an in-person order. Can only come from a separate manual observation/report. **Not derived** from orders.
2. **Preparation backlog:** Accepted but not finished orders, specifically `queued` + `preparing`; includes **recorded** walk-in and digital orders. Pending is excluded.
3. **Pickup/payment:** `ready` but not collected **orders**. This count is **not equivalent** to persons physically standing at pickup.

Never add these three counts into a single alleged queue length. An order and a person are different units; someone can hold multiple orders.

### 6.2 Existing walk-in orders are first-class *recorded* queue entries

The simulator can seed or explicitly add fictional `walkInRecorded` orders when accepted at the counter, each with stable `queueSequence`, acceptance timestamp and state. A physical line observation of “six people” does **not** automatically generate six accepted orders.

If real walk-ins are not being recorded, CampusOS must say **Recorded orders only; walk-in preparation work may be missing**. It must not present a complete café position or accurate real-time backlog.

### 6.3 Queue snapshot data and honesty

Every displayable observation has a nullable value, type, source, source timestamp `asOf`, `dataMode`, verification/coverage and a freshness label. `null` means **unknown**; `0` is shown only when explicitly reported or computed from a complete relevant stored set. **Proposed prototype default:** manual counter/busy observations become visibly stale after **10 minutes** (configurable). Refreshing the browser cannot update the observation timestamp.

Coverage values: `recordedOnly`, `reportedComplete`, `unknown`. `reportedComplete` may only mean a reporter explicitly said their observations cover the stated scope; it does **not** turn a simulation into verified real-time data. An accepted-order count derived from the prototype's complete *demo dataset* may be complete **within the simulation**, never claimed complete for the actual café.

**Student queue snapshot:**

| Metric | Exact acceptable wording | Data owner |
|---|---|---|
| Busy indicator | “Reported busy”, “Reported quiet”, “No recent report” | Manual/demo observation |
| Physical queue | “6 people last reported at counter · Demo · 4:10 PM” | Separate counter-line observation |
| Preparation | “12 recorded unfinished orders · Demo” | Recorded accepted orders only |
| Pickup | “3 recorded orders ready for pickup” | `ready` order records |
| Own queue context | “4 recorded unfinished orders ahead” | Derived from sequence, when available |

When no observed counter data exists, show **Counter queue unknown**. Never replace Unknown with a seeded zero outside a clearly labelled scenario.

### 6.4 FIFO queue discipline and qualified 'ahead' count

**Proposed simulator default:** Once accepted, walk-in and digital orders join the **same recorded preparation queue**, following FIFO by **acceptance sequence**, not by when digital requests were submitted. Previously accepted recorded walk-ins should not be overtaken automatically by new online requests.

For a newly accepted, still-unfinished digital order, calculate:

`recordedAhead = count(orders where status ∈ {queued, preparing} AND queueSequence < currentOrder.queueSequence AND queueContext matches)`

Only earlier unfinished, recorded orders count. Exclude `pending`, `ready` and terminal states. Show the exact qualifier **recorded unfinished orders ahead**, not **number of people ahead**. When the user's order moves into `preparing`, prefer **Being prepared** rather than a potentially confusing positional rank.

**Handling-order exception:** A real café may cook items out of strict FIFO for practical reasons. The simulator may support an explicit reordering operation **only if** it stores the reason, original acceptance sequence and current processing priority consistently. To keep v1 simple, it is acceptable to **defer manual reordering** and simulate statuses faithfully without claiming actual FIFO processing guarantees. Do **not** silently process a later order before earlier orders while asserting a strict live rank.

### 6.5 Reported line is independent from backlog

Changing a recorded order from queued to ready reduces the **recorded unfinished backlog** and may reduce an eligible order's `recordedAhead`. It does **not** automatically decrement the separately **reported physical counter line**. The two metrics may have different timestamps and coverage. Do not combine them into a fake synchronized measurement.

### 6.6 Quiet / Moderate / Busy / Paused / Unknown

- Quiet, Moderate and Busy are **manually reported qualitative states** in the local demo. No invented numerical thresholds.
- Busy alone does **not** prohibit new requests or promise slow service.
- **Temporarily Paused** prevents *new* submissions, requires a displayed demo reason and leaves accepted and pending orders intact.
- Unknown ≠ Quiet.
- Café hours only show when supplied; no assumed open/closed status.
- No preparation ETA or guaranteed pickup time without a validated method and source data.

## 7. Local Demo Operations: simulation rules

This is **not** the real backend and is **not** a dedicated production worker account. It is a clearly labelled, optionally gated developer/presentation panel *within the local prototype* and must be visually separated from student actions.

**Required simulator controls:**

1. Initialize a labelled fictional backlog with several *recorded walk-in accepted orders*, optionally a pending digital request; reset this scenario with confirmation.
2. Record additional sample walk-in accepted orders, assigning stable queue sequence.
3. Set an independent reported physical counter-line count **or Unknown**, with source timestamp.
4. Set qualitative café state and pause/resume new digital requests; Paused requires reason.
5. Accept or reject digital pending orders with logged action and reason where applicable.
6. Advance any permitted order **one explicit step**: queued → preparing → ready → collected.
7. Display chronological transition history and queue data coverage.
8. Optionally reorder processing only with a required reason and an explicit, consistent handling-order model; otherwise leave reordering disabled for v1.

**Simulator safeguards:** No hidden auto-accept, auto-progress timer, fabricated staff identity, browser-to-browser synchronization or “live kitchen” label. All changes use the same domain service/repository and validation as student actions. Every simulator change is `simulated`, timestamped, audited and reflected across *this browser's* views. The scenario reset must state and limit the records it clears; it must not wipe unrelated Home/Calendar tasks or schedules.

### 7.1 Repeatable presentation journey

1. Open Chill Spot: show **Demo** label, an explicitly reported physical line and previously accepted *simulated* walk-in backlog.
2. Student fills cart and submits; order becomes `pending`. **Recorded unfinished backlog does not increase**.
3. Simulator accepts it: order becomes `queued` behind recorded accepted walk-ins; qualified `recordedAhead` appears.
4. Simulator moves earlier walk-in(s) from queued/preparing to ready; backlog and qualified ahead metric adjust. Reported physical line stays unchanged until separately edited.
5. Simulator advances student order to preparing, then ready; a single Ready notification appears and Home My Activity updates.
6. Show pickup ticket and Pay at Pickup instructions. Simulator marks collected; order moves to history. **Do not assert payment success**.
7. Demonstrate Busy and Paused states; Paused blocks **new** requests while existing orders continue.
8. Demonstrate Unknown or stale line observation and coverage caveat. No exact readiness estimate appears.

## 8. Order tracking, pickup and history

**Tracking card:** order reference; demo/recorded origin; items and snapshotted listed subtotal; current status; truthful available timestamps (`submittedAt`, `acceptedAt`, `startedPreparingAt`, `readyAt`, `collectedAt`); transition timeline; Pay at Pickup note; and queue context only when derivable. Avoid misleading progress percentages when the actual duration is unknown.

**Pickup ticket:** At `ready`, display a short non-PII demo pickup code and “Ready for pickup · Pay at café counter.” At `pending/queued/preparing`, show only order reference and status, **not** a ready ticket. At `collected`, show historical order detail with “Collection recorded; payment not verified in CampusOS.” Avoid QR codes that imply unsupported scanner verification.

**My Orders:** Active = `pending`, `queued`, `preparing`, `ready`; History = `collected`, `rejected`, `cancelled`. Active sorted by latest change, historical by terminal timestamp. Reopen exact record; profile isolation mandatory. Empty state links to menu. Clicking prior order's **Reorder** builds a new cart from current menu and warns on changed or unavailable items.

**Optional class-aware context:** Show the next **recorded** class from the Calendar selector, with correct source/time and caveat about incomplete schedules. Do not promise the order will finish before the class, schedule food pickup on the Calendar, or infer skipping class.

## 9. Notifications, Home and Calendar integration

| Trigger | In-app alert | Default significance |
|---|---|---|
| Request persisted | “Demo order request submitted; awaiting acceptance” | Standard |
| Pending → queued | “Demo café accepted your order; it is in the preparation queue” | Standard |
| Pending → rejected | “Demo order declined” plus reason if recorded | Important |
| Queued → preparing | “Demo order is being prepared” | Optional |
| Preparing → ready | “Demo order ready for pickup” | Important |
| Ready → collected | “Demo order collection recorded” | Standard |
| Pending → cancelled | “Demo order request cancelled” | Standard |

**Exactly-once rule:** Generate at most one notification per distinct transition ID/order version. A refresh, re-render or repeated selector call cannot create duplicates. Each notification deep-links to `/services/chill-spot/orders/:orderId`; it cannot expose another profile's order. Notification dismissal does not alter the order state.

**Home:** My Activity must read canonical active orders with accurate status and last updated time. Terminal orders leave active list and may appear in recent history. No duplicate Home-owned order status. Quick Action points to Chill Spot; an active order can show Track Order.

**Calendar:** An optional “Next known class” note may use the shared Calendar selector. It must not imply food readiness, automatically place each food order on the Calendar, or create a scheduled pickup appointment without an approved feature contract.

**Channel limit:** In-app records only. No SMS, email, WhatsApp, background push, or delivery claim. Closed-app delivery is not guaranteed in this version.

## 10. Time Tax: operational research and measurement

### 10.1 Separate waiting components

- **Counter-ordering wait:** physical waiting before an in-person order is placed.
- **On-site preparation wait:** physical waiting after order placement until readiness, **while the student remains on site**.
- **Pickup/payment wait:** physical waiting from arrival at collection point to handover/payment.
- **Total order turnaround:** time from digital request/physical ordering to ready/collection; **not equivalent** to physical waiting.

A digital `submittedAt`, `readyAt`, and `collectedAt` alone cannot reveal the student's physical arrival or how long they remained at the café. Do not infer physical waiting from those timestamps.

### 10.2 Scenario and fieldwork distinction

Scenario formula (show units and assumptions):

`illustrativeNetWaitingChangeMinutes = baselinePhysicalWaitingMinutes − advanceOrderPhysicalWaitingMinutes`

Display **negative results honestly** as increased waiting. A separate “potential waiting avoided” may show `max(0, difference)` only when clearly labelled **hypothetical potential**; do not conceal the signed comparison.

**Illustration only, not observation:** traditional path 6 minutes counter wait + 20 minutes on-site prep wait + 4 minutes pickup = 30 minutes; order-ahead path 0 + 0 + 4 = 4 minutes; hypothetical difference = 26 minutes. This does **not** mean cooking is 26 minutes faster or that the real Chill Spot saved anyone 26 minutes.

Future observation fields: mode (`walkIn | orderAhead`), anonymous sample ID, date, rush/non-rush window, arrival at counter, order placement, accepted/ready time when known, physical arrival for pickup, handover, observation method, sample size, source, uncertainties and missing fields. Do not generate the missing fields automatically. State confounders such as staffing, food complexity, time of day and unrecorded walk-ins.

### 10.3 Operations dashboard metrics (only where supported)

- Recorded preparation backlog by channel/state.
- Recorded accepted orders ahead, excluding unrecorded demand.
- Acceptance delay, recorded time in queue, preparation interval, collection delay.
- Rejection and pending-cancellation rates.
- Illustrative versus observed physical waiting and total turnaround.

Never derive a guaranteed prep-time forecast from queue length alone. Verified time savings require credible observations and research design; baseline-only fieldwork does not prove achieved intervention effects.

## 11. Canonical models and service boundaries

These are **semantic interfaces**, not an instruction to duplicate existing shared types. Reconcile against the Home/Calendar repository patterns during the authorized engineering phase.

```ts
type OrderStatus =
  | 'pending' | 'queued' | 'preparing' | 'ready'
  | 'collected' | 'rejected' | 'cancelled';
type OrderChannel = 'digital' | 'walkInRecorded';
type QueueCoverage = 'recordedOnly' | 'reportedComplete' | 'unknown';
type ServiceState = 'quiet' | 'moderate' | 'busy' | 'paused' | 'unknown';

type ChillMenuItem = {
  id: string;
  name: string;
  categoryId: string;
  priceMinor: number | null; // INR paise
  availability: 'available' | 'unavailable' | 'unknown';
  description?: string;
  options?: Array<{ id: string; label: string; priceDeltaMinor: number }>;
  imageRef?: string;
  sourceLabel: string;
  dataMode: 'provided' | 'demoSeed' | 'simulated';
  verificationStatus: 'confirmed' | 'tentative' | 'unknown' | 'notApplicable';
  updatedAt?: string;
  visible: boolean;
};

type OrderLineSnapshot = {
  menuItemId: string;
  nameAtOrder: string;
  selectedOptionIds: string[];
  optionLabelsAtOrder: string[];
  unitPriceMinorAtOrder: number;
  quantity: number;
  lineSubtotalMinor: number;
};

type OrderTransition = {
  transitionId: string;
  from: OrderStatus | 'cart';
  to: OrderStatus;
  actor: 'student' | 'demoOperator';
  occurredAt: string; // ISO instant; display Asia/Kolkata
  version: number;
  dataMode: 'userCreated' | 'simulated';
  reason?: string;
};

type ChillOrder = {
  id: string;
  displayNumber: string;
  ownerProfileId: string | null; // null for anonymous recorded demo walk-in
  channel: OrderChannel;
  status: OrderStatus;
  items: OrderLineSnapshot[];
  currency: 'INR';
  listedSubtotalMinor: number;
  paymentMethod: 'payAtPickup';
  paymentVerification: 'notHandledInApp';
  submittedAt?: string;
  acceptedAt?: string;
  startedPreparingAt?: string;
  readyAt?: string;
  collectedAt?: string;
  queueSequence?: number; // assigned at acceptance
  sourceLabel: string;
  dataMode: 'demoSeed' | 'userCreated' | 'simulated';
  verificationStatus: 'confirmed' | 'tentative' | 'unknown' | 'notApplicable';
  version: number;
  history: OrderTransition[];
};

type QueueObservation = {
  metric: 'counterPeople' | 'busyState';
  numericValue: number | null;
  serviceState?: ServiceState;
  asOf: string | null;
  sourceLabel: string;
  coverage: QueueCoverage;
  dataMode: 'demoSeed' | 'simulated' | 'provided';
  verificationStatus: 'confirmed' | 'tentative' | 'unknown' | 'notApplicable';
  note?: string;
};
```

**Repositories/selectors:** `getMenu`, `validateCart`, `submitOrder(idempotencyKey)`, `getOrder`, `listOwnOrders`, `cancelPending`, `operatorTransition`, `recordWalkIn`, `setCounterObservation`, `setServiceState`, `getRecordedBacklog`, `getRecordedAhead`, `getObservationFreshness`, `resetChillSpotDemo`.

Use a shared typed repository, not arbitrary separate localStorage calls inside components. Initial adapter: validated seed fixtures and **profile-scoped browser persistence**. Allocate deterministic queue sequence per local repository. Final-phase server adapter must later provide authenticated, atomic sequence assignment and concurrent transition validation. **Do not build it now.**

**Data invariants:** One order ID and current state; append-only transition history; immutable submitted item/price snapshot; pending excluded from accepted backlog; ready excluded from unfinished backlog; unknown different from zero; per-profile order isolation; no auto-progress; source attribution never silently dropped.

## 12. Error and edge-case matrix

| Scenario | Contract |
|---|---|
| Empty/invalid cart | Reject checkout; preserve editable cart |
| Rapid repeat click | Idempotent single order request |
| Price changes before submission | Revalidate and require student review |
| Price changes after submission | Snapshot remains unchanged |
| Item becomes out of stock | Block before submit; pending order may be rejected with reason, never silently changed |
| Menu has no verified item prices | Informational menu; do not accept fake-priced order |
| Actual hours missing | Display “Hours not provided”, never “Open now” |
| Café reported Busy | Display report; no automatic capacity promise |
| Café Paused | Stop new submissions; continue processing existing orders |
| Pending request receives no response | Remains pending; do not auto-accept |
| Student cancels while operator accepts | One valid first transition wins in local state; future backend must validate atomically |
| Student tries cancelling accepted order | Explain restriction; do not change state |
| Walk-ins not logged | Qualify recorded-only queue counts and do not show complete position |
| Counter count not reported | Unknown, not zero |
| Counter count says 0 but prep backlog >0 | Both are possible; don't auto-correct |
| Stale counter report | Display last report time and staleness, not live |
| Order preparation outside recorded FIFO | If supported, log priority override; otherwise no deceptive strict position promise |
| Ready order not collected | Stays Ready until explicit action |
| Early opening of pickup screen | Order reference only, not Ready ticket |
| In-app notification dismissed | Does not change actual status |
| Reload and profile switch | Recover own records; do not leak other profile's data |
| Local storage unavailable | Surface saving error, never claim request persisted |
| Deep link missing/not owned | Safe missing/no-access state |
| Demo scenario reset | Confirm scope; preserve unrelated Home/Calendar data |
| Payment question | “Handled outside CampusOS”; never label Paid |
| Missing food photo | Intentional accessible placeholder |

## 13. Verification and acceptance test matrix

These are **planned tests**, not statements of completion. Mark verified only after execution with results.

| ID | Acceptance test |
|---|---|
| CH-AT-01 | Chill Spot opens from Services and Home Quick Actions. |
| CH-AT-02 | Sample/source menu shows provenance and no fabricated real prices/hours. |
| CH-AT-03 | Menu search/filter and item detail controls work. |
| CH-AT-04 | Unknown/unavailable item, invalid option or missing price cannot submit under default policy. |
| CH-AT-05 | Cart totals use valid quantities and integer paise accurately. |
| CH-AT-06 | Empty cart prevented; checkout clearly says Pay at Pickup. |
| CH-AT-07 | Duplicate submission attempt persists exactly one pending request. |
| CH-AT-08 | Pending request does not increase accepted unfinished backlog. |
| CH-AT-09 | Saved order price/item snapshot survives menu changes. |
| CH-AT-10 | Student can cancel only Pending; terminal status immutable. |
| CH-AT-11 | All invalid state transitions are rejected. |
| CH-AT-12 | Simulated existing walk-in orders enter recorded backlog correctly. |
| CH-AT-13 | Digital acceptance sequence follows previously accepted recorded walk-ins by default. |
| CH-AT-14 | Backlog includes Queued/Preparing, excludes Pending/Ready/terminal. |
| CH-AT-15 | Count-ahead excludes noneligible orders and always says “recorded”. |
| CH-AT-16 | Unknown counter count differs from explicitly reported zero. |
| CH-AT-17 | Prep progress does not modify independent physical line report. |
| CH-AT-18 | Stale snapshot retains its original timestamp and stale label. |
| CH-AT-19 | Busy does not automatically pause; Paused blocks new submissions only. |
| CH-AT-20 | Simulator changes are explicit, labelled simulated, logged, and never timed automatically. |
| CH-AT-21 | Ready pickup ticket functions without false paid confirmation. |
| CH-AT-22 | Order tracker, Home My Activity and My Orders use identical state. |
| CH-AT-23 | Unique transition makes at most one in-app notification with correct deep link. |
| CH-AT-24 | Reload preserves supported order/cart state and does not create duplicate alerts. |
| CH-AT-25 | Demo profiles cannot see one another's carts, orders or notifications. |
| CH-AT-26 | Reset returns reproducible demo queue without wiping unrelated records. |
| CH-AT-27 | Reorder builds a fresh editable cart with current item availability/prices. |
| CH-AT-28 | Optional next-class context uses Calendar data without a readiness promise. |
| CH-AT-29 | Time Tax clearly distinguishes hypothetical versus observed results, including negative differences. |
| CH-AT-30 | Mobile, desktop, keyboard and reduced-motion journeys are inspected. |

Evidence: `test ID → test command/browser action → expected → observed → pass/fail/notRun → date`. A screenshot alone does not prove working state transitions; `notRun` is not Verified.

## 14. Phased build sequence — *after* current Home/Calendar phases

| Service gate | Scope | Exit criterion |
|---|---|---|
| CH-0 | Read-only repository/spec dependency audit and detailed plan | Plan approved; no code changes |
| CH-1 | Route, café visual language, static validated menu, search/filter, item sheet, cart | Menu/cart + responsive checks pass |
| CH-2 | Order model, idempotent submit, immutable snapshot, pending cancel, order list/history | State/storage tests pass |
| CH-3 | Recorded walk-ins, queue observations, FIFO sequence, honest freshness, local operator simulator | Queue/coverage tests pass; no backend |
| CH-4 | Order tracking, pickup ticket, in-app events, Home projection, optional next class | Cross-module consistency tests pass |
| CH-5 | Time Tax scenario and robust edge-case/UX verification | All applicable CH-AT checks documented |
| **FINAL PROJECT PHASE** | Small protected demo backend, separate simulator client and cross-client updates | Separate explicit approval; not part of CH-1–CH-5 |

Chill Spot is **not** part of already authorized Home/Calendar Phase 0–5. Merely adding this spec to the repository does not automatically permit code changes.

## 15. Missing inputs and controlled defaults

| Missing source/decision | Default while absent |
|---|---|
| Real Chill Spot menu/prices/images | Clearly marked demonstration fixture, no real-world menu claim |
| Real service hours/open days | Hours not provided |
| Accepted counter payment methods | Generic Pay at Café Counter; no specific UPI/cash promise |
| Café cancellation/refund policy | Student pending-only cancellation, no refund workflow |
| Real cooking/queue policy | Simulated FIFO by acceptance; no café-wide fairness claim |
| Real physical queue observation method | Explicit manual/demo report with timestamp or Unknown |
| Completeness of walk-in order logging | Recorded-only coverage, no guaranteed physical queue rank |
| Actual pickup lane/payment counter | Do not imply a separate priority pickup lane |
| Real order preparation times | No ready-time ETA or guarantee |
| Field observations of waiting | Scenario calculator only |
| Real staff backend/client access | Deferred to final project phase |

Any new source data must be validated and annotated. Disagreements or changes to user-approved rules must be recorded in `docs/DECISIONS.md` and reflected in test cases before engineering changes.

## 16. Integration instructions for Claude Code

1. Save this file as **`docs/features/CampusOS_Chill_Spot_Spec_v1.0.md`**.
2. Change `docs/FEATURE_REGISTRY.md`: add `COS-CHILL-001`, original `F01`, status **DESIGN BASELINE / NOT IMPLEMENTED**, future implementation after explicit approval. Update F01's status accordingly **without** changing other feature statuses.
3. Record user-confirmed decisions (Pay at Pickup; hybrid queue with timestamps/qualified queue position; existing physical line + accepted prep backlog; final-phase backend). Mark remaining rules as design defaults subject to change control.
4. Keep root `CLAUDE.md` concise. Do not paste this entire document into it; add a reference when the Chill Spot phase is authorized.
5. Initial instruction to Claude: **read-only audit and dependency-aware CH-0 plan**. Do not scaffold Café, create a payment/ordering backend, or start any new service phase until approved.

**Definition of done:** Chill Spot is Implemented only when the approved screens and local workflow truly work. It is Verified only after acceptance tests have been actually executed with evidence, truthful queue/provenance language is inspected, and cross-module state remains consistent. The final backend remains an independent deferred milestone.
