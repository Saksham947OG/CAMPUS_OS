# CampusOS — FINAL V2 MASTER PRODUCT & IMPLEMENTATION SPECIFICATION

**Document ID:** `COS-MASTER-V2-FINAL-2026-11-02`  
**Version:** 2.1 consolidated (classroom booking added) | **Date:** 2 November 2026 | **Time zone:** Asia/Kolkata  
**Covers:** all **26 original numbered features**, personalized Home, Unified Calendar + Task Planner, first-class **Classroom Bookings** (CR Conference Hall, CR1, CR3, G12) within Bookings, integrated **Time Tax** operations research, the originally brainstormed supplementary concepts, **authorized BMS-email ingestion**, personalized exam-seat extraction, and the demo/production boundary.  
**Status:** **Single consolidated design and implementation handoff**. This document is a specification, **not evidence** that any part of the repository is already implemented or that real campus policies/data are known.

> **Instruction to the coding agent:** Use this document as the **final consolidated functional design brief** for CampusOS. Do not request a new round of brainstorming, repeated read-only audits, or a separate V2 document for every feature. Integrate the capabilities into the **existing** application incrementally, preserve code and accepted behaviors, and use the compact verification protocol in §E. This brief supersedes *unapproved proposals* in older drafts, but **does not erase explicitly approved decisions** (including Chill Spot: *order ahead, pay at pickup*; Laundry: *student-registered + simulated-provider hybrid*; and *defer actual shared backend to the final phase*). Where the already-working implementation diverges, favor backwards-compatible extensions and configurable policy settings over destructive rewrites. The phrase “final” means **final consolidated specification for the original brainstorm**, not that the product is deployed or no future user-requested feature may be added.

---

# A. PRODUCT DEFINITION: WHAT CAMPUSOS MUST FEEL LIKE

## A1. The central promise

CampusOS is a **personal campus operating system** that turns scattered schedules, queues, emails, approvals, facility bookings, student activities, and last-minute updates into a **single trustworthy daily decision surface**. It must reduce two distinct types of friction:

1. **Physical Time Tax:** unnecessary trips, uncertain waiting, occupied spaces, double bookings, back-and-forth at desks, and queuing.
2. **Coordination/Information Time Tax:** hunting messages across email, PDFs, WhatsApp, office notices, club contacts, academic sources and staff; uncertainty about who is responsible and whether information is current.

**Product north star:** “What do I need to know, where do I need to be, and what can I do without wasting a trip?” This is an Introduction to Business Operations artifact, not a generic student social network or an unfounded claim of real university integration.

## A2. Design direction — rich without feature sprawl

- **Personality:** editorial, calm, premium, highly usable, friendly to student life; mature enough for academic/administrative workflows. Not a generic table-heavy ERP; not an overloaded toy dashboard.
- **Desktop:** generous typographic hierarchy, left global navigation, top search and notifications, context-aware right-hand panel where valuable. Dense data only in secondary views; a focused primary action on each page.
- **Mobile:** bottom navigation for the primary four destinations, full-width actionable cards, compact day agendas, sticky relevant actions, thumb-friendly filters, accessible dialogs.
- **Visual vocabulary:** warm cream and off-white surfaces, restrained teal/forest accents for trusted system actions, terracotta/coral as a warm counterpoint, neutral grays; status colors carry meaning only, never rely on color alone. Subtle depth, whitespace, impeccable alignment.
- **Motion:** purposeful and short (200–350 ms typical); state transition feedback, order progression, notification arrival, panel opening. Respect reduced-motion; no distracting animation during urgent exam alerts.
- **Distinctive shared UI components:** provenance/freshness chips; “My Activity” cross-service cards; timeline steppers; friendly microcopy; “Best Time” availability bands; source-specific confidence/unknown states; action-complete confirmation screens; demo-operation simulator separate from real student workflow.
- **Personalized:** batch/section/semester, courses, interests, club subscriptions, preferred alerts, Home widgets and calendar layers; never invent identity or infer a course/seat from a first name.
- **Prototype expectation:** EVERY feature has a navigable, convincing screen and one meaningful end-to-end interaction. Prioritize the richest demonstration flows for **Chill Spot, Laundry, Mess, Administration, Home/Calendar, Email/Exam Alert, and Time Tax**. Secondary features must be genuinely functional, not dead cards.

## A3. Non-negotiable product truths

1. **Provenance on every operational fact:** `OFFICIAL_VERIFIED`, `SOURCE_IMPORTED_UNVERIFIED`, `USER_REPORTED`, `DEMO_SIMULATED`, or `UNKNOWN`; display freshness and relevant source when it affects a decision.
2. **Never fabricate live capacity, service status, source schedules, prices, email receipt, an exam venue, faculty presence, or approval.** If no authorized input exists, show an honest demo fixture, an empty state, or a source request.
3. **Separate intent from reality:** booking ≠ physical occupancy; personal task complete ≠ assignment submitted; form sent ≠ fee paid; order ready ≠ collected/paid; leave-approved demo ≠ gate authorization; email parsed ≠ institution-confirmed assignment.
4. **Canonical records:** each logical booking, assignment, request, order, email or exam seat must have one owning record; Home/Calendar/Notifications show synchronized projections, not duplicated mutable copies.
5. **Privacy:** role- and identity-scoped by default; do not publicly expose student IDs, marks, personal mail, medical evidence, phone numbers or exam-seat lists. No real sensitive data in sample screenshots or fixtures.
6. **Time semantics:** store full timestamp and zone for timed events, preserve all-day/date-only records without inventing midnight deadlines; never infer that a building closes or class cancels because of generic assumptions.
7. **No dark patterns:** never claim a push was delivered, a mail synced, a permission granted, or a transaction paid until the corresponding operation actually succeeded.
8. **Keep the shared multi-device operator/backend implementation for the final integration phase**; a small demo operations panel and local simulation may be built earlier. The **real Gmail bridge** similarly belongs to the connected final phase; its fully interactive mock must exist now.

## A4. Actors and access

| Actor | May do in prototype | Must not be allowed to do |
|---|---|---|
| Student | Manage personal tasks, requests, bookings, orders, check-ins, preferences; view own exam seating and own authorized email | Approve own leave, change official course dates, see other students' sensitive records |
| CR/SR / academic coordinator | Simulate targeted batch updates, notices, classroom booking requests and schedule proposals | Impersonate faculty/academic office or silently overwrite verified records |
| Faculty | Simulated office hours, course materials, decisions on appointment/mentorship and approved class changes | Access unrelated students' private mail or maintenance reports |
| Café / laundry / mess operator | In labelled demo lab: advance service-specific order/status, publish menu/visit or mark pickup | Claim to be a live real-world operator without an authorized integration |
| Security/office staff | Simulated parcel intake/collection and gate-verification step | See private student mail or issue arbitrary institutional approval |
| Sports / club coordinator | Simulate fixtures, team approval, event and recruitment updates | Mutate student-owned academic records |
| Maintenance/administrator | Simulated ticket assignment, response, closure; administrative review | Expose confidential requests publicly |
| Demo facilitator | Switch seeded profiles and operate the sandbox with conspicuous DEMO marker | Send genuine institutional announcements or access live mail without OAuth and authorization |

**No production multi-role login is required for the initial local prototype.** The demo role switcher uses isolated profile-scoped fixture data, and its output must be visibly labelled.

## A5. Global IA / navigation

- **Home:** daily command center.
- **Calendar:** Week / Day / Month / Agenda + Tasks.
- **Services:** Chill Spot, Laundry, Mess, Parcels, Best Time to Go.
- **Bookings:** Gym, Badminton, Other Sports, Library, Music Room, Chill Zone, **Classrooms** (CR Conference Hall, CR1, CR3, G12), My Bookings. Classroom cards must show time-specific availability and offer direct booking from an eligible free slot.
- **Academics:** Course Hub, Exam Seating, academic notices, Faculty, Mentorship.
- **Administration:** Leave & Out-Time, Complaints, Teaching Aids, BMS Office. Classroom reservations and any required approval requests live under **Bookings → Classrooms**, not in an administration-only menu.
- **Community:** Lost & Found, Clubs & Committees, Sports Teams & Fixtures, Campus Events.
- **Inbox:** personalized Notifications, **Campus Mail**, urgent exam updates and announcement digest.
- **Time Tax:** operations dashboard and evidence lab.
- **Settings:** personalization, demo profile, data sources, consent, alert preferences, reset, demo simulator controls.

Routes can be adapted to the existing app's naming. A legacy route must continue to navigate or redirect; never strand existing buttons.

## A6. Original feature index — complete coverage

| ID | Original feature | Primary destination | Main reusable engine |
|---|---|---|---|
| F01 | Chill Spot advance ordering | Services | Ordering + queue simulation |
| F02 | Academic Calendar | Calendar | Canonical schedule/events |
| F03 | Administration: leave and out-time | Administration | Approval workflow |
| F04 | Gym | Bookings | Resource booking + occupancy |
| F05 | SS Laundry and self-service machines | Services | Tracking + booking |
| F06 | Badminton | Bookings | Resource booking |
| F07 | Other sports: TT, pool, basketball | Bookings | Resource booking |
| F08 | Library | Bookings | Rooms + catalogue |
| F09 | Mess occupancy / check-in/out | Services | Presence signals |
| F10 | Mess menu and updates | Services | Meal schedule + publishing |
| F11 | Mess fee/form reminders | Services | Reminder + external link |
| F12 | Complaint tracker | Administration | Service tickets |
| F13 | Parcel and courier alerts | Services | Intake + handover |
| F14 | Teaching aids maintenance | Administration | Specialized tickets |
| F15 | Course Hub / classroom-style pages | Academics | Course + canonical work |
| F16 | Lost & Found | Community | Gallery + claim workflow |
| F17 | Faculty on-campus info & appointments | Academics | Appointment requests |
| F18 | Best Time to Go | Services/Time Tax | Source-qualified demand patterns |
| F19 | Music room | Bookings | Resource booking |
| F20 | Clubs/committees directory and meetups | Community | Profiles + requests |
| F21 | Faculty Mentorship Connect | Academics | Group + invitation |
| F22 | Chill Zone / midnight birthdays | Bookings | Resource booking |
| F23 | BMS Office appointments | Administration | Appointment requests |
| F24 | Sports fixtures, teams, sign-ups | Community | Team + fixtures |
| F25 | Notification Center / preferences | Inbox | Event routing + delivery |
| F26 | Individual exam seating notification | Academics/Inbox | Identity-matched seat assignment |

**Supplementary original ideas, not lost:** unexpected meetings and urgent reschedules; admin/CR/SR weekly updates; campus club and academic announcements; **classroom availability and direct reservations in Bookings (§B-Classrooms)**, including CR-led requests when approval is necessary; leave/attendance counter; optional Google Calendar export/sync; punch-in/out conventions; printing/shuttle/Wi-Fi Time Tax samples. These are covered in §C and integrated into the 26 modules where relevant. Classroom booking is an **additional first-class booking surface**, not a renumbering or replacement of F01–F26.

---

# B. FEATURE-BY-FEATURE V2 EXPERIENCE CONTRACTS

> Each F-section is a **feature-level build contract**, not just a list of cards. Follow its information hierarchy, full user journey, data model/state distinctions, errors, cross-module integrations and one distinctive experience. Screen names are conceptual; reuse established components/routes wherever possible.

## F01 — CHILL SPOT: ADVANCE ORDERING + HYBRID QUEUE INTELLIGENCE

### The real problem
The student-run café can have long waits (the original brainstorm mentions waits of up to roughly 30 minutes). Students need to browse available food, order in advance and arrive when it is appropriate, **paying at pickup**. The café must balance existing walk-in orders, digital requests, preparation capacity and pickup traffic. Do not promise that ordering ahead removes food-preparation time.

### Screens and experience
1. **Café front door:** visual daily feature, open/paused/unknown source-qualified service banner; **“Order ahead”** primary action; clearly separated **ordering line**, **recorded preparation backlog**, and **pickup counter** indicators with “last updated”. Quick access to active order and history.
2. **Menu:** illustrated/photos where supplied; category chips, search, dietary tags only when validated, availability badges, price in ₹, sold-out/unknown statuses, optional supported add-ons, favorites. Item detail sheet states ingredients, supported customizations, expected constraints; no invented nutrition/allergens.
3. **Cart:** persistent until checkout; quantity edits, exact running total, pickup name/identifier, notes allowed only if cafe supports them; clear banner **“Pay at the counter on collection”**; price/item revision confirmation if menu changed.
4. **Order confirmation:** a distinct *request sent* receipt, not accepted or paid; ticket ID and next status. Café decides accept/reject; rejected order includes a reason or generic availability explanation, and safe ability to edit/reorder.
5. **Track order:** big status and next action, compact progress timeline, accepted timestamp, available snapshot of recorded orders ahead, explicit “ETA unavailable” where unsupported, preparation caveat, source freshness, status history, cancel only while permitted.
6. **Pickup ticket:** human-readable code with items and price; “Ready for pickup”, pay-at-collection reminder, collection-point note, optional verified pickup marker, never automatically marked paid.
7. **My Orders:** Active and Past, real state changes, reorder with revalidation, resolved/cancelled records, persistence.
8. **Demo Café Operations Lab (clearly separate):** visually rich Kanban for pending digital requests, merged recorded work backlog, walk-in intake, active preparation stations, ready tickets, service pause, exception toggles and source timestamp. This can be used on one demo machine now; cross-session operator dashboard comes later.

### Operational model and fairness
- **Three physical/logical queues:** `physical_ordering_line` (people not yet fully ordered), `recorded_preparation_backlog` (accepted but unfinished **walk-in and digital** orders), `pickup_payment_line` (people ready to pay/collect). Never conflate counts.
- **Acceptance discipline:** submitting a cart creates `PENDING_ACCEPTANCE`; it does **not** jump ahead of accepted walk-in work. Only accepted orders enter the preparation backlog. Default acceptance sequence is FIFO; operator may log a documented reason for exceptional resequencing (item readiness, equipment, safety). Sequence ≠ order completion, especially with parallel beverage/hot-food stations.
- **Queue position:** “N recorded unfinished orders accepted before yours” only when recorded scope/sequence supports it; if walk-ins are not fully recorded, show “partial recorded backlog” rather than complete queue position. Queue snapshot must state coverage, timestamp and validity.
- **Busy indicator:** `QUIET / MODERATE / BUSY / PAUSED / UNKNOWN`; use configured threshold/source and degrade to UNKNOWN if data stale. No fabricated preparation-time prediction; optional modeled ETA ONLY if preparation rates and relevant workload are calibrated and labelled.
- **State transitions:** `PENDING_ACCEPTANCE → ACCEPTED_QUEUED → PREPARING → READY → COLLECTED`; rejection/cancellation only via permitted transitions and retain immutable order history. `COLLECTED` and `PAID` are **distinct** facts; actual paid status requires specific operator confirmation, not assumption.
- **Item unavailability:** reject whole order in initial workflow; never silently substitute, change pricing, or charge automatically. Delayed orders and closures show actionable explanation. Repeat clicks use idempotency key to avoid duplicate orders.

### Integrated moments and distinctive details
- Home: one Active Order card with order progress; notification: order accepted/rejected/ready/delayed; Calendar: café pickups are not falsely treated as fixed student commitments. Best Time: café crowd source labels. Time Tax: distinguish **on-site waiting avoided** from **actual preparation duration** and **end-to-end turnaround**.
- V2 hallmark: **“From campus to counter”** visual journey plus a **split-queue story** in the simulator: seed two walk-in orders, then a digital order, advance prep in parallel, mark ready, pay and collect; demonstrate how a later quick item might finish sooner without unfair priority claims.
- Special cases: declined digital request, busy/paused state, stale snapshot, walk-in backlog not fully recorded, duplicate submit, item sold out after adding to cart, cancellation attempt after prep begins, app refresh, pickup marked collected by mistake (demo correction journal).

## F02 — UNIFIED ACADEMIC CALENDAR + PERSONAL TASK PANEL

### Core view
Calendar is **not** just a date grid: it consolidates personal activity, academic source records, campus events, bookings, course deadlines, birthday markers and admin updates into meaningful layers. Landing default: **Week view**, with Month / Day / Agenda switches. Date navigation maintains consistent filters.

### Screen contract
- **Top rail:** Today, date range, view controls, source freshness, search, “+ Add”.
- **Left sidebar / mobile filter sheet:** toggle layers `Academic`, `Personal`, `Campus Life`, `Services`, `Administration`; save presets **Academic**, **Personal**, **Campus Life**, **All**; filter additionally by course, batch, section, record type. Filtering hides without deleting underlying records.
- **Grid:** classes as recurring bounded blocks with explicit exception events; exams with verified times/rooms only; date-only deadlines as all-day/date-only milestones, not invented 11:59 PM commitments; bookings reflected from the booking engine; birthdays as subtle permission-based recurring decorations.
- **Right context panel:** tabs **Details / Tasks / Day Context**; event ownership/source history; mess breakfast/lunch/snacks/dinner visible contextually by default (optional time-band overlays, never 4 forced events each day); related free-time suggestions.
- **Tasks:** create personal study tasks, assignment-linked checklists, priority, due date (optionally due time), completion; attach optional focus-time blocks; due-soon sorting; filter by course; drag to schedule only if explicitly personal. Completing task is never “officially submitted”.
- **Free Pockets:** find time gaps from **timed busy** events only; not birthday banners, menus, date-only deadlines; distinguish suggested time from guaranteed facility availability.
- **Deadline Density:** a tasteful 7-day pressure visualization showing academic deadlines, with verified versus personal origin.

### Accuracy and interactions
- Timed events use zone-aware timestamps; recurrence expansion needs start/end bounds; class changes create an exception/correction record and targeted notification, **not** silent deletion or duplicate event.
- Source-authoritative events are student-read-only. Personal events can be added/edited/deleted. Module-owned bookings must be modified through their source module, while Calendar offers a deep link.
- Overlap warning if `max(a.start,b.start) < min(a.end,b.end)` for timed entries; let students knowingly keep personal overlaps but prevent actual exclusive-resource collisions via booking engine.
- Reminders adjustable by category: examples 24h before timed assignment, 9am previous day for date-only deadline, exam 24h, optional classes 15m, appointments 15m; these are editable proposals, not confirmed school schedules. Avoid duplicate alerts on each app load.
- Optional **Google Calendar export** now via standards-compliant ICS; true two-way Google Calendar connection only via consented integration and conflict policy in final connected phase. A PDF/calendar import cannot be declared official solely because it was uploaded.

### Distinctive V2 additions
- **Today → Next → Prepare** strip: next genuine timed commitment, next deadline, suggested task action; coherent across Home/Calendar.
- **Change Lens:** students can see what changed since their last visit (quiz venue moved, deadline revised, meeting cancelled) with former and new values and source.
- **Focus mode:** pin 1–3 goals from tasks, suggest study gap windows, keep calendar visible without clutter.
- Edge cases: unknown exam seating/time, conflicting imports, timezone mismatch, cancelled one instance of recurring class, duplicate mail-derived event, invalid due date, filtered-out reminders, schedule changed less than an hour before start.

## F03 — LEAVE, OUT-TIME AND GATE APPROVAL

### Student workflow
A guided **Request Leave / Out-Time** form: leave type (medical/personal/event/emergency), dates or departure/return times, reason, classes impacted, optional evidence, return/contact details where legitimately needed, accurate privacy notice. Validate date order, overlapping open requests, mandatory fields and sensitive uploads; allow save draft, submit, revise on request, cancel where policy allows.

### Request detail screen
A vertical **“Where is my request?”** timeline shows `DRAFT → SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED | APPROVED | REJECTED → GATE_VERIFICATION_PENDING → EXIT_VERIFIED → RETURN_RECORDED / CLOSED` as relevant. Approval stages are distinct from gate verification; student sees next action, reviewer role, timestamps and reason/notes. Approved demo letter/PDF must display conspicuous **SAMPLE — NOT VALID FOR CAMPUS EXIT** watermark. Never infer attendance is excused from a simulated leave decision.

### Operator/demo journey
Separate authorized-approver simulator with inbox, filters, due waiting time, decisions/reasons, request-more-info, and a distinct security role to verify exit/return. Require a separate explicit step for gate verification; changing `APPROVED` does not auto-open a gate. Cancellation and revisions maintain event log.

### V2 refinement
- **Leave impact preview:** list known classes/assignments falling within date range without claiming formal absence marking.
- **What happens next** card: responsible role, estimated stage only if supported, office policy link if known; no promised SLA.
- **Attendance counter:** optional personal “attendance/leave estimator” with user-entered class-count assumptions; not official attendance records until authorized source is connected.
- Admin Time Tax: quantify repeated office visits and chasing approvals, not magical administrative labor saved.
- Edge cases: duplicate request, evidence not provided, request modified after approval, school holiday overlap, urgent leave, different approver roles, rejected+resubmitted, missing signature, invalid simulated gate clearance.

## F04 — GYM: ACTUAL CAPACITY VERSUS BOOKED SESSIONS

### Student front door
“Gym today” header with sourced opening hours, scheduled maintenance, **reported occupancy** with timestamp and coverage, a capacity band only where capacity known; equipment zones (cardio, weights etc.) and individual equipment state when provided; slot reservations if facility uses capacity-limited booking; activity history and personal attendance estimates.

### Actions and state
1. Inspect opening hours, crowd trend and equipment conditions; choose **Go now** informationally or **Reserve session** where enabled.
2. Book configurable date/time with resource/capacity validation; show `REQUESTED/CONFIRMED` distinctly if approval required; optional check-in and check-out.
3. Self-reported punch-in/out affects only *self-reported* occupancy; cannot be called verified turnstile count. Prevent repeated check-in inflation, offer manual correction for forgotten checkout, degrade crowd estimates when reporting is incomplete.
4. Fault reporting: equipment tagged `AVAILABLE / IN_USE_REPORTED / OUT_OF_SERVICE / UNKNOWN`; maintenance ticket creation routes into F12/F14 ticket infrastructure; closure blocks bookings and sends affected-student alerts.

### Richer experience
- **Find a quieter window:** hourly source-qualified bands and recommendation only if known pattern supports it.
- **Session card:** booking, check-in opportunity, estimated gym crowd, chosen exercise focus; not a fabricated workout tracker.
- **Equipment status map:** optional schematic generated from verified list of zones, not a fake live sensor.
- Edge cases: facility open but specific machine broken, expired check-in with continued physical presence, simultaneous reservations exceeding capacity, schedule change, closures, walk-ins not counted, stale occupancy report.

## F05 — LAUNDRY: SS PROVIDER + SELF-SERVICE MACHINES (HYBRID OPTION C)

### A. SS Laundry (external operator visits campus periodically)
Separate portal tab, visually designed as **parcel-like load tracking without false operator verification**. Students register a load with private student label, item-count estimate (shirts/trousers/etc. optional), date handed over, pickup receipt reference if any and expected date only if stated. Display planned provider visit separately from the **specific load's** expected return.

**Two distinct entities:** `ProviderVisit` (collection/drop-off schedule, arrived/departed/delayed/unknown) and `LaundryLoad` (student-specific intake, status, partial return, collection, exception). An announced visit is **never** evidence that a given load arrived. Student-entered registration begins `USER_REPORTED_REGISTERED`; only a simulated/authorized operator action can mark `RECEIVED`, `PROCESSING`, `RETURN_SCHEDULED`, `ARRIVED_ON_CAMPUS_FOR_THIS_LOAD`, `READY_FOR_COLLECTION`, `COLLECTED`. Delay and exception flags are orthogonal, with reasons, revision date if supplied and status history. Partial returns show returned item count vs still pending, without auto-completing load.

**UX enhancements:** “My next laundry action” card, collection checklist, timeline showing predicted vs confirmed events, a “Why was I notified?” provenance line, color-independent delay banner, consecutive delay history; filters All/Ready/Delayed/Collected. Notify for true individual readiness and planned provider visits separately; missing provider coverage → UNKNOWN.

### B. In-house self-service washing machines
**Machine list** with source-qualified `AVAILABLE / OCCUPIED / OUT_OF_SERVICE / UNKNOWN`, observedAt, physical area, reserve button, wash-cycle duration estimate (machine-configured or user-selected), breakdown notices. **Two independent states:** physical occupancy and booking reservation. A confirmed booking is not proof machine is empty; a timer ending is not proof clothes were removed.

- Flow: machine → real date/slot → reserve → booking confirmed → physically check machine → check-in → start cycle (simulated) → *estimated* completion reminder → verified/manual checkout → machine released only after confirmed clearance.
- Configurable initial examples: seven-day horizon, one active upcoming reservation/student, 10-minute grace period, variable cycle duration. Label all as demo rules, not school policy.
- Overlapping slots on same exclusive machine prevented within prototype store. No-show release frees a booking **only**, not automatically the physically occupied machine. Maintenance disables slots and informs impacted bookings.
- V2 idea: **Laundry Passport** visual progress through SS load lifecycle or self-service cycle, with actionable next step, not two unrelated widgets.

### Failure + Time Tax
Missed visit, incomplete delivery, machine actually occupied despite free booking, cycle overrun, manual correction, wash cancellation, equipment fault, self-reported occupancy stale. Measure avoided wasted collection trips for SS vs avoided machine-search/wait trips for self-service; distinguish baseline observation from modeled gains.

## F06 — BADMINTON: FAIR COURT BOOKING

### Experience
Court availability board with date strip, daylight/evening slot heatmap, court cards, partner picker (optional/consensual), booking confirmation and “My Matches” upcoming reservations. Reservation is limited to the recorded slot; clear venue access rules where sourced. Waitlist is **an offer workflow**, not a phantom guaranteed court.

### Rules
- Shared `Reservation` engine checks facility hours, blackout dates, court-resource overlaps, per-student limits, capacity/party constraints. Sample policy: up to two future bookings, seven-day booking horizon and 10-minute check-in grace; all configurable.
- `CONFIRMED → CHECKED_IN → COMPLETED` or `CANCELLED / NO_SHOW / DISRUPTED`; never release physically occupied court solely because student failed app check-in. Partner invitation is optional and booking responsibility must be clear.
- Waitlist entry preserves timestamp/priority policy; released slot creates a time-limited **OFFERED** state; only acceptance confirms reservation. Declined/expired offer passes to next eligible student.
- Repeated abuses can be **reported** in a demo fairness insight, not silently punished without defined policy.

### Distinctive V2
**Court filmstrip:** visual availability across courts/hour slots; easy swap to another court; **Find me an opening** quick suggestion using only known confirmed reservations; calendar and teammate deep links. Conflicts and closures notify both student and partner when consented; support no-show, partial booking overlap, sudden closure and time-zone/day rollover.

## F07 — OTHER SPORTS: TABLE TENNIS, POOL, BASKETBALL

### Shared foundation, sport-specific surfaces
Single **Play Hub** with tabs for **Table Tennis (TT), Pool, Basketball**, not three copies of badminton. Each shows an appropriate resource: one TT table, one pool table, or one basketball court/half-court, sourced facility times, equipment restrictions and supported booking mode.

### Workflows
- **TT:** book table with optional playing partner, show a compact next-free timeline and waitlist when full; no fabricated automated score detection.
- **Pool:** reserve pool table, acknowledge equipment/usage rules if provided, track equipment-out-of-service separately from room hours.
- **Basketball:** capacity-aware full-court/half-court options if facility truly supports them; propose a casual shootaround or organized group session; prevent split-court double-booking through resource-parent conflict rules.
- **All:** sport-specific instructions, cancellation, check-in, no-show, maintenance, Calendar/My Bookings cards and reported peak periods.

### Creative detail / edge cases
**Quick Play Finder** takes desired sport + available time and shows genuine recorded free windows, not matchmaking claims. Sport-specific duration, group size and equipment constraints configured in data. Handle overlapping parent/child resources, walk-in use, missing hours, overdue checkout, weather-driven outdoor court closure and partner cancellation with transparent status.

## F08 — LIBRARY: STUDY SPACES + BOOK DISCOVERY

### Library Home
A quieter visual identity within the CampusOS system: opening hours with verified/source status, reported crowd band, **Study Now** view, bookable rooms, seats/quiet zones when campus actually provides an inventory, and **Books & Loans**. The library is a place to study, not merely a reservation form.

### Spaces and arrival
- **Study-space availability:** show physical/operational source and timestamp; reserve group-study rooms or designated bookable seats **only** if policy allows. For unbookable general seating, offer occupancy indicator and “best hour” forecast rather than fake individual reservations.
- **Book room:** room capacity, group size, noise policy, amenities, date/time, invitees (opt-in), conflict preview, confirmation, check-in/out and active session extension if allowed. Availability for a room is computed from interval overlap and closures, not from presumed physical emptiness.
- **Quiet Study Compass:** filter by solo/group, power outlet, quiet zone, accessibility information and group size **only where supplied**; use cards with evidence of which criteria match.
- **Occupancy:** student self-reports/punch-in-out are **estimates**. Avoid displaying a precise % unless denominator, source and participation rate are credible.

### Book/loan experience
Search title, author, subject, shelf code and availability where catalogue data exists. Book detail shows copies available/unknown and source timestamp. Track borrowing history, return dates, and reminders only from verified/library-provided or clearly self-entered records. **A personal reminder is not an official due notice**. Link to an existing library catalog if live availability is unavailable; don't implement fictional borrowing/payment transactions.

### Operational edges and integrations
Late return notice, book unavailable, student self-report not institution-confirmed, room booked but occupied, group exceeds capacity, closed library, cancelled session, repeated no-shows, confidential borrowing history. Home shows current room booking and next return reminder; Calendar links to reservations; Time Tax models unnecessary trips for unavailable spaces/books with source limitations.

## BOOKING EXTENSION — CLASSROOM AVAILABILITY & RESERVATIONS (FIRST-CLASS IN BOOKINGS)

### Why this exists and where students find it
Students need to find a suitable classroom for group work, presentations, club meetings or academic preparation **without walking from room to room or contacting several people just to learn whether a room is booked**. This is a full, discoverable destination at **Bookings → Classrooms**, alongside sports, library, music room and Chill Zone; it is **not buried inside Administration**. Add a **Classrooms** tile on the main Bookings landing page and show resulting reservations in the existing **My Bookings** view.

The initial classroom directory contains **exactly these four named resource fixtures**:

| Classroom | Display in directory | Example visual identity | Source requirements |
|---|---|---|---|
| `CR_CONFERENCE_HALL` | **CR Conference Hall** | Conference / presentation room | Confirm actual capacity, location, equipment and booking policy later |
| `CR1` | **CR1** | Classroom | Confirm actual capacity, location, equipment and booking policy later |
| `CR3` | **CR3** | Classroom | Confirm actual capacity, location, equipment and booking policy later |
| `G12` | **G12** | Classroom | Confirm actual capacity, location, equipment and booking policy later |

The *names* above are user-provided. **Current bookings, occupancy, operating hours, amenities, restrictions and staff approval rules have not been supplied.** Populate a coherent, fictional set of reserved/free slots labelled **DEMO** for the prototype; never present them as a live college timetable. Later, authorized imported class timetables and room-allocation notices can be displayed as sourced blockers.

### Classroom Finder — experience and visual layout
- **Bookings landing card:** “Classrooms” with a summary such as “Check CR Conference Hall, CR1, CR3 and G12”; quick action **See availability**. Avoid an unqualified global claim such as “3 rooms free” if no authoritative schedule is connected.
- **Room Radar overview:** four visually distinct room cards in a responsive grid, with a prominent **Now** view and selectable **date, start time and duration**. Cards show room name, known/demo facilities where available, time-specific booking status, source + last update, and one primary action. Display a clear `Demo schedule` strip when using seeded fixtures.
- **Status language:** `AVAILABLE FOR SELECTED SLOT` (no conflict in the **known** schedule and resource allowed in demo), `BOOKED` (with recorded start/end; optionally “Booked until 4:00 PM” if actually known), `PENDING REQUEST` (submitted, *not* confirmed), `BLOCKED / CLOSED` (recorded class, maintenance, authorized restriction), or `UNKNOWN / NOT SYNCED` (insufficient trustworthy data). A slot may be **unreserved in the database but physically occupied**; never equate booking availability with confirmed room emptiness.
- **Timeline:** a compact today/week **availability ribbon** for each of the four rooms; clicking a free interval pre-fills booking details, clicking a busy interval opens its permitted public busy metadata only (e.g. “Scheduled class,” not private organizer information). “Next available” only if the imported/seeded coverage actually supports that computation; otherwise show “Check a specific time.”
- **Filters:** date/time, desired duration, required group size where capacities are known, and supplied room facilities (e.g. projector) where data exists. Never invent seating capacities or equipment to make filters appear complete.
- **Empty/unavailable states:** “No recorded openings in this window” with **Try another time** and **Compare all rooms**. If no schedule source is connected, show **Availability unverified** and the configurable request/demo path, rather than asserting the room is vacant.

### Book directly from an available classroom
The expected student journey is **Bookings → Classrooms → select time → view room availability → tap Book this room → confirm → see booking in My Bookings**, without making the student navigate to an unrelated admin form.

1. Student picks a room (or starts from a free slot), date, start/end time, purpose (study group / project meeting / club activity / presentation / other), group name if applicable, attendee count where policy requires it, and optional notes. The form inherits the chosen room and slot; it should not reset the selection.
2. Before enabling confirmation, verify in the **canonical reservation engine**: correct resource ID, valid full timestamps and Asia/Kolkata display, configured open/blocked periods, already scheduled classes, existing confirmed reservations, resource-specific approval rules and, if confirmed, capacity. Compute conflicts with half-open `[start, end)` intervals so adjacent slots do not falsely collide.
3. **Available demo slot + configured instant-booking permission:** clicking **Confirm booking** creates a real persisted **DEMO_CONFIRMED** reservation immediately and shows room, date/time, purpose, reference ID, next step, and **View My Bookings** / **Add to Calendar** actions. No separate approval screen or redundant second form.
4. **Approval-required room or student role:** keep the same inline flow, but make the primary action **Request this room** and create `PENDING_APPROVAL`; present “Requested — not reserved,” an estimated response only if an actual policy exists, and simulated reviewer approve/reject controls in the demo operations panel. Do not create a guaranteed reservation before approval. If actual booking authority is unknown, default real-world language to **request/verification required**, not guaranteed university permission.
5. **Booked/blocked slot:** disable direct confirmation, clearly explain the recorded conflict, highlight adjacent genuinely recorded free slots and allow **Choose another room** without losing the date, purpose or group size. A new reservation must recheck availability at confirmation time; if another booking has taken the slot, show a conflict and fresh alternatives instead of a false success.
6. **Unknown/unverified slot:** do not label as confirmed free. Students may preview a **DEMO-only reservation** or submit a **request for verification** as configured; no real-world booking promise is made.
7. In **My Bookings**, show upcoming and past classroom bookings alongside other facilities, with status, time, booking source, cancel/reschedule actions where permitted, and a deep link back to the specific classroom/time. Cancellation frees the **recorded reservation** only, not a claim that the physical room has emptied; a reschedule is atomic so the previous reservation is not lost if the new time fails.

### Availability computation, states and ownership
- Each classroom is a canonical `Resource` with `resourceId`, `displayName`, `resourceType=CLASSROOM`, `capacity?`, `features?`, `building?`, `availabilityRules?`, `blackouts`, `bookingMode`, `provenance`, `observedAt`, and optional authorizing role. Unknown fields remain unknown.
- Availability is time-dependent: combine confirmed room reservations, explicitly room-mapped recurring class sessions and exceptions, administrative blocks, maintenance closures and known opening/booking rules. An event without a verified room mapping must **not** block an arbitrary classroom. A **pending request** remains visibly pending but must not masquerade as a confirmed booking; any optional hold requires explicit configurable policy.
- Separate **recorded reservation state** (`PENDING_APPROVAL`, `DEMO_CONFIRMED`/`CONFIRMED`, `REJECTED`, `CANCELLED`, `DISRUPTED`, `COMPLETED`) from **physical use state** (`REPORTED_IN_USE`, `REPORTED_EMPTY`, `UNKNOWN`). Never display a live occupancy sensor without one.
- Bookings are scoped to the requesting student/demo profile; other students see only an anonymized **Busy** interval, not someone else's name, student ID, reason or private notes. CR/SR, student and administrative booking permissions may differ, but no institutional role may be silently impersonated.
- No assumed **8 PM cutoff**, hourly durations, advance-booking horizon, capacity, approval authority or building-access rule. Put all such policies in a source-labelled configuration object; use documented **illustrative** defaults only in the simulator.

### Cross-module effects and delightful details
- **Home:** “Upcoming: CR3 project discussion” in My Activity; a same-day reservation can also appear as Up Next, with a **View room** link.
- **Calendar:** one module-owned event with actual room/time; cancel/reschedule here deep-links to the classroom booking rather than directly altering a duplicate event. Recurring classes can appear as busy blockers only when linked to the same verified room resource.
- **Notifications:** confirmation, approval/rejection, reschedule, approaching start, cancellation and sudden classroom closure. Revision and deduplication protect against repeated notices; a demo role change stays labelled demo.
- **Search/Quick Actions:** searching `CR1`, `G12`, `conference hall` finds their availability view; Quick Action can be **Book a classroom**.
- **Creative signature:** **Room Radar** offers a side-by-side four-room availability ribbon for an identical requested time, with one-tap **Switch to this room** from a conflict—more useful than a generic date picker. If a room is occupied, show the next **recorded** opening, not an invented countdown.
- **Time Tax:** track the number of room-search trips/wait encounters **only from real observations or clearly self-reported data**; model the effect of searchable availability and direct reservations separately. Never label modeled time saved as measured campus savings.
- **Edge cases:** overlapping direct bookings; booked class but no room mapping; teacher changes venue; a room reserved but physically used; missing timetable or stale import; last-minute exam use overriding a booking only when authorized; maintenance blackout; attendee count over known capacity; missed check-in; late-night slots crossing midnight; cancellation after a start time; simultaneous browser requests in the eventual backend.

**Minimum completion demonstration:** open **Bookings → Classrooms**, compare all **four named rooms**, find a labelled demo-available time, book CR1 or another free classroom **directly from its available slot**, see the reservation immediately in **My Bookings**, Home and Calendar, attempt to book the same interval and receive a conflict, then cancel and see recorded availability and notifications update. Verify a booked/blocked/unknown slot is never shown as unequivocally free. This is a focused smoke path, **not a new standalone testing program**.

## F09 — MESS OCCUPANCY: HONEST CROWD INFORMATION

### Student experience
A **“Should I go now?”** meal-room view for breakfast/lunch/snacks/dinner: current meal period, service window (source-provided), reported occupancy band, recent activity stamp, optional entrance check-in and exit check-out. The main card communicates **confidence**, not just a number: e.g., “12 voluntary student check-ins in this demo; full mess occupancy unknown.”

### Data and operational model
- Store attendance signals with `profileId`, `mealPeriod`, `checkInAt`, `checkOutAt?`, `source`, `observedAt`. One open check-in per student per facility/meal; report stale sessions and allow self-correction; use duplicate protection.
- For reliable occupancy, need either verified entry sensors/logs or a representative count. Without them show `reported_activity` and qualitative, source-qualified tendencies; **never infer actual empty seats from only app users**.
- Show meal-based density across time in a micro heatmap, e.g., 15/30-minute buckets, with a legend explaining reported vs observed vs modeled.
- If a late meal opens, meal clock and menu state must align. If checked in after service ends, validate/migrate only according to recorded rules.

### Rich idea
**Quiet Meal Window:** students choose their desired meal and see source-qualified quieter alternatives within operating hours (not promised seating). Link directly to menu and feedback so crowd awareness is useful in deciding when to go.

### Failure and Time Tax
Reporting adoption bias, missed checkout, class-group rush, reduced seating capacity, contradictory staff updates. Compute actual queue delay from field observations separately from occupancy; log mode switches for demonstrations. Home shows mess preview; Calendar shows meal context rather than forced obligations.

## F10 — MESS MENU, SUBSTITUTIONS AND MEAL FEEDBACK

### Interface
- **Today at the Mess:** current/next meal, a visual menu card, served hours, dietary information only if verified, planned items and same-day substitutions distinguished by time.
- **Weekly Menu:** swipeable week grid with breakfast, lunch, snacks and dinner; date navigation, meal labels, special-meal flag, festival menus, saved favorites; archive of published past menus.
- **Changes Feed:** “Planned: ___ → Updated: ___”, effective date and time, reason if supplied, publisher/source attribution, optional alert for imminent significant changes.
- **Feedback:** per-meal ratings and structured signals (taste, portion, timing, availability) with a separate report field; controls for one rating per user per meal and subsequent edit; private by default, aggregate trends only with reasonable sample size.

### Operator workflow
A labelled mess-staff simulator can publish a weekly draft, revise an individual meal, mark a special meal/delay, and view feedback summaries. Distinguish `DRAFT`, `PUBLISHED`, `REVISED`, `CANCELLED` and `UNKNOWN`; publish action is explicit; never auto-disseminate to real students from demo controls.

### V2 details and edges
**What changed today** highlights only changed items; allow allergen alerts only with trustworthy ingredient data and conspicuous disclaimer if unknown. If an item runs out, distinguish menu plan from live availability. Preserve prior versions for accountability. Do not flood every student when minor spelling is corrected; urgency/targeting configurable.

### Integration
Mess Preview on Home, contextual Calendar side rail, Notification Center, Best Time to Go. Waiting-time research can compare congestion before and after schedule awareness, but satisfaction ratings are not a proxy for queue minutes.

## F11 — MESS FEES, FORM AND PAYMENT REMINDERS

### Student-facing payment hub
The original process uses an existing **Google Form / authorized instructions**, not an integrated payment gateway. Show an upcoming/due/overdue bill timeline only when **amount, deadline and eligibility** are sourced. Display payment instructions, known late-fee policy if formally supplied, official form link, receipt upload link if needed, and **payment status confidence**.

### Strict status separation
- `DUE` = bill information exists.
- `FORM_OPENED` = clicked external Google Form, **not** submitted.
- `SELF_REPORTED_SUBMITTED` = student claims submission, **not verified**.
- `OFFICIALLY_CONFIRMED` = confirmed by an authorized verified payment source, only when integrated.
- `DISPUTED/UNKNOWN` = mismatch/missing source.

### Richer UX
A **Due Soon** bar provides exact date without invented late fees; a clear “Open official form” action with external-site disclosure; personal reference number/receipt storage only with consent and role scoping. Reminder frequency has quiet rules; never mark paid simply from tab visit. Resolve multiple cycles, duplicate notices, outdated payment links and students who do not owe fees. No payment card collection by CampusOS prototype.

## F12 — CENTRAL CAMPUS COMPLAINT TRACKER

### Friction being solved
Students should not need repeated physical office visits to ask whether plumbing, power, Wi-Fi, washrooms, cleaning or residential infrastructure problems are even registered. A ticket is a trackable contract: who owns the next step and what happened, without promising an unsourced repair deadline.

### Student journey
1. **Report Issue:** category, building/floor/room or public location, description, impact, optional photo, accessibility-aware upload, preferred contact/visibility and a warning before including personal information.
2. **Possible duplicate check:** show related existing public-safe issue records near same location; offer “I'm affected too” instead of duplicates, while preserving distinct private complaints.
3. **Submission receipt:** stable ticket ID, timestamp, status, expected next role, source/simulation label.
4. **Track ticket:** `SUBMITTED → TRIAGED → ASSIGNED → IN_PROGRESS → AWAITING_PARTS / AWAITING_INFORMATION → RESOLVED → CLOSED`; reopen as appropriate; readable history and remarks with visibility controls.
5. **Resolution check:** student acknowledges repair or flags still-broken; the difference between operator `RESOLVED` and user `CONFIRMED_FIXED` is explicit.
6. **My Reports:** open/closed filters, search by ID, saved locations, report-again shortcut.

### Operator and insight layer
Simulated facilities dashboard with location map/list, category queues, duplicate aggregation, assignment, priority, due tracking only if SLA known, recurring issues and median resolution time on observed demo records. Priorities are based on impact/safety criteria, not student popularity alone. Show staff workload respectfully; no gamification of sensitive reports.

### Edge rules
Confidential complaints need separate limited visibility; uploaded images can contain private details, so redact or avoid public display. Handle duplicate reports, false closure, reopened cases, offline submit, large images, unsafe attachment content, status changed during viewing, and unresolved ticket after staff handover. Link only relevant building maintenance alerts in Home/Notifications; Time Tax counts actual avoided follow-up visits when measured.

## F13 — PARCELS & COURIER ARRIVAL ALERTS

### Student portal
**My Parcels** displays `Expected` (self-entered; optional), `Arrived at Campus` (logged by authorized/demo gate), `Ready for Collection` (if separate), `Collected` or `Exception`; courier name, arrival time, named collection point, package reference (masked), optional collection code. Clear difference between a tracking prediction and a gate-confirmed arrival.

### Security-desk workflow
Intake a parcel by selecting student from verified directory/demo profile, courier, tracking suffix, condition/notes, received time and holding area; avoid full sensitive label photos in public. On intake, create a private student notification with collection location and hours if sourced. Student collection requires **explicit staff handover**; viewing notification does not mark collected.

### Richer UX
- **Pickup Pass:** student-specific ticket with code and minimal identifying information, not a transferable public QR credential unless role validation implemented.
- **Collection Reminder:** configurable after a known period (e.g., demonstration 72 hours), quiet hours and repeat caps; collection list distinguishes unclaimed from lost.
- **Handover Ledger:** who marked collected and at what time; exception for misassigned parcel, duplicate courier scans, damaged package, ID mismatch, multiple parcels or wrong pickup recipient.
- **Privacy:** show only the owner's parcels; security staff see authorized records for their desk. Logs may deter or investigate errors but **do not guarantee theft prevention**.

### Integrations
Home My Activity, urgent/digest Notification Center, collection window and location in details, Time Tax unsuccessful trips and missed pickup loops when observed. Real cross-device intake only in final backend phase.

## F14 — TEACHING-AID MAINTENANCE: CLASSROOM READINESS

### Dedicated intake
Simple faculty/student form: classroom (room ID from known inventory), equipment `PROJECTOR / MICROPHONE / SMARTBOARD / AC / OTHER`, fault type, urgent class start time if known, short description, optional media, recurrence toggle. Reuse F12 ticket infrastructure and ID, but give a classroom-specific UX, unlike generic hostel plumbing forms.

### Teacher-facing view
**Is my classroom ready?** shows known reported equipment faults and timestamps for a selected room, with ability to report another incident, subscribe to repairs, or open an existing ticket. If no equipment data, say “No current verified data” rather than “all functioning”.

### Technician simulator
`REPORTED → ASSIGNED → DIAGNOSING → WAITING_FOR_PARTS → FIXED_REPORTED → VERIFIED_CLOSED` (or reopened); preserve location/equipment history; group repeat failures, log repair duration, share closure status with affected teacher/CR when subscription is enabled.

### Operations enrichment
**Lost Class Minutes** evidence form: start of disrupted lesson, start of working equipment, number of affected students (if observationally collected), optional alternative-room solution; compute person-minutes cautiously, not automatically equate equipment downtime with educational minutes lost. Surface recurrent room defects and maintenance lead time. Handle duplicate fault reports, unrelated equipment in same classroom, wrong room selection, unresolved ticket at next class, unsafe photo content.

## F15 — COURSE HUB: LIGHTWEIGHT CLASSROOM WITHOUT FAKE LMS CLAIMS

### Course landing and structure
A subject dashboard per enrolled course: title, code, section, faculty contacts (sourced), next lecture, announcement preview, key materials, forthcoming deadlines, personal preparation progress. Reusable four-tab structure: **Overview / Announcements / Materials / Assignments & Projects**; optional Discussion/Questions only if an in-app or approved contact path exists.

### Resource library
Categorize lecture decks, readings, case studies, recordings (permission-dependent), external Drive links, suggested prep and pinned items. Search within course, tag by unit/week, show source, publish date, link permissions and last update. Broken or permission-denied links should be visibly actionable, not silently blank.

### Assignment system
Every course assignment has one canonical deadline/event, source, instructions, attachments/URL, known submission destination, version history and personal task/checklist linkage. **Personal task `COMPLETED` never means official assignment submitted.** External LMS/Google Form click doesn't prove submission; allow student self-reported submission with honest indicator. Changed due dates generate event correction and targeted alert. Separate assignment *due date* from student-created *study schedule*.

### Project/group work
Projects group milestones, tasks, responsible members (only with consent), deadlines and a link to F21 mentorship; integrate with My Tasks and Home. Group members should not automatically gain access to each other's private notes. Optional helpful **Course Sprint** panel presents this week's actionable preparation—not invented marks/grades.

### Academic communications
CR/SR weekly updates and faculty announcements are separate source classes; display intended audience/section, revision history, and priority. Email-ingested announcement can be attached with provenance, but duplicate detections must not create second independently editable deadlines.

### Failure cases
Unenrolled course, replaced professor, mistaken date in WhatsApp forwarded note, conflicting faculty vs CR notice, link access denied, overlapping assignments, source correction near deadline, repeated email thread edits, archived course. Home + Calendar + Notifications must remain consistent.

## F16 — LOST & FOUND: TRUSTWORTHY CAMPUS GALLERY

### Student experience
Photo-first but privacy-aware **Lost / Found** tabs; search and filters by item type, date range, campus location, color, recent/relevant. Start **Report Lost** or **Report Found** with image (optional), category, description, date/time range and approximate location. Found-report owner may choose security-office custody vs individual custody; protect exact private contact info.

### Matching and claims
- Candidate matches use interpretable features: category, color, date/time proximity, approximate location, text similarity; **label “possible match,” never “confirmed match.”** Can begin with deterministic scoring; no need for AI-image recognition.
- Claim workflow asks private distinguishing detail **not visible in public listing** (mark, contents, serial suffix). The finder/authorized office reviews; student identities and private evidence stay protected. Do not make guessable public answers into authentication.
- State model: `LISTED → POTENTIAL_MATCH → CLAIM_REQUESTED → UNDER_VERIFICATION → HANDOVER_ARRANGED → RETURNED/CLOSED`, with rejected/disputed path. Close the public gallery entry when confirmed returned; retain private audit trail.

### Distinctive details and safety
**Hopeful Matches** carousel with reason tags (“same category, nearby building, similar date”); clear report-again, saved search and alert if someone submits a plausible match. Lost ID cards should not show full student ID or addresses; sensitive electronics never show complete serial. Avoid direct public phone posting; provide mediated messaging/office pickup. Protect against fraudulent claims, duplicate photos, stale listings, recovered item, unsafe meetups and mistaken match.

## F17 — FACULTY DIRECTORY & APPOINTMENTS

### Discovery
Search faculty by subject, department/teaching courses, research interest where available and meeting purpose. Card shows **published office hours**, location or virtual channel when verified, preferred contact route, and **availability status** with provenance—not a speculative “Professor is on campus now” indicator.

### Booking/request flow
Choose consultation type (academic doubt, project, recommendation discussion, etc.), preferred times, student/course context, brief agenda; send **meeting request**, not instant booking unless a faculty-owned slot is truly bookable. Distinguish `DRAFT → REQUESTED → CONFIRMED/DECLINED/PROPOSED_NEW_TIME → COMPLETED/CANCELLED`. Request adjustments should preserve trail and notify student; conflict-check against personal Calendar and faculty demo calendar where data known.

### Enrichment
**Office Hours Finder** with eligible time windows; “prepare your question” pre-meeting task list; meeting card with agenda, location, preparation materials, appointment etiquette and cancellation. No fake current-presence map; when faculty availability is unknown, the primary action becomes “Request a time.” Handle unanswered requests, faculty off-campus day, office hour revised, multiple requests for same slot, student's personal overlap and short-notice reschedule. Team can showcase reduction in corridor-hunting/coordination time using survey/observation.

## F18 — BEST TIME TO GO: QUALIFIED PEAK-LOAD INTELLIGENCE

### The feature's promise
Help students pick lower-friction times for **mess, Chill Spot, gym, self-service laundry and library**, optionally printing/admin services when fieldwork records exist. This is an operations analytics interface, not an uncalibrated “AI forecast.”

### Screen
A service picker plus **Today by hour** band chart, day-of-week toggle, “current snapshot” vs “historical pattern” vs “modeled forecast”, confidence/freshness legend, data sufficiency banner, and explainable recommendation: “Based on 12 observed Tuesdays, 2–3 pm was less crowded than 1–2 pm” **only if such observations genuinely exist**. With no evidence, display demonstration data labelled **Illustrative**, and say how to collect real observations.

### Prediction/data hierarchy
1. `OFFICIAL_VERIFIED` capacity counts or structured logs with valid time.
2. `FIELD_OBSERVED` manual waits/queues sampled and documented (observations can be trusted as evidence for a sampled window, not universal live conditions).
3. `USER_REPORTED` crowd entries with known adoption/selection bias.
4. `MODELLED` prediction calibrated using samples and transparent assumptions.
5. `DEMO_SIMULATED` visuals for interaction design.
6. `UNKNOWN` when input absent/stale.

### Model and UX details
Compare hourly median waits, sample sizes, distribution/uncertainty rather than hiding behind one fake score. Avoid extrapolating from an atypical Monday or one sample. Show time savings as **potential scenario**, not achieved claim. Strong visualization: a small **“Go now vs go later”** comparison showing wait, travel and availability caveats; avoid sending everyone to the same supposedly quiet hour (self-induced demand spike). Service-specific constraints: menu hours, machine cycle times, gym closures, library access rules. Handle holidays, sudden events, lack of history, censored observations and sparse time windows gracefully.

## F19 — MUSIC ROOM: CREATIVE SESSIONS & RESOURCE CARE

### Musical experience, not a generic meeting room
Music-room landing features a warm studio-like hero, equipment/facilities list where verified, booking status, operating rules, a **practice/jam session** mode choice and a compact weekly reservation timeline. Students should be able to coordinate a 2–5-person jam as readily as a solo rehearsal (capacity only if sourced).

### Request and use
Pick date, start/end, purpose, expected group size, optional invitees, room/equipment needed, agree to known use rules, confirm booking under shared engine. If approval required, show `REQUESTED` until explicitly accepted. Group organizer owns cancellation; invited students receive opt-in Calendar/Notifications. Check-in/out marks **reported attendance**, not an electronic door sensor.

### Enhancements
**Session Kit** with lineup/instruments checklist, rehearsal goal, permitted equipment notes and reminders; optional recurring practice series bounded by a semester. Equipment outage affects *relevant* bookings and shows alternatives only if known. Don't promise instruments or microphones exist without a sourced inventory. No recording/upload of student music without consent.

### Edge and integration
Double bookings, last-minute extra members, late equipment damage report, missed check-in, noise restrictions, surprise staff closure, booking after midnight; share Time Tax model for wasted room-search and coordination. On Calendar, music bookings are timed commitments and appear in Home My Activity.

## F20 — CLUBS & COMMITTEES: DISCOVERY, RECRUITMENT, MEETUPS

### Student discovery
An expressive, editorial **Campus Life Directory** filterable by club/committee, domain (art, entrepreneurship, social impact, sports, academics), recruitment open/closed, meeting format and interest. Each club page should tell a story: mission, signature events, media/links authorized by the club, leadership roles, member contacts **only by opt-in**, official socials and recruitment window.

### Three journeys
1. **Explore:** browse → filter → club page → follow/subscribe → add public event to Calendar.
2. **Join:** opening announced → read eligibility/instructions → open official application link or demo expression of interest → track `INTERESTED / APPLICATION_OPENED / SELF_REPORTED_APPLIED / SELECTED` only with verified source; clicking a form never proves acceptance.
3. **Meet a member:** choose role, purpose and preferred time, submit mediated meeting request → coordinator demo accepts or proposes alternate slot → confirmed meeting appears in Calendar. Contact details stay role-controlled.

### Enrichment
**Explore by curiosity:** card grouping around interests rather than just acronyms; **Ask an Insider** appointment path; student-friendly upcoming recruitment tracker; officer roster with term dates and source. Important distinction between 'member', 'applicant', 'follower' and 'attendee'. Student cannot edit official club pages by default; simulated coordinator can. Deal with archived committees, outdated leaders, closed recruitment, duplicate events and inaccurate public phone numbers.

## F21 — FACULTY MENTORSHIP CONNECT: PROJECT GROUPS + INVITATIONS

### Student journey
Create a project workspace with title, 100-word concept, course/club context, roster and owner; define milestones and what guidance is sought. Discover a relevant professor through sourced interests or course association, draft a respectful mentorship invitation, and send through **simulated in-app invitation** unless an authorized real channel is configured.

### Mentor relationship states
`INVITED → VIEWED (only if reliably known) → ACCEPTED/DECLINED/NEEDS_DETAILS → ACTIVE → CONCLUDED` with optional withdraw. A student clicking send is not faculty acceptance; never simulate a delivered email without real email integration. Faculty demo view can accept, suggest meeting time, ask for scope clarification, comment on milestones and end mentorship.

### Richer project experience
**Mentorship Timeline:** milestone cards, meeting cadence chosen by group, feedback checkpoints, task assignment, files/links, question parking lot, action items after meeting and group health view (progress = self-reported tasks, not professor-assessed achievement). Consent-based joining/leaving; faculty access limited to shared project info, not personal schedules or other courses. Calendar and Course Hub show the same canonical milestones. Handle duplicate mentor invitation, professor decline, group breakup, a member leaving, expired invitation and unsent/draft message.

## F22 — CHILL ZONE: MIDNIGHT BIRTHDAY SPOT COORDINATION

### Distinctive context
The source brainstorm describes **three preferred 12 a.m. birthday-celebration spots**, commonly first-come-first-served and busy in September. They are currently **unnamed** in the available materials: label them **Spot A/B/C — Demo** until the team supplies real names, capacities, permitted hours and any actual booking authority. Never imply campus officially grants exclusive access unless it does.

### Interface and journey
Birthday-themed yet tasteful **Celebrate Planner**: date-first picker, 11:30 pm–12:30 am crossing-midnight timeline, three parallel spot cards showing *recorded* reservation requests and confidence labels, basic amenity/location fields where supplied, optional number of guests and accessibility needs, submit, share invitation link only with consenting guests, and manage change/cancel.

### Operational safeguards
Reservations use full datetimes; `2026-11-02 23:30 → 2026-11-03 00:30` must not accidentally conflict with a different-day booking due to date slicing. If allocation is not institutionally enforceable, use `STUDENT_COORDINATION_REQUEST` or `DEMO_RESERVED`, not a real guaranteed exclusive booking. Optional fairness rule for busy periods (limits, waitlist/first come) requires explicit stated policy; avoid gamifying access or creating unsafe nighttime guidance.

### V2 signature
**Midnight Availability Ribbon** across all three spots with obvious date rollover and visual alternatives. Notify attendees of changes; list nearby alternate slots/locations only if real spots are recorded. Handle bad weather, restrictions, spot closure, conflicting event, large group, student changing midnight date, last-minute no-show. Time Tax here is coordination/friction, not a fabricated queue duration.

## F23 — BMS OFFICE APPOINTMENTS

### Practical goal
Students currently risk arriving during restricted office hours, waiting without knowing availability, or needing repeated visits. A separate **BMS Office** entry under Administration reuses faculty appointment primitives but has service-specific request categories, office opening hours if verified, documents-to-bring checklists and office queue information only with real observations.

### Workflow
Purpose (certificate, office inquiry, leave follow-up, administrative support, other) → pick a sourced open slot or propose times → attach brief note (limit private details) → `REQUESTED / ACCEPTED / PROPOSED_NEW_TIME / DECLINED / COMPLETED / CANCELLED`; after approval show visit ticket with date/time, desk and documents only if office supplied that information. Walk-in vs appointment policies must be labelled.

### Richer interactions
**Is a visit necessary?** suggests available official information/form link before reserving, without blocking student access; **Before You Go** checklist; appointment/queue status with timestamp; escalation to request follow-up if unresolved. Respect closure, lunch breaks, emergency meeting, duplicate requests, no-show, conflicting faculty meeting, missing official schedule. Home/Calendar/Notifications share appointment identity and updates; Time Tax tracks actual office wait and visit count if fieldwork recorded.

## F24 — INTRA-COLLEGE SPORTS FIXTURES, TEAMS AND SIGN-UPS

### A community sports system, not facility booking duplicated
Tabs **Fixtures / Find Team / Create Team / My Teams / Results**. Fixtures are competitions and participation workflows; courts/grounds as physical resources link to F06/F07 bookings rather than creating a second court reservation source.

### Join a Team
Browse open rosters, sport, match, experience requirement only if team chooses, positions needed, date and location; send a join request; captain approves/declines, and applicant sees why/when. `REQUESTED → APPROVED/DECLINED/WITHDRAWN`; accepted student counts against vacancy, with explicit max roster size. Allow juniors/seniors on mixed teams unless actual eligibility rules say otherwise.

### Create a Team
Name, sport, optional team logo, captain, capacity, open slots, practice time, optional roster approvals. Members can leave; captain handover must be explicit, not leave an orphaned team. **Looking for Players** urgent cards can call for last-minute substitute with expiry and venue/time; avoid revealing private phone numbers, and don't auto-approve the first random applicant without team settings.

### Fixture publisher
A simulated sports committee dashboard creates tournament/event, division, venue, start/end, eligible teams, published fixtures, result entry and postponements. Student-facing **Match Day** card shows opponent, venue, reporting time (if supplied), roster and emergency updates. Calendar entries originate from one fixture record; changing time/venue creates a history event and targeted notifications, not duplicate matches. Results are published only by authorized/demo roles; handle draw, cancellation, forfeit and disqualification as supported statuses, not guesses.

### Enrichment
**Team Finder** interest filter, **Game Day Pulse** event countdown, urgent player recruitment, brackets when actual tournament format provided, sportsmanship-first copy. Distinguish booking access, player invitation, official fixture approval and match results. Edge: player on two teams, canceled match after practice bookings, captain leaves, team oversubscribed, venue changed, duplicate application, audience mismatch.

## F25 — NOTIFICATION CENTER: PERSONALIZED CAMPUS INBOX + EMAIL LIVE FEED

### Student experience
This is the **nervous system** of CampusOS, not a generic bell icon. Provide four tightly integrated views:

1. **For You:** high-priority actionable notifications from all modules; newest first within priority sections; each links to its source record.
2. **Campus Mail:** authorized read-only view of the student's connected BMS-related email feed (inbox/college label), with original subject, sender, received date, snippet, view-original action if available, and clear connection status.
3. **Announcements:** source-labelled faculty/CR/SR/office club and campus posts targeted to student batch/section/subscriptions.
4. **Preferences & History:** category toggles, in-app vs browser/system push (when supported), quiet hours, importance and read/snooze/archive options. Critical categories (exam changes, cancellations, approved leave state) default on; avoid claiming they are legally mandatory or impossible to disable without approved campus policy.

### Notification cards
Visual priority (`URGENT / IMPORTANT / FYI`), topic, student-targeted message, source name, effective time, received time, event time, freshness, direct action (e.g., **View My Seat**, **See Updated Class**, **Collect Parcel**, **Track Laundry**), read state, duplicate collapse and error state. **A notification must never be the only place where the underlying fact lives.** Its linked primary record should persist.

### Live email integration requirement
**Requested new flagship feature:** emails relevant to BMS students should appear as live/near-live notifications; a last-minute exam/quiz seating email should populate a **personalized** alert showing room, row, column and when relevant seat/section. The full design, source controls, parsing, privacy, mocked demo and actual Gmail backend boundary are specified **in §D**; implement the demo flow as a functional part of the prototype **now**, and enable truly live delivery only after a permitted mailbox and backend credentials exist.

### Delivery rules
- Separate `message created`, `in-app visible`, `browser push permission granted`, `push attempted`, `push delivered` and `user read` facts. Use server/browser APIs only after consent; local in-app notifications should work while app is open even without browser push.
- Deduplicate repeated email thread edits and repeated service status events; revisions may produce a **meaningful change** alert when material fields change.
- Digest low-priority changes, do not silence truly urgent student-relevant alerts by routine category preference if an explicit campus-policy rule was configured; still provide user controls and channel transparency.
- Respect privacy, authorized audiences and segmentation. **Never broadcast the contents of one person's inbox to all campus users.**
- If connection is disconnected, show `Last synced ...` plus reconnect action, not false live status.

### Richer V2 experience
**Campus Signal:** concise “3 things changed since you last checked” stack; **Urgent Banner** for real verified exam/time/location changes; user-scoped notification intelligence with deterministic rule explanations; source drawer (“Why am I seeing this?”) and alert timeline. Handle spam, forwarded hoaxes, malicious email links, duplicated notifications, alert overload, offline browser and repeated edits. See §D for the complete contract.

## F26 — PERSONALIZED EXAM/QUIZ SEATING: LAST-MINUTE CHANGES

### Student promise
A student should not open several emails and search a PDF one hour before a quiz. Once an authorized exam notice and **unambiguous student ID mapping** are available, CampusOS should show a concise, private, prominent **Your Exam Seat** card with exam/quiz, date/time, venue, building/room code, column, row and any actual seat number.

### What appears
An urgent banner and Notification Center card example (**illustrative demo only**):

> **Quiz seating updated — 1 hour before start (DEMO)**  
> **BMS Quiz** · **CR5** · **Column 2** · **Row 3**  
> Effective for **your connected student profile only**. **View original notice** | **Open exam details**.

Do not incorrectly treat `CR5` as a student's *course section* if it is a *room code*; the demo metadata must define its meaning. If the seat is “Conference Hall / Column 5 / Row 3”, preserve that source interpretation. Extract from actual text/structured attachment, never guess absent values. If a source gives only a room, display just the room; if it gives seating as a linked PDF but parser cannot read, show **“Seating notice received—open attachment to check your seat”**, not a made-up assignment.

### Workflow and verified states
- Course/exam source → exam event with `examId`, course, start time, venue if given, audience.
- Mail ingest or simulated publisher creates an immutable `SourceNotice` and parse attempt → `CANDIDATE_SEAT_RECORD`, `NEEDS_REVIEW`, `CONFIRMED_MATCH` (only with exact ID and trustworthy source/mapping), `SUPERSEDED` on newer source correction.
- Match by **verified student ID + exam/course + applicable section/batch**, never name-only. Display only the current most authoritative unambiguous valid record, with `issuedAt`, `receivedAt`, `effectiveAt`, `parsedAt`, source link and revision number.
- A corrected seating email updates the canonical assignment, preserves former values in history and notifies only affected profiles; a re-forward without new revision does not create fresh panic.

### UX and safeguards
- **Exam Boarding Pass:** room and seat displayed big enough to read instantly, subject/time, note on source, route/venue details only when verified, “Updated X minutes ago”, “View original email/PDF”. Distinct from proof of eligibility or actual admit card.
- **One-hour scenario:** show an immediate actionable in-app event and an opt-in browser push when available. A browser push while page is closed requires real server/push configuration and consent, not just a static web app.
- No public exam seating directory; never expose other students' IDs or assignments, even when original mail includes a large seating list. Do not publish a raw seating-list PDF to unauthorized users.
- If parsing uncertain/invalid, notify that **new seating information arrived** and direct to original; demand review or manual confirmation before “Your seat is...” assertion.
- Edge cases: multiple quizzes same day, repeated same-named students, no seat listed, revised column only, one message with several sections, image-only attachment, password-protected PDF, conflicting email and timetable, notice received after exam start, disconnected mail, bounced push, malicious forwarded notice.

---

# C. CROSS-CUTTING EXPERIENCES, ORIGINAL EXTRAS AND DESIGN DEPTH

## C1. HOME DASHBOARD — THE DAILY CAMPUS COMMAND CENTER

**Home is the differentiator**, not a grid of all 26 icons. It blends productivity with campus personality using priority-ranked, customizable widgets and a deterministic daily summary.

### Default visual layout
- **Hero:** time-aware greeting, campus-day label, date, short actionable briefing built only from current verified/personal/demo records. No invented motivational status or promises.
- **Primary left column:** switchable **Agenda / Compact Week** (prominent, NOT a small decorative widget); **Up Next** (next timed class/appointment/booking), **Deadline Focus**, **My Tasks** and **Free Pockets**.
- **Primary right column:** four customizable **Quick Actions**, **My Activity** across all service modules, **Mess Preview**, **Campus Pulse** for events/birthdays/clubs/sports, **Time Tax Snapshot**. When a live urgent exam seating change exists, it supersedes low-priority Campus Pulse but does not destroy normal layout.
- **Three visual zones:** (1) immediate priorities, (2) actionable tasks/operations, (3) discovery/campus life. Avoid 26 equal-weight cards.

### Deep personalization
- Show/hide widgets; reorder with mouse and keyboard; choose compact/comfortable density; widget sizes when layout allows; save profiles/presets **Balanced Campus**, **Academic Focus**, **Campus Life**; restore defaults. Persist per demo profile, not universally.
- Customizable four Quick Actions choose from order food, reserve court, lodge complaint, check laundry, faculty meeting, course tasks, see exam seat, etc. Drag-and-drop plus accessible move buttons.
- Context-aware suggestions based on deterministic rules: a real dated exam → suggest review; a booked court → show check-in; a ready parcel → collection call-to-action; a new urgent mail-derived seating notice → exam seat; a time gap → study task. No fabricated intelligence.
- **Free Pockets** excludes all-day dates/menus and uses only known timed busy events. Filter out irrelevant semesters/courses/sections without hiding truly relevant administrative changes.
- Demo reset returns to stable seeded states; pending actions survive refresh unless reset. A widget with no data displays a helpful, non-shaming empty state.

### Original brainstorm extras
Unexpected meetings and CR/SR notices appear in a **“What changed?”** strip, not as silent calendar edits. “Leave/attendance counter” is a personal estimate only until official data exists. Birthdays are permissioned personal milestones, not public exposure of every student’s date.

## C2. MY ACTIVITY — CROSS-MODULE OPERATIONS LEDGER

A compact app-wide **My Activity** surface should aggregate open entities: café orders, laundry loads, parcels, facility reservations, leave requests, maintenance tickets, office appointments, team applications, assignments and exam updates. Cards display source-specific **next step**, one clear deep link, status freshness and time/date. Do not invent a new `activityStatus` independently; compute it from canonical source records. Sort urgency deterministically (e.g., exam starts soon; ready pickup; imminent booking; due assignment), allow category filters and dismiss only nonessential UI cards without deleting underlying records.

## C3. SEARCH, CHANGE HISTORY AND “WHAT CHANGED?”

Global command/search palette can search personal records across courses, services, appointments, notifications, tickets and resources with role restrictions. Search result shows type icon, title, relevant date and location, last update and where tapping opens. `What changed since last visit?` compares known revision IDs, not guesses. For a class venue change, show previous/new venue and “updated by source X”; for a café order, show status progression. Avoid exposing personal emails or exam seats in another profile’s search.

## C4. ADMIN/CR/SR ANNOUNCEMENTS, CLASSROOM REQUESTS, ATTENDANCE

These were part of the original brainstorm but not standalone numbered features; they **must not disappear**.

- **CR/SR Weekly Bulletin:** course/section-scoped “Week Ahead” feed: class updates, readings, deadlines, meeting reminders and events, with author, source type and publication time. Faculty/academic office notices rank above personal CR speculation when sources conflict. Students can subscribe; revisions preserve history and notify only materially affected users.
- **Campus announcements:** clubs, student organizations and admins can publish via demo role with audience targeting, scheduled visible period, links and correction notices; no real institutional authority implied.
- **Unexpected meetings:** urgent targeted announcement type creates a calendar candidate/confirmed event only when required time, date and audience are explicit; otherwise an announcement notification linking to source. Source confirmation and change history matters more than bright color.
- **Classroom bookings (now a full Bookings feature):** the first-class **Bookings → Classrooms** experience, named-room catalogue, current/selected-time availability, direct eligible-slot booking, approval-required requests, and Room Radar are defined in **§B-Classrooms**. CR/SR requests use **the same interface and resource records**, with role-specific approval rules; they must not be implemented as a second admin-only classroom booking form. A request is not a confirmed reservation, imported class blocks apply only to their mapped room, and actual room allocation or post-8 pm rules must not be invented.
- **Leave/attendance counter:** a personal, transparent calculator showing known classes, student self-reported absences and estimated attendance scenario. Never display an “official percentage” without verified attendance import. No hidden mark/grade data.
- **Printing/shuttle/Wi-Fi queues:** these were in the initial Time Tax investigation. Preserve as **measurement service categories** in the Time Tax dashboard and field observation schema even when no standalone app module is built. Later create an optional information-only service card if real usage data exists; do not invent printers/shuttle schedule/network-login intervention.

## C5. SHARED APPOINTMENT, BOOKING, REQUEST AND NOTIFICATION ENGINES

### Shared booking engine
`Resource → AvailabilityRule → TimeSlot → Reservation → Attendance/UseReport` with resource-specific modes `EXCLUSIVE`, `CAPACITY_BASED`, `REQUEST_APPROVAL`, `INFORMATION_ONLY`. **Classrooms use this same canonical engine**: CR Conference Hall, CR1, CR3 and G12 are named `CLASSROOM` resources. A free slot in a properly labelled demo-instant-booking mode can be confirmed directly in **Bookings → Classrooms**; a room requiring review produces `PENDING_APPROVAL` and not a reserved/guaranteed slot. Conflict checks operate on full half-open intervals `[start,end)`, in Asia/Kolkata display zone, including room-mapped academic classes and explicit blackout periods. A room with missing timetable coverage is `UNKNOWN / NOT SYNCED`, not simply Available. Maintenance and closures override new reservations; an existing affected reservation becomes `DISRUPTED` with notice, not silently deleted. Optional waitlist has explicit offer and expiry.

### Shared request engine
`Request → RoleScopedWorkflow → TransitionHistory → Decision/Resolution → Notification`. Leave requires authorized approval + distinct gate check; complaint needs assignment/repair/reopen; faculty appointment needs invite/accept/reschedule; mentorship needs invitation/accept. Reuse underlying primitives without forcing one universal status enum onto different meanings.

### Shared activity/notification events
An event is created when a **meaningful, persisted source fact changes**. Fan out to My Activity, Calendar (if temporally meaningful), Notifications, search and Time Tax by selectors. Deleting a UI projection must not delete source record. On hard refresh, all projections reconstruct deterministically from store.

## C6. VISUAL QUALITY BAR BY SURFACE

| Surface | Creative signature | Accessibility/usability bar |
|---|---|---|
| Home | Editorial daily briefing + reconfigurable widgets | Keyboard reorder, responsive layouts, no low-contrast tiny widgets |
| Calendar | Layered schedule with context rail, free pockets | Agenda alternative and accessible event detail |
| Chill Spot | Queue lanes + animated order timeline | No color-only status, no false countdown |
| Laundry | Distinct provider load vs washing-machine passports | Accurate unknown/partial delivery states |
| Mess | Meal timeline + reported congestion band | Dietary information only when verified |
| Sports | Court filmstrip + Quick Play Finder | Focusable slots, explicit start/end |
| Library | Quiet-study compass + book tracker | Source and checkout clarity |
| Administration | Where-is-my-request timeline | Privacy-aware uploads, clear reviewer/next step |
| Academics | Weekly course sprint + meeting preparation | Read-only source provenance, no fake submissions |
| Community | Photo-first Lost & Found + club storytelling | Private claims, contact opt-in |
| Inbox/Exam | Campus Signal + urgent personalized boarding pass | Large typography, corrected-source notices, push control |
| Time Tax | Operational heatmaps + method drawer | Legible assumptions, accessible data tables |

Each module needs designed **loading, empty, success, partial, stale, forbidden and error states** as appropriate. No blank screens or invisible async failures. Defer advanced illustration assets until layouts and interactions work; use permissively sourced images or shaped placeholders with explicit demo status, never copyrighted college photos without permission.

---

# D. NEW FLAGSHIP FEATURE: BMS MAIL → LIVE CAMPUS SIGNAL → PERSONALIZED EXAM SEATING

> **Direct user request:** connect CampusOS notifications with a BMS-associated email ID or authorized student mailbox; surface incoming mail inside the app and generate immediate, personalized alerts when quiz/exam schedules or seating information arrives, potentially as late as one hour before a quiz. The original F25/F26 ideas must work together, not merely appear as adjacent cards.

## D1. Scope: two viable account/permission modes — never confuse them

**Mode A: Each student connects their own college/BMS mailbox** (if the provider and college permit it). CampusOS can show that student's authorized messages under **Campus Mail**, and parse relevant notices **for that student only**. OAuth permissions must be approved by the actual mailbox owner; the UI clearly names which account is connected. This is the most accurate interpretation of “all emails pushed here” without invading someone else's inbox.

**Mode B: An institution-authorized BMS broadcast/announcement mailbox or feed** is connected by a permitted coordinator. Only **approved institutional announcement messages** are published to the campus announcement channel; other private mail, attachments and recipients remain protected. Students cannot connect to a communal inbox using shared passwords. Message publishing requires an explicit allowlisted label/feed plus an authorized publishing policy.

**Both modes may coexist** if formally permitted. The interface should never guess which mailbox is “the BMS email ID.” Actual account address and provider must come from the user/college, not invented example values. No OAuth credential should appear in demo screenshots, logs, frontend bundles, markdown or source-control commits.

## D2. Two distinct abilities: mailbox mirroring vs derived actionable alerts

| Capability | What it means | Required trust |
|---|---|---|
| **Campus Mail Inbox** | List/read authorized emails with subject, sender, received time, snippet and original message | Account consent / authorized broadcast feed |
| **Campus Signal Notifications** | Identify student-relevant changes from email and existing modules | Source classification + audience targeting |
| **Exam seating extraction** | Parse an actual student-to-room/row/column mapping | Exact unique student ID and compatible exam identity, validated fields |
| **Calendar sync from notices** | Create/update source-backed calendar events after date/time extraction | No ambiguous deadlines/venues; explicit confirmation if uncertain |
| **Browser push** | Deliver a notification to student's device/browser, possibly while app tab closed | User permission, service worker, server-delivery mechanism and valid subscription |

**Critical difference:** “mail received” is not equivalent to “reliable seating details extracted” or “mobile push delivered.” The app must make each stage observable.

## D3. Campus Mail UI and message detail

### Inbox layout
- Header **Campus Mail**, connected account alias, `Connected / Syncing / Needs Reconnect / Demo Only`, last successful sync and count of actionable *unread* items.
- Tabs `All Mail / Academic / Exams & Quizzes / Administration / Student Life / Other`; use categories based on **rules or explicit user labelling**, not unfounded NLP certainty.
- Mail cards show sender identity/address, timestamp, subject, two-line safe plain-text preview, attachments indicators, category, source badge, read/unread and an “Open original” link when provider allows.
- Full detail drawer preserves mail headers/source and plain text, accessible formatting, attachments as authorized downloadable/openable objects, and “This message may contain an update” suggestions with **Show extraction evidence** and **Open original**.
- For untrusted email HTML, sanitize aggressively; render plain text when possible, block external tracking images by default, never execute arbitrary HTML/script, and warn before external links.
- Search by subject, sender, date, labels and authorized terms. Locally indexed demo results are clearly mock; real mailbox search runs only within the student's authorized scope.
- Local cache is scoped per account/profile and minimized; disconnect removes tokens and provides a clearly described option to delete cached mail/derived artifacts, subject to legitimate app audit obligations.

### Inbox priority example (all fictitious)

| Received | Subject | Label | Derived action |
|---|---|---|---|
| 9:00 am | Quiz Seating — Revised (Demo) | Urgent / Exams | **View your seat** if exact ID match |
| 8:20 am | BMS Weekly Update (Demo) | Academic | View bulletin |
| Yesterday | Club Applications Open (Demo) | Campus Life | Open club |

Don't present these as actual received email or assert real times unless present in a seeded demo scenario. Campus Mail should support a **“All mail” read-only list**; Notification Center should show only relevant actionable events, not turn every spam/promotional email into an alert.

## D4. End-to-end exam alert: the demonstrated one-hour use case

**Preconditions (demo):** student profile has a **fictional** unique student key `DEMO-BMS-001`, enrolled course `DEMO-OPS101`, and a known quiz event starting at **15:00 IST** on a chosen demo date. No real student's identifiable registration number is required.

1. At 14:00 IST in the **Demo Mail Injection Lab**, facilitator presses **“Receive Revised Quiz Seating Email”** (or imports a synthetic `.eml` / JSON fixture). Original message: quiz name, date/time, student ID and `CR5, Column 2, Row 3` are explicitly present. The fixture carries `DEMO_SIMULATED` source and a stable fake message ID.
2. Email appears in **Campus Mail** with original subject/sender/timestamp and a prominent **Demo** badge. A source notice is saved, then classification/extraction runs.
3. Extractor identifies exam and candidate seat row. Student matching requires exact normalized `DEMO-BMS-001` and matching quiz identity; no infer-by-name. The derived candidate includes source field coordinates and parse confidence/review state.
4. If complete and unambiguous under configured **demo trust policy**, a canonical `ExamSeatAssignment` changes to `CONFIRMED_DEMO`. A real production record would need authorized source verification before it is treated as official.
5. Notification Center immediately displays **“Quiz seating updated — CR5, Column 2, Row 3”** for **this profile**, with `QUIZ STARTS IN 1 HOUR` computed from actual source time and current clock, `View My Seat`, `View Original Mail`.
6. Home **Urgent Campus Signal** displays the seat card above less urgent widgets. Calendar exam event contains a linked `Seat Available` detail; Academics → Exams opens the boarding-pass view.
7. Simulated browser-push preview can be clicked to illustrate what would appear **only if real browser push permission and delivery are unavailable**; it must not assert a system notification was sent. With actual consented push infrastructure, delivery outcome tracked independently.
8. Inject **Correction Email** with a higher source revision changing `Column 2 → Column 4`. It must update the existing assignment in place, preserve the original version/history, and create **one** targeted “Your column changed” alert. Injecting the exact same email again must yield **no duplicate alert**.
9. Switch to a second demo profile with a different student ID: no exposure of `DEMO-BMS-001`'s exam seat. For a missing ID row, show generic “Seating notice arrived; verify original notice” with no invented seat.

**Presentation visual:** left panel “New Mail Arrives,” center “Source → Extraction → Identity Match → Updated Exam Record,” right panel “Personal Push + Exam Boarding Pass”; this makes the connection between operational information flow and reduced last-minute search time tangible.

## D5. Data models and ownership

These are reference TypeScript-like contracts. Adapt field names to the existing code; **do not create parallel unsynchronized copies of the same logical record**.

```ts
type Provenance =
  | 'OFFICIAL_VERIFIED'
  | 'SOURCE_IMPORTED_UNVERIFIED'
  | 'FIELD_OBSERVED'
  | 'USER_REPORTED'
  | 'DEMO_SIMULATED'
  | 'UNKNOWN';

type MailConnection = {
  id: string;
  ownerProfileId: string | null;   // null only for an authorized institutional broadcast feed
  provider: 'gmail' | 'microsoft' | 'other-approved';
  accountAlias: string;           // never OAuth tokens in frontend/domain model
  mode: 'PERSONAL' | 'AUTHORIZED_BROADCAST';
  state: 'DEMO' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  lastSuccessfulSyncAt?: string;
  authorizedAudience?: string[];   // for explicitly published broadcast posts
};

type SourceEmail = {
  id: string;                     // stable provider message ID / demo fixture ID
  connectionId: string;
  threadId?: string;
  providerRevision?: string;
  from: string; toVisible?: string[];
  subject: string;
  receivedAt: string;
  plainTextBody?: string;         // minimize stored raw body outside authorized storage
  attachmentRefs: string[];
  category?: 'EXAM' | 'ACADEMIC' | 'ADMIN' | 'CLUB' | 'OTHER';
  provenance: Provenance;
  observedAt: string;
  syncState: 'IMPORTED' | 'UPDATED' | 'NEEDS_REVIEW' | 'QUARANTINED';
};

type ExtractedNotice = {
  id: string;
  sourceEmailId: string;
  kind: 'EXAM_SCHEDULE' | 'SEATING' | 'DEADLINE' | 'CLASS_CHANGE' | 'ANNOUNCEMENT';
  audience?: { batch?: string; section?: string; courseId?: string };
  extractedFields: Record<string, string | null>;
  extractionStatus: 'EXTRACTED_CANDIDATE' | 'NEEDS_REVIEW' | 'VALIDATED' | 'REJECTED';
  evidence: { field: string; sourceLocator: string; rawValue: string }[];
  extractedAt: string;
};

type ExamSeatAssignment = {
  id: string;
  studentProfileId: string;
  normalizedStudentId: string;
  examId: string;
  roomCode?: string; building?: string; roomName?: string;
  row?: string; column?: string; seatNumber?: string;
  sourceNoticeId: string;
  validation: 'CONFIRMED_DEMO' | 'VERIFIED_SOURCE' | 'UNCONFIRMED';
  effectiveAt?: string;
  issuedAt?: string;
  revision: number;
  supersedesAssignmentId?: string;
  updatedAt: string;
};

type CampusNotification = {
  id: string;
  recipientProfileId: string;
  kind: string;
  priority: 'URGENT' | 'IMPORTANT' | 'FYI';
  title: string; body: string;
  sourceEntityType: string; sourceEntityId: string;
  deepLink: string;
  dedupeKey: string;
  createdAt: string;
  provenance: Provenance;
  readAt?: string;
  delivery: {
    inApp: 'CREATED' | 'VISIBLE' | 'FAILED';
    browserPush: 'NOT_REQUESTED' | 'PERMISSION_DENIED' | 'QUEUED' | 'SENT' | 'FAILED';
  };
};
```

### Canonical ownership & storage rules
- `SourceEmail` belongs to a **MailConnection** and is private to its authorized owner unless explicitly approved for broadcast.
- `ExtractedNotice` is an auditable **candidate derivative** of a source email; it never overwrites the original.
- `ExamSeatAssignment` is the only owner of a student's seat details; Home/Calendar/Notifications project from it.
- Source and revision must be preserved so “what changed?” can show why Column 2 became Column 4.
- Dedupe keys: `connectionId + providerMessageId + meaningfulRevision + derivedEntityKey`; transient UI mounting never generates new alert identifiers.
- Display raw school/student IDs only in private views when necessary; logs and fixture files use synthetic IDs.

## D6. Email ingestion and parsing pipeline — architecturally specific

```
Authorized OAuth / approved broadcast feed
        |
        v
Mail Provider Adapter (Gmail / approved Microsoft 365 provider / demo fixture)
        |
        v
Sync Cursor + Message Deduper + Consent/Audience Gate
        |
        v
Safe MIME Parser --> attachment references / plain-text extraction
        |
        v
Category Classifier (transparent rules; unclassified allowed)
        |
        v
Typed Extractor (exam dates, venue, student-ID rows, changes)
        |
        v
Schema + Source + Identity Validation --> NEEDS_REVIEW if ambiguous
        |
        v
Canonical Exam/Calendar/Announcement Update (versioned)
        |
        v
Targeting Policy --> CampusNotification --> Inbox + Home + optional browser push
```

### Mail ingestion specifics
1. **Do not scrape a Gmail/Outlook webpage** or ask for mailbox passwords. Use official authorized account APIs and delegated access; no email credentials in React/Vite or localStorage. A static client cannot hold a secure system-wide Gmail watcher.
2. Gmail/Workspace implementation (only if permitted and configured): OAuth 2.0 read-only access with **minimum necessary scope**, then an authorized server-side Gmail `users.watch` → Cloud Pub/Sub notification → `users.history.list` incremental fetch → `messages.get` content as needed. Watches require periodic renewal; account sync must persist last `historyId`, detect gaps/expired history and perform bounded resync. Gmail server push may be delayed/dropped; fallback sync is necessary. **`gmail.readonly` is a restricted OAuth scope**, potentially involving verification/security requirements; don't turn it on casually for campus-wide deployment. Source: Google Gmail API official docs linked below.
3. If school uses **Microsoft 365/Outlook**, implement an approved provider adapter based on Microsoft Graph and permitted subscriptions/delta sync under the school's tenant policies; **do not assume the college uses Gmail** from the user saying “BMS email”.
4. Send actual browser push only with explicit user permission and a working service worker/push endpoint and subscriptions; allow no-push users to see in-app updates when connected. Cross-device instant delivery requires the deferred shared backend; do not label local simulations live.
5. Manage rate limiting, retries with exponential backoff, dead-letter handling, duplicate event deliveries, delayed/out-of-order mail, attachment limits and reconnection. A skipped event should not permanently lose a critical source notice.
6. Data retention: short-lived encrypted restricted mail cache where needed, appropriate access checks and logout revocation; avoid mass storing private email bodies to generate student announcements. If institution publishes an announcement, store the announcement/public-safe extraction rather than silently exposing the mailbox.
7. **Source trust:** allowlist sender addresses/domains and approved labels **plus** source verification/authorized review as appropriate; sender display name or From header alone does not authenticate an institutional notice. Forwarded messages get lower confidence. Never execute instructions embedded in email content; email is data, not a command source for the app.

### Structured extraction rules
- Prefer **machine-readable source table** with student ID, exam ID, room, row, column, version. If PDF/CSV attachment is available, parse it with an appropriate safe, authorized server-side handler and cite locator (page/row/column). The original source file may contain many student IDs, so do not expose it publicly.
- Normalize student-ID whitespace and case according to a documented campus schema; **do not edit digits** or fuzzy-match numeric IDs. Check exactly one matching student record, one compatible exam/section/date and one current revision.
- Parse time/date explicitly with locale/timezone and reject impossible/missing values. Preserve room identifiers verbatim, including `CR5`; don't reinterpret `Column 2` as `Seat 2` or reverse row/column.
- Parsed free text like “Everyone in BMS Section B goes to CR5” gives a **room-scoped notice**, not an individual row/column. A line “BMS25113 CR5 Col 2 Row 3” only becomes personalized if profile's verified student ID matches **and** the exam identity is established; otherwise `NEEDS_REVIEW`.
- For attachments that cannot be parsed (image, scanned PDF without supported text layer, access-denied file), show **new notice received; inspect source**. OCR, if implemented later, produces candidate fields requiring review; it is not proof.
- Conflicts: prefer verified later **superseding** official notice only when its exam/student scope is clear; preserve both versions. If two authoritative sources conflict with no explicit supersession, show `CONFLICT — VERIFY WITH OFFICE`, not arbitrary “latest wins”.
- Extractions with missing room/row/column should never invent values; allow optional fields and label partial result. No LLM-only hallucinated seat inference.

## D7. Email-derived urgency, notification targeting and anti-spam

**Illustrative priority rules (configurable):**

- `URGENT`: verified/corroborated exam seating change inside 24h, exam time/location changes shortly before start, class cancellation with near-term impact, time-critical authorized administrative action. Never mark urgent purely because email subject includes “URGENT!!!”.
- `IMPORTANT`: assignments, official academic dates, leave request decisions, ready-for-collection status, meeting reschedules.
- `FYI`: club recruitment, newsletters, routine weekly bulletin, general promotional campus activities.

**Routing:** `audience = exact profile` for seat and private mail; `batch/section/course` for validated group announcements; `subscribers` for club information; `all students` only for approved genuine campus-wide notices. Hide PII from lock-screen push: default system push says **“Quiz seating has been updated — open CampusOS”**; full room/row/column appears only inside unlocked app, unless user explicitly opts into detailed lock-screen previews.

**Snoozing:** allow routine reminders to be snoozed; show priority basis and transparent controls for urgent category. Deduplication should collapse repeated mail body and retries but **not** suppress a real source correction. Respect quiet hours except a user-approved urgent policy. Use `receivedAt`, `processedAt`, `eventStartAt` and `deliveryAt` accurately; avoid deriving relative time from an out-of-date demo clock.

## D8. Demo configuration vs production activation

| Ability | Local prototype immediately | Final authorized connected phase |
|---|---|---|
| View Inbox | Fully interactive fictional mail messages with DEMO badge | Actual per-account/provider OAuth-authorized messages |
| Receive new email | Button/timeline injects synthetic incoming message | Provider sync/watch receives authorized mailbox change |
| Parse exam row | Deterministic known fixtures + failure fixture | Validated structured/PDF parsing with provenance |
| Show personalized seating | Yes, correct demo profile, with `CONFIRMED_DEMO` | Only verified/unambiguous real student mapping |
| Update Home/Calendar/Notification | Instant within same local app/profile | Cross-device via shared backend and subscriptions |
| Browser notification | Use genuine browser permission when supported for demo while page context allows; otherwise clearly marked visual preview | Secure server-initiated browser push if deployed/consented |
| “All emails” | Seeded sample mail belonging to demo persona | Only mail that user/provider authorized; never all students' private mail |
| Broadcast email to campus notices | Simulated approved-scope feed | Authorized campus publisher/audience and explicit release policy |

**Do not let an inability to connect real mailbox credentials block completion of the rest of CampusOS.** The local demo of this workflow is a high-priority, meaningful end-to-end experience. Real external sync is a separately secured integration, not an invisible prerequisite.

## D9. Official implementation references (for coding agent to check when connecting)

- Gmail push configuration, watch renewal and limitations: <https://developers.google.com/workspace/gmail/api/guides/push>
- Gmail initial and incremental sync/history handling: <https://developers.google.com/workspace/gmail/api/guides/sync>
- Gmail OAuth scopes and restricted data considerations: <https://developers.google.com/workspace/gmail/api/auth/scopes>

Do not depend on a particular SDK's current method signatures without checking the installed version and official documentation during the *connected integration* phase.

---

# E. ENGINEERING, OPERATIONS RESEARCH, AND SHORT VERIFICATION PLAN

## E1. Implementation posture — no more round-by-round paperwork

**The task now is building, not accumulating documents.** The coding agent should read this master file once and execute **bounded feature workstreams**, preserving current app stability. **Do not start another architecture audit, ask for seven decisions to approve one by one, or regenerate a new acceptance matrix of 300 tests.** Where source data or credentials are missing, implement an explicit demo fixture and honest import/connection affordance; log the dependency briefly and continue.

Suggested stack unless existing repository differs: React + TypeScript + Vite, Tailwind + shadcn/ui, FullCalendar, Recharts, Lucide, Motion, Zod, lightweight store with local persistence, Vitest and Playwright. Keep established actual stack; do **not** migrate libraries for cosmetic reasons. Feature adapters and selectors expose stable typed contracts; avoid passing loosely shaped mutable objects across module boundaries.

### Minimal canonical domain entities

```ts
type DataEnvelope<T> = {
  id: string;
  kind: string;
  ownerProfileId?: string;
  audience?: { batch?: string; section?: string; courseId?: string; roles?: string[] };
  payload: T;
  provenance: Provenance;
  sourceId?: string;
  observedAt?: string;
  effectiveAt?: string;
  updatedAt: string;
  revision: number;
};

// Core owners, not independently mutable projections:
// Profile, Course, ScheduleEvent, PersonalTask, Assignment,
// Resource, Reservation, UseReport, CafeOrder, QueueSnapshot,
// LaundryLoad, ProviderVisit, MachineState, MealMenu, MealCheckIn,
// FeeNotice, ServiceTicket, LeaveRequest, AppointmentRequest,
// Parcel, LostFoundReport, ClaimRequest, Club, Team, Fixture,
// MailConnection, SourceEmail, ExtractedNotice, ExamSeatAssignment,
// CampusNotification, TimeTaxObservation, SimulationScenario.
```

**Event conventions:** `eventId`, `entityType`, `entityId`, `revision`, `occurredAt`, `actorRole`, `provenance`, `audience`, `payloadVersion` and `dedupeKey`; store transition history for operational entities. Source owns write access, projections subscribe through selectors. When demo operator changes an order, all connected widgets reflect the same canonical mutation; do not manually increment three counters.

## E2. Local-first and final shared backend boundary

**Until final phase:** profile-scoped local fixture store and simulator, ideally a service adapter pattern that could be swapped for real transport. Local changes persist through browser refresh; isolated test/demo users are separate. Local-only changes are **not cross-device live**, and there is no real data intake unless explicitly connected. A read-only original-source import can be supported now if safe and source-labelled.

**Final phase:** introduce a small authenticated backend (specific provider chosen based on real deployment), shared authoritative records, role-scoped operator views, subscription updates for orders/bookings/tickets/parcel/mail-derived events, and safe email provider adapter. Database constraints enforce overlapping resource slots; server reconciles conflict if two devices race. Keep local demo ability available offline without claiming it is the real campus system. Implement consent, audit, secret management and provider access before inviting real student mail.

**Notification distinction:** in-app events are immediate in local simulator; real cross-device sync needs shared backend; actual browser push needs permission plus suitable delivery infrastructure. These are three separate milestones.

## E3. Real data that must remain clearly unspecified until provided

| Source | Needed input | Safe fallback |
|---|---|---|
| College calendar | Semester dates, batch/section, class timetable, exam schedule | Fictional timetable labelled Demo |
| Café | Menu items, current prices, preparations/queue recordings, operator policies | Fictional menu and queue fixtures |
| Laundry | SS visits, load pickup/drop-off evidence, machine inventory/durations | User-reported loads + simulated provider updates |
| Mess | Hours, menus, known allergens, fee instructions/form URL | Demo menu, unknown crowd / example fee reminders |
| Sports and spaces | Actual facilities/capacity, permitted times, booking authority | Named Demo resources with configurable slot rules |
| **Classrooms (CR Conference Hall, CR1, CR3, G12)** | Official room-by-time timetable, authorized reservations/blackouts, eligibility, capacity, booking/approval rules, source freshness | **All four exact room names** with source-labelled demo booked/free/unknown intervals and fully working demo direct reservations; never call them actually free without authoritative sync |
| Faculty/BMS office | Office hours, approval chain and staff availability | Request-only simulated appointments |
| Course Hub | Faculty-provided course resources and assignment deadlines | Demo subject pages and personal tasks |
| Notifications/email | Actual approved BMS mailbox, provider, OAuth consent, student-ID mapping, authorized broadcast audience | Seeded fictional mail + deterministic seat parser |
| Exam seating | Source schedule/list with IDs, room/row/column and revisions | Personalized fictional `DEMO-BMS-001` fixture |
| Time Tax | Observed wait durations, throughput/capacity, trip frequencies | Clearly named scenario model, **not measured result** |

No email address, price, closing time, capacity, student seat or approval policy is to be created in code as if official. **Actual approved data wins**, with source revision and migration/rollback handling.

## E4. Time Tax: academically defensible business-operations deliverable

### Research questions
1. How many **student-hours per week** are lost to physical waiting in key campus services?
2. Which time slots and services produce the heaviest delay, and is the bottleneck arrival bunching, processing capacity or information scarcity?
3. How much waiting or avoidable travel **could** selected interventions reduce under clearly declared assumptions?
4. What share of the time burden is actually **coordination overhead** (uncertain arrival, repeated visits, chasing status) rather than unavoidable service processing?

### Primary observation record

```ts
type TimeTaxObservation = {
  id: string;
  service: 'CAFE' | 'MESS' | 'LAUNDRY_SS' | 'LAUNDRY_MACHINE'
    | 'ADMIN' | 'LIBRARY' | 'GYM' | 'PRINTING' | 'SHUTTLE' | 'WIFI'
    | 'OTHER';
  observationDate: string;
  startAt: string; endAt: string;
  arrivalAt?: string;
  queueJoinAt?: string; serviceStartAt?: string; serviceEndAt?: string;
  collectionAt?: string;
  queueLengthObserved?: number;
  customersServed?: number;
  resourcesAvailable?: number;
  observerMethod: 'DIRECT_TIMING' | 'COUNT_INTERVAL' | 'STUDENT_SURVEY' | 'SERVICE_LOG';
  provenance: 'FIELD_OBSERVED' | 'USER_REPORTED';
  sampleTag?: string; notes?: string;
};
```

**Recommended feasible collection:** 2–3 days on campus, observing mess, Chill Spot and one or two additional high-friction services at peak, shoulder and quieter windows. Use a consistent 10–15 minute interval logging sheet and time a set of queue journeys from queue join until service begins, and separately from ordering to receipt for the café. Record visit failures (e.g., laundry not arrived) with cause. Avoid photographing personally identifiable students without permission. Surveys can complement but never substitute for direct timing without labelling.

### Mathematically sound dashboard metrics

- **Individual physical queue wait:** `serviceStartAt − queueJoinAt`; do **not** add waiting both before and after preparation without separating phases.
- **Total turnaround:** `serviceEndAt − arrivalAt`, or `collectionAt − orderPlacedAt` for café when all timestamps exist. Different metric; label clearly.
- **Weekly waiting student-hours (sample/extrapolation):** `Σ(service-specific average wait minutes × observed/estimated weekly visits) ÷ 60`; this extrapolation is a **model** unless campus-wide visit counts are measured. Avoid double-counting a student's overlapping waits.
- **Per-student semester estimate:** `(estimated weekly waiting minutes/student × academic weeks)/60`, with attendance/service-use assumptions and uncertainty range shown. Do not hardcode semester weeks without a sourced calendar.
- **Service throughput:** `completed customers / observation hour`; **arrival rate** λ = arrivals per hour; **service rate per server** μ = average completions per hour when a server is busy, measured separately. Demand `λ` greater than service capacity during peaks suggests backlog growth.
- **Little's Law** as a consistency/reasoning lens `L = λW` for an appropriately defined stable system and matching queue boundaries; do not assume steady state for a short campus rush.
- **Queueing model:** M/M/1 or M/M/c may be used **only as explicit sensitivity models**, not a claim that arrivals/service times are exponentially distributed. If empirical distributions exist, prefer observed quantiles and a discrete-event what-if scenario.
- **Intervention scenarios:** pre-ordering may reduce time spent waiting **on site** but not cooking time; mess time-shifting may redistribute arrivals; reservations may reduce failed trips but can introduce no-shows; status notifications may reduce repeat enquiries. Model each counterfactual independently and expose assumptions.
- **Uncertainty:** at least sample count, min/median/mean and observed peak/off-peak windows; for extrapolations include low/base/high scenarios and sensitivity to adoption and service-rate assumptions.

### Dashboard pages
1. **Headline:** measured/estimated hours with massive, honest source-state label; campus-wide result only when genuinely defensible.
2. **Where time disappears:** stacked service bars physical waiting vs coordination overhead; never mix minutes and student-hours without unit labels.
3. **When it happens:** demand heatmap by weekday × time bin; sample count overlays.
4. **Bottleneck Explorer:** arrival rate, completions, resources, queue length, cause of delays and a selected service timeline.
5. **Intervention Lab:** controls for adoption rate, demand shifts, processing time, counter/staff count, booking no-show rate; assumptions visible; results labelled **Modeled**.
6. **Evidence Drawer:** observation method, sample dates, sample size, data coverage, bias, privacy notes, calculations and export CSV/chart for presentation.

### High-impact presentation demo
Start with **Observed Campus Friction** (real stopwatch dataset if available), show **Chill Spot** physical walk-in backlog and how digital order changes time-on-site without changing kitchen prep, then **Laundry** delay notification avoiding failed collection, **Mess** quieter interval, and finally a **CampusOS Time Tax** what-if graph. Explicitly contrast **observed** and **simulated potential**. A strong presentation argues why operations change, not just that students liked a shiny dashboard.

## E5. Implementation workstreams — proceed without separate approval gates

**The coding agent may implement the complete design in a practical order without new feature-by-feature prompting.** Workstreams are guidance, not a reason to stop and demand repeated user confirmation.

| Sequence | Build workstream | Concrete deliverable |
|---|---|---|
| **0** | Preserve and extend existing application | Existing Home/Calendar/Chill Spot intact; updated routes and shared UI/state contracts |
| **1** | Global intelligence shell | Home deep personalization, Calendar/Task quality, My Activity, notification store, source/freshness chips, responsive nav |
| **2** | Flagship operations | Chill Spot V2 completion, SS + self-service Laundry, Mess, Parcels, shared queue/booking/ticket behaviors |
| **3** | Campus resources | Gym, badminton, TT/pool/basketball, Library, Music Room, Chill Zone, **Classroom Finder/Room Radar for CR Conference Hall, CR1, CR3 and G12 with availability and direct eligible booking**, shared conflicts and check-in rules |
| **4** | Administration + academics | Leave/out-time, complaints, teaching aids, Course Hub, faculty, mentorship, BMS appointments, CR/SR notices |
| **5** | Community | Lost & Found, clubs/committees, teams/fixtures, birthday spot coordination |
| **6** | Email/Seating demo flagship | Functional Campus Mail simulated inbox, deterministic extraction, profile-safe seat cards, change alerts and Home/Calendar projection |
| **7** | Time Tax + aesthetic integration | Evidence lab, service dashboards, demo story, accessibility and cohesive responsive visual polish |
| **8 — FINAL CONNECTED PHASE** | Real backend + authorized email/provider connector | Cross-device events, secure operator actions, role access, live mailbox sync, browser push when consent/config permits |

**Avoid rewriting shared engines to add one feature.** When a new feature depends on a common primitive, extend the primitive with a feature-specific adapter. Maintain the existing working app throughout, and surface blockers only when real credentials, specific college policy or irreconcilable code constraints genuinely prevent further implementation.

## E6. Lean testing: enough safety, not redundant test theater

The previous documentation proposed dozens of acceptance cases per module. **Do not duplicate all those into hundreds of redundant automation tests now.** Focus on **one compact smoke pack plus a small handful of invariant regression tests**. Tests prevent visible project-breaking failures; they should not dominate implementation time.

### Required automated invariant checks (target ~10–15 high-value tests total, not 300)

1. **Source truth:** demo event/record never displays as verified; unknown actual occupancy/ETA/price not fabricated.
2. **Booking overlap and classroom truth:** exclusive resource (including a classroom blocked by a mapped class or a confirmed booking) rejects overlapping confirmed slots, including midnight rollover; a free demo classroom slot can be directly booked once, and unknown timetable/physical use cannot be represented as guaranteed vacancy. No-show does not automatically assert physical vacancy.
3. **Order lifecycle:** digital request begins pending, walk-ins can precede it, legal states only; paid vs collected distinct.
4. **Request lifecycle:** leave approval and gate exit distinct; complaint can reopen; ordinary student cannot fake operator transitions.
5. **Canonical projection:** mutating one booking/order/request updates Home + Calendar (where relevant) + Notifications without duplicated source copies.
6. **Persona isolation:** Student A cannot view Student B's parcels, personal emails, leave or exam seat.
7. **Email parsing:** exact ID/student+exam match yields `CR5 / Column 2 / Row 3` in the demo fixture, duplicate message doesn't double-notify, correction updates revision.
8. **Ambiguous email:** missing/contradictory row/column or mismatched student ID never invents a seat.
9. **Persistence:** realistic student and operator demo mutations survive reload within the same demo profile; reset only clears intended demo state.
10. **Calendar integrity:** date-only deadline isn't turned into a fake midnight busy event; recurring class exception works.
11. **Time Tax provenance:** measured vs self-reported vs modeled figures cannot be interchanged in headline outputs.
12. **Notification deep link/priority:** one meaningful event creates one targeted notification and opens correct source record.

### Small manual end-to-end pass, once after integration

| Demo path | What to click and observe |
|---|---|
| Student day | Open Home, switch Calendar Week, create personal task, observe same task in widget |
| Café | Place demo order, accept via simulator after walk-ins, prepare, ready, collect; verify no online payment claim |
| Laundry | Create student-reported load, change specific delivery status, observe notification; reserve machine and handle breakdown |
| Booking | Reserve badminton or music room, attempt overlapping slot, cancel and verify Calendar/My Activity; **also open Bookings → Classrooms, compare all four named rooms, directly book a demo-available CR1/CR3/G12/CR Conference Hall slot, see Booked immediately, try conflict, and cancel** |
| Administration | Submit leave, simulate review and approval, verify gate step separate; file/resolve/reopen ticket |
| Academics | Open course deadline, request faculty/BMS meeting, review task and Calendar link |
| Community | Claim demo lost item or join team; move status by appropriate role |
| **Mail → exam** | Inject source mail, exact student match, display seat, correct column, reject other profile/ambiguous fixture |
| Time Tax | Enter/import sample observation, switch measured/modelled view and inspect assumptions |
| Quality | Desktop ~1440 px and mobile ~390 px, keyboard controls, obvious empty/error states, no console-crashing navigation |

**Do not run every possible permutation after every button change.** Run quick targeted checks for the changed module, and the compact smoke pack after a milestone. Never claim tests passed if they were not actually executed. If a critical invariant fails, fix it before expanding; cosmetic micro-adjustments do not warrant an audit cycle. Report failures in 1–2 sentences with remediation, not a 30-page log.

## E7. Operational acceptance standard — completion of the original brainstorm

To say the *original CampusOS scope is implemented as a prototype*, all of the following should be true:

1. **26/26 feature routes** exist and display meaningful, accessible, source-labelled UI.
2. Each supports at least **one complete representative user journey** to a real stored demo outcome, not a dead-click success toast.
3. Home/Calendar/My Activity/Notifications reflect relevant source changes correctly.
4. The café, laundry, **Classroom Room Radar with direct booking**, other booking, approvals, mail-derived seating and Time Tax stories are visually polished and reproducible.
5. Student identity/privacy boundaries and sender/source/authority distinctions are respected.
6. At least the compact smoke pack passes, with critical regressions fixed.
7. Missing campus information is visible as Demo/Unknown rather than guessed. Real Gmail/browser push is labelled disconnected until legitimately configured.
8. The project can be launched locally in Claude Desktop or Chrome and presented **without needing 26 separate instructions**.

## E8. Demonstration script — 7–10 minutes, optional sequence

- **Opening:** a student wastes time waiting, chasing notices and arriving at unavailable resources. Home reveals one personalized day and the next urgent action.
- **Operations 1:** Chill Spot order enters a recorded backlog behind walk-ins; show acceptance, parallel cooking and pickup without fake ETA.
- **Operations 2:** laundry is delayed; student receives **specific load** update instead of making a wasted trip; machine booking uses distinct physical state.
- **Operations 3:** mess congestion heat band suggests a quieter window; **Bookings → Classrooms shows CR Conference Hall, CR1, CR3 and G12 and lets the student book a recorded free demo slot instantly**; a second booking is prevented; maintenance ticket status saves a follow-up visit.
- **Information surprise:** at one hour before quiz, new (demo) BMS email arrives; exact student seat is extracted, Notification Center/Calendar/Home update, and the amended column is highlighted after a corrected mail arrives.
- **Evidence close:** Time Tax dashboard shows observed waits and modeled interventions separately; cite actual sample windows and assumptions, not simulated time savings as fact.

The goal is **one coherent product story**, not a slideshow of 26 unrelated menu icons.

## E9. Done, and ready for user-requested *additional* features

At completion of the original scope, the team may introduce **new extra features** under the existing engines and design system without reopening all earlier rounds. Add them to a single future `FEATURE_ADDITIONS.md` or a new revision of this file, with small compatibility notes. Do not block new feature ideation on repeated audits or extra paperwork.

---

# F. DROP-IN CLAUDE CODE EXECUTION DIRECTIVE

Copy this instruction into Claude Code **after adding the file to the repository**. It intentionally replaces the old “read-only audit and wait for approval” approach for this consolidated feature rollout.

> **Read `docs/CampusOS_FINAL_V2_Master_Product_Implementation_Spec.md` and treat it as the final consolidated V2 design/implementation brief for the complete original 26-feature CampusOS scope.**
>
> I have already approved proceeding with implementation of this scope. **Do not initiate another read-only implementation audit, re-open feature brainstorming, or ask me to confirm dozens of individual defaults.** Preserve the running app, existing approved decisions, and stable routes.
>
> Implement all 26 features to the detailed standards in §B, **plus the first-class Bookings → Classrooms extension in §B-Classrooms for CR Conference Hall, CR1, CR3 and G12 (availability and direct eligible booking)**, plus the Home/Calendar/Time Tax cross-cutting features in §C/§E, and the Campus Mail → last-minute personalized exam-seating notification flow in §D. **Make the email feature work immediately with a clearly labelled simulated inbox and sample incoming messages; actual live OAuth/provider sync and cross-device browser push belong to the final secured backend phase and must not be faked.**
>
> Reuse canonical booking, request, schedule, notification and activity state; create meaningful end-to-end journeys, not placeholder tiles. Prioritize polish and student usability. Use existing libraries, architecture and specs as supporting reference, but this master file unifies the scope. Never invent real campus details, approvals, mail, prices or seat allocations; use transparent demo fixtures and configurable defaults.
>
> **Keep testing lean:** targeted checks while coding, approximately 10–15 invariant regressions and one integrated manual smoke pass from §E6. Do not spend the majority of time generating redundant tests/reports. Fix critical bugs when found.
>
> Work through §E5 in a practical sequence without pausing for new approvals at every module. Update the feature registry in place and provide one compact end-of-workstream summary listing completed functional modules, remaining genuine blockers, and the exact preview URL. Do not claim connected emails, live push, campus approval or actual shared backend until genuinely configured.
>
> When the original 26-feature scope is present and coherent, I will supply **additional new features**. Keep the architecture extensible for them.

---

# G. COVERAGE MAP — WHAT WAS RETAINED FROM THE GROUP'S ORIGINAL BRAINSTORM

The following closing checklist exists to make sure a single-file handoff **has not silently reduced the initial ideation**. It is **not** an instruction to run 26 separate test suites.

| Original brainstorm item | Preserved in this master spec |
|---|---|
| Student-run Chill Spot, online order, cafe acceptance/rejection and readiness | F01; pay at pickup, existing walk-ins, parallel prep and three queues |
| Calendar with semester events, exams, course/batch filters, reminders, class-change alerts, Google Calendar possibility | F02, C1, C4 |
| Leave/out-time form, review, approval, gate check, evidence, download, history | F03 |
| Gym schedule/occupancy, equipment, maintenance, punch-in/out | F04 |
| External SS laundry arrivals and load-specific delays; in-house machines | F05 |
| Badminton court slots, partner, waitlist, grace period | F06 |
| TT, pool and basketball booking | F07 |
| Library study spaces, rooms, occupancy, catalog/loans | F08 |
| Mess voluntary punch in/out and crowd information | F09 |
| Meals, weekly menu, substitutions, feedback, dietary facts | F10 |
| Mess Google Form/link, upcoming fees and payment reminders | F11 |
| General complaint ticket, escalation and feedback | F12 |
| Office/gate courier log, targeted alert, uncollected reminders | F13 |
| Classroom projector/mic/AC/smartboard maintenance | F14 |
| Google-Classroom-type course materials, assignments, projects, announcements | F15 |
| Photo-based lost/found gallery, matching, owner verification | F16 |
| Availability and time to approach faculty | F17 |
| Peak-demand Best Time to Go guidance | F18 |
| Music room reservation and occupancy | F19 |
| Club/committee directory, members, social channels, recruitment, meetings | F20 |
| Invite faculty to mentor project groups | F21 |
| Three midnight birthday-celebration spots and cross-midnight booking | F22 |
| BMS office scheduling | F23 |
| Team creation/joining, last-minute players, fixtures and notifications | F24 |
| Preference-controlled Notification Center | F25; *expanded* Campus Mail live-feed plan |
| Student-specific room, row, column seating | F26; *expanded* one-hour mail-triggered scenario |
| Unexpected meeting notices; admin/CR/SR weekly announcements | C3–C4 |
| Classroom Finder and **direct reservations** for **CR Conference Hall, CR1, CR3, G12**, status/availability ribbon, booked-slot handling, classroom requests and CR approval mode | **§B-Classrooms**, C4, C5 and E6 |
| Attendance/leave counter | C4 |
| Printing, shuttle and Wi-Fi Time Tax | C4 + E4 observation categories |
| Business Operations queueing, peak load and demand heatmap | F18 + E4 |
| Initial design philosophy and personalization | A2 + C1–C6 |
| Shared final backend as a later milestone | A3 + D8 + E2/E5 |

**Completion meaning:** this document exhaustively **specifies** the original feature scope and intended rich experience. Only the working repository, real consented integrations and actual field observations can establish implementation, live-data coverage, or measured improvement.
