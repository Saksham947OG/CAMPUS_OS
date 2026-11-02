# CampusOS

**November 2026 source update:** CampusOS now uses the supplied campus documents and three consumer personas by default. Open **Data & Sources** (`/sources`) for all 28 files, original text, adapted dates and data gaps. The fixed reference week is November 2–8, 2026. Menus, curriculum, faculty associations, schedules and proposed events are source-labelled; operational assumptions remain illustrative. Time Tax supports source evidence and saved timed observations. Private identity scans require protected storage. See `docs/features/CampusOS_Source_Data_Personas_Spec_v1.0.md` for the current import contract; older sections below describe the prototype's history.


**A working academic prototype for a more coordinated campus.**  
**Project:** Introduction to Business Operations (IBO) — *The Time Tax*  
**Product state:** Home, Unified Calendar, Chill Spot, Campus Essentials (Laundry, Mess, Parcels) and Sports & Fitness, Space Reservations (Bookings) Administration, Shared Experience (notifications, exam seating, Best Time to Go, Time Tax), Academics (Course Hub, faculty, mentorship, BMS Office) and Community (Lost & Found, clubs, sports teams) implemented with demonstration data only; evidence in [`docs/TEST_EVIDENCE.md`](docs/TEST_EVIDENCE.md); no real campus data, backend or other modules yet  
**Current build scope:** Phase 0–5, **Home Dashboard** (`COS-HOME-001`), **Unified Calendar + Integrated Task Panel** (`COS-CAL-001`) and, by later instruction, **Chill Spot** (`COS-CHILL-001`) and **Campus Essentials** (`COS-ESSENTIALS-001`), **Sports & Fitness** (`COS-SPORTS-001`) **Space Reservations** (`COS-SPACES-001`) **Administration** (`COS-ADMIN-001`), **Shared Experience** (`COS-SHARED-001`), **Academics** (`COS-ACADEMICS-001`) and **Community** (`COS-COMMUNITY-001`), all local prototypes only.  
**Visual direction:** Hybrid professional productivity × approachable student life.

> **Important:** Home and the Calendar now exist and run, but every record in them is demonstration data or created in your browser. Sections below that describe other modules, imports and the demo backend describe the **intended** product, not working features. No official campus integration, live feed, measured time saving, or institutional authorization is claimed.

## 1. The problem and product

Campus information and services are fragmented: students waste time waiting, locating schedules or deadlines, following up on requests, and coordinating access to shared facilities. The project originated as a Business Operations investigation of this **Time Tax**—the avoidable cost of waiting and information friction.

**CampusOS** is a unified, responsive student-facing prototype designed to bring campus schedules, service interactions, bookings, academic coordination, requests, and community updates into one coherent experience. The long-term vision encompasses **26 ideas** from the group's brainstorming, but this is **not a 26-module implementation sprint**.

The product aims to help a student answer: **What is happening today? What needs my attention? What can I do now? What is happening on campus?** Later iterations will demonstrate the connection between service operations and potential waiting-time reduction.

### This project **is**

- An **interactive academic demonstration** with source-labelled fixture data and meaningful, persisted local actions.
- A highly personalized **Home** and a **smart layered Calendar** as the first two deeply specified features.
- A modular product that can add feature specifications and implementations incrementally.
- A project in which estimated time savings are transparently distinguished from measured observations.
- **Backend-ready by architecture**, but initially functional without a server or live provider connections.

### This project **is not**

- An official college ERP, attendance record, examination authority, or gate/leave approval system.
- A live occupancy sensor, guaranteed campus availability service, or verified real-time queue monitor.
- A real payment gateway or proof that a fee/food order has actually been paid.
- A replacement for a full LMS, Google Classroom, or the university's existing systems.
- A surveillance tool for individual students or faculty.
- A reason to invent class schedules, rooms, menu items, birthdays, faculty presence, deadline times, or outcomes.
- A claim that a service provider received an order or acted on a request unless an actual authorized integration eventually exists.

## 2. Current scope and source documents

| Document | Authority / purpose | Status |
|---|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Always-on constraints for Claude Code; working protocol and guardrails | Active project instructions |
| [`docs/features/CampusOS_Home_Dashboard_Spec_v1.0.md`](docs/features/CampusOS_Home_Dashboard_Spec_v1.0.md) | **Home** behavior, layout, widgets, personalization, edge cases, tests (`COS-HOME-001`) | Approved Round 1 design baseline; not built |
| [`docs/features/CampusOS_Unified_Calendar_Spec_v1.0.md`](docs/features/CampusOS_Unified_Calendar_Spec_v1.0.md) | **Calendar** views, source records, task panel, reminders, recurrence, tests (`COS-CAL-001`) | Approved Round 2 design baseline; not built |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Confirmed choices, proposed implementation defaults, open questions, change approvals | Active working register |
| [`docs/FEATURE_REGISTRY.md`](docs/FEATURE_REGISTRY.md) | All 26 brainstorm ideas and their development state; future additions registered here | Active scope index |
| [`docs/features/CampusOS_Chill_Spot_Spec_v1.0.md`](docs/features/CampusOS_Chill_Spot_Spec_v1.0.md) | **Chill Spot** advance ordering and hybrid queue information (`COS-CHILL-001`, F01) | **Implemented as a local prototype** (menu, cart, Pay-at-Pickup order requests, queue measures, tracker, Home integration, Settings-gated simulator, illustrative Time Tax). Real backend, multi-client sync and operator interface remain the final phase |
| [`docs/features/CampusOS_Laundry_Mess_Parcels_Spec_v1.0.md`](docs/features/CampusOS_Laundry_Mess_Parcels_Spec_v1.0.md) | **Campus Essentials**: SS Laundry, washing machines, Mess and Parcels (`COS-ESSENTIALS-001`, F05/F09/F10/F11/F13) | **Implemented as a local prototype** with a Settings-gated simulator; no provider, sensor, payment or courier integration; real backend remains the final phase |
| [`docs/features/CampusOS_Sports_Fitness_Spec_v1.0.md`](docs/features/CampusOS_Sports_Fitness_Spec_v1.0.md) | **Sports & Fitness**: Gym, Badminton, Other Sports (`COS-SPORTS-001`, F04/F06/F07) | **Implemented as a local prototype** (hub, gym, badminton, other sports, My Bookings, waitlist, Settings-gated Demo Controls); demo policy values are still PROPOSED defaults, and cross-device collision prevention is the final phase (DEC-072–DEC-087) |
| [`docs/features/CampusOS_Space_Reservations_Spec_v1.0.md`](docs/features/CampusOS_Space_Reservations_Spec_v1.0.md) | **Space Reservations**: Library, Music Room, Chill Zone (`COS-SPACES-001`, F08/F19/F22) | **Implemented as a local prototype** on the shared Sports booking engine (overnight-aware, demo catalogue and loans, Settings-gated simulator); no library system, real spaces or allocation; backend remains the final phase (DEC-088–DEC-099) |
| [`docs/features/CampusOS_Administration_Spec_v1.0.md`](docs/features/CampusOS_Administration_Spec_v1.0.md) | **Administration**: Leave & Out-Time, Complaints, Teaching-Aid reports (`COS-ADMIN-001`, F03/F12/F14) | **Implemented as a local prototype** (simulated approver, maintenance and gate roles behind a Settings switch; no real approval, gate pass or repair); backend, staff authentication and real notifications remain the final phase (DEC-100–DEC-112) |
| [`docs/features/CampusOS_Shared_Experience_Analytics_Spec_v1.0.md`](docs/features/CampusOS_Shared_Experience_Analytics_Spec_v1.0.md) | **Shared Experience**: Notification Center, Exam Seating, Best Time to Go, Time Tax (`COS-SHARED-001`, F18/F25/F26) | **Implemented as a local prototype** (in-app only; illustrative data; no real exam records or delivery) (DEC-113, DEC-114, DEC-118, DEC-119) |
| [`docs/features/CampusOS_Academics_Faculty_Spec_v1.0.md`](docs/features/CampusOS_Academics_Faculty_Spec_v1.0.md) | **Academics**: Course Hub, Faculty appointments, Mentorship, BMS Office (`COS-ACADEMICS-001`, F15/F17/F21/F23) | **Implemented as a local prototype** (fictional faculty and office; a simulated reply behind a Settings switch; nothing is delivered to a real person) (DEC-113–DEC-117) |
| [`docs/features/CampusOS_Community_Spec_v1.0.md`](docs/features/CampusOS_Community_Spec_v1.0.md) | **Community**: Lost & Found, Clubs & Committees, Sports teams and fixtures (`COS-COMMUNITY-001`, F16/F20/F24) | **Implemented as a local prototype** (fictional clubs and teams; a simulated reviewer, captain and committee behind a Settings switch) (DEC-113, DEC-114, DEC-120–DEC-122) |
| [`docs/features/CampusOS_Chill_Spot_V2_Enrichment_Addendum.md`](docs/features/CampusOS_Chill_Spot_V2_Enrichment_Addendum.md) | **Chill Spot V2** (`COS-CHILL-V2-001`, addendum to `COS-CHILL-001`) | **Implemented as a local prototype** (no ETA, no backend, simulated operator only) (DEC-124–DEC-130) |
| [`docs/CampusOS_V3_Master_Implementation_Prompt.md`](docs/CampusOS_V3_Master_Implementation_Prompt.md) | **V3 expansion prompt** (`COS-V3`): collaborative calendar, grade/attendance planners, Campus AI, issue reports, check-in lease | **Partly implemented** (local prototype; unbuilt items listed in the registry) (DEC-136–DEC-142) |
| [`docs/CampusOS_Master_v2.1.md`](docs/CampusOS_Master_v2.1.md) | **Master brief v2.1** (`COS-MASTER-V2`): Bookings → Classrooms and simulated Campus Mail → exam seating | **Partly implemented** (those two surfaces only; local prototype; real mail, OAuth and push unbuilt) (DEC-131–DEC-135) |
| [`docs/V2_DEEPENING_ROADMAP.md`](docs/V2_DEEPENING_ROADMAP.md) | V2 deepening plan | **Planning backlog only**; it authorizes nothing (DEC-113) |
| [`docs/reference/CampusOS_Information_Architecture_v1.md`](docs/reference/CampusOS_Information_Architecture_v1.md) | Product-wide proposed routes, domain grouping, and future cross-module behavior | **Reference / proposed**, not blanket permission to build |
| [`docs/reference/ibo grp 5 (1).md`](docs/reference/ibo%20grp%205%20%281%29.md) | Original group brainstorming and context | Historical input, not a locked functional spec |

**Privacy note:** The original brainstorming reference is preserved as supplied and may contain example student details. Review and redact identifiers before making a repository public. Use anonymized demo fixtures for the application.

**Precedence:** Explicit recent user decisions and the decision log govern scope; `CLAUDE.md` governs development process; active feature specs govern their modules; original brainstorm/reference documents provide background. If two binding statements disagree, **record the conflict and request a decision** rather than silently selecting one. The Home spec's old “Round 2 not yet locked” handoff is historical; the finalized Calendar spec now supplies that contract.

### Product-wide navigation direction (future-aware, not all implemented)

`Home · Calendar · Campus Services · Bookings · Academics · Administration · Community · Time Tax` with `Search · Notifications · Settings` in the global shell. For the first milestone, **Home and Calendar must be the only fully operational feature routes**; future destinations may be explicit, clearly labeled *Coming later* placeholders, never fake working pages.

## 3. Feature 1 — Highly personalized Home

**Route:** `/` (or `/home` redirecting to `/`). See `COS-HOME-001` for the precise contract.

- **Switchable Agenda / Week** schedule widget using the same records as Calendar; selected mode persists per demo profile.
- **Up Next**, **Deadline Focus**, four editable **Quick Actions**, **My Activity**, **Mess Preview**, **My Tasks**, **My Free Pockets**, **Campus Pulse**, and **Time Tax Snapshot**.
- Three-zone dashboard: **Immediate Priorities**, **Things to Do**, **Discover & Reflect**.
- Personalization: show/hide optional cards, resize, reorder (drag-and-drop plus keyboard alternative), layout presets, display density, saved per-profile settings and reset without data loss.
- Deterministic context suggestions grounded in stored events; **not** an AI that fabricates students' schedules.
- Time Tax UI must never imply projected hours are actual measured savings.

**Home is a projection of canonical data.** It must not maintain independent copies of Calendar tasks, deadlines, birthdays, or future bookings.

## 4. Feature 2 — Unified Calendar and Task Panel

**Route:** `/calendar`. See `COS-CAL-001` for the precise contract.

- **Month / Week / Day / Agenda** views; default main Calendar view is **Week**, independent of Home's default **Agenda** mode.
- **Smart Layers**, course/status filters, and presets such as Balanced Campus, Academic Focus, Campus Life, and Exam Preparation.
- A contextual right-side panel: **Details / Tasks / Day Context**; responsive sheets on narrow screens.
- Import **class schedules, examinations, homework, assignments, project deadlines, birthdays, campus events, and mess information** from files provided later. Missing data remains unknown; preloaded sample data must be visibly demo-labelled.
- Contextual **mess menu by default**; optional dining-time overlay which **does not** count as the student's busy time.
- Separate **scheduled commitments**, **date-only or timed deadlines**, **personal tasks**, and **contextual information**.
- Personal task checklists and optional **focus blocks**, **Free Pockets**, overlap warnings, bounded class recurrence and per-occurrence exceptions.
- **In-app-only reminders** initially; do not promise background phone/email/WhatsApp alerts.
- Imported institutional events are read-only to student profiles; individual private events and tasks are editable.

**Notable truth rules:** A due date without a time stays date-only; a self-completed checklist is **not** official submission; birthdays require appropriate sharing permission; a booking shown in the Calendar must refer to the actual booking record, not a copied appointment.

## 5. Data authenticity and future import

The initial prototype uses validated, source-labelled **seed fixtures** plus **per-profile local persistence** for student actions and preferences. Treat the following as separate concepts:

| Label | Meaning |
|---|---|
| `provided` | Information imported from a user-supplied document; provenance retained |
| `demoSeed` | Intentionally fabricated sample data, visibly identified as demonstration |
| `userCreated` | A record created by a demo student in the application |
| `simulated` | A transition explicitly performed in a controlled demonstration |
| `connected` | A future authenticated external integration (not available initially) |

`dataMode` is distinct from a record's confirmation/verification status. **A provided record may still be tentative**, and `demoSeed` must never appear institutionally verified merely because it is present in the UI.

**Pending inputs:** class/semester schedule (with course, section, dates, known times and venue), exam schedule, assignments and deadlines, birthdays with permitted visibility, mess timings/menus, campus events. Do not infer any missing fact from convention. When sources arrive, validate and map them without overwriting private tasks or preferences.

## 6. Proposed engineering baseline

This is a **starting technical recommendation**, not a user-approved campus fact. At **Phase 0**, inspect the environment and document actual decisions in `docs/DECISIONS.md`; do not install competing stacks.

- **Frontend:** React + TypeScript + Vite.
- **Styling:** Tailwind CSS with shadcn/ui for accessible primitives and consistent tokens.
- **Navigation:** React Router or equivalent, chosen once in Phase 0.
- **Calendar:** FullCalendar or an equivalently capable accessible calendar engine; verify current licensing and support for required views before selecting.
- **Icons:** Lucide React; **charts** (when relevant): Recharts.
- **Validation:** Zod (or documented equivalent). **Tests:** Vitest + React Testing Library for logic/components and Playwright for browser flows.
- **Dates:** Use an explicit date-only vs timed domain model and `Asia/Kolkata` defaults; choose a timezone-safe library during Phase 0.
- **Persistence:** Repository/service abstraction over validated fixtures and profile-scoped local storage; **no live server yet**.
- **Design tools (optional):** Claude Code frontend-design plugin, Context7, 21st.dev, browser-testing tools. Their output is inspiration/documentation—not product authority.

**Avoid premature dependencies:** No payments, real authentication, WebSockets, external LMS/calendar sync, cloud database, or provider API in the first two feature phases.

## 7. Phased delivery plan — build a vertical slice, then expand

Each phase requires a small plan, explicit changed files, acceptance tests, a running browser inspection, and user review before moving on. **No 'build everything' instruction.**

| Phase | Scope | Exit gate |
|---|---|---|
| **0 — Project foundation** | Scaffold, design tokens, app shell/nav, route boundaries, lint/test tools, demo-mode badge, repositories/interfaces | App starts locally; responsive shell; placeholder routes honest; baseline quality commands work |
| **1 — Calendar foundation** | Canonical types/provenance, sample fixtures, date/time utilities, views, recurrence framework, basic layers, selected-event detail | All four views render consistent records, date-only rules and basic tests pass |
| **2 — Home foundation** | Page layout, Agenda/Week switch, Up Next, deadlines, Quick Actions, navigation, cross-view selectors | Homepage and Calendar agree; no duplicate record ownership; responsive checks pass |
| **3 — Calendar interactions** | Event editor, Tasks panel, task states, focus blocks, recurring exceptions, filters/presets, mess context, reminder states, conflict detection | Calendar spec interaction tests pass, including non-destructive changes and source safeguards |
| **4 — Advanced Home** | Widgets, My Activity, Free Pockets, Campus Pulse, Time Tax teaser, layouts/presets, drag/drop + keyboard, persistence | Home spec acceptance tests pass; profile isolation; correct empty states and navigation |
| **5 — Integration and demo hardening** | Fix cross-view bugs, accessibility, small screens, deterministic reset, tests, documentation, reproducible demo script | Two-feature demo works end-to-end; actual tests recorded; no broken or misleading CTAs |
| **6+ — Future modules** | Brainstorm/spec/approve **one** service or feature family at a time (Chill Spot, Laundry, Mess, Bookings, etc.) | Add its own `docs/features/*.md`, registry row, contracts, tests and approved phase gates |
| **FINAL — Demo backend** | Small protected Demo Operations control and shared update channel after frontend is stable | Two clients see an authorized simulated change, accurately labelled; no fake official/live service claims |

**Dependency rule:** If Home requires data owned by a not-yet-implemented service (for example, orders), supply a typed adapter with a truthful empty/demo state. Do **not** build that service early, and do not create buttons that claim an unavailable workflow works.

## 8. Adding the next feature without losing discipline

1. Brainstorm and approve its behavior separately, then write a new **versioned** Markdown contract in `docs/features/`.
2. Give the feature a stable ID (`COS-...-001`), route(s), data owner, actor permissions, user journeys, states, edge cases, acceptance test IDs, and explicit non-goals.
3. Update `docs/FEATURE_REGISTRY.md`: move the feature from **brainstormed** to **specified/approved** only when the product decision has actually been made.
4. Record **meaningful changed decisions** in `docs/DECISIONS.md`; do not silently overwrite a previously approved decision.
5. In Claude Code, request a **plan for that one approved feature**, review it, then implement only its next permitted gate.
6. After running tests and reviewing the UI, update the registry to **implemented** or **verified** only when evidence exists.

**Do not** dump future specs into `CLAUDE.md`. Its job is to tell Claude how to work and which feature contract to open.

## 9. How to start in Claude Desktop / Claude Code

1. Create or open a local folder named `CampusOS` and put the **contents of this package** at its root. Confirm you can see `README.md`, `CLAUDE.md`, and `docs/features/`.
2. In the Claude Desktop app, open **Code**, select that local project folder, and start a **Local** session. Use Plan mode or request a read-only plan first.
3. **First prompt (read-only):**

   > Read `README.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/FEATURE_REGISTRY.md`, and both approved specifications in `docs/features/`. Do not write code yet. Summarize the product, current two-feature scope, proposed stack, exact Phase 0 tasks, dependencies, risks, and how you will prove the Phase 0 exit gate. Identify any conflicts without silently resolving them. Stop after the plan for my approval.

4. **After approving the Phase 0 plan, prompt:**

   > Implement **Phase 0 only** according to the reviewed plan. Preserve all documentation and original source files. Set up the project shell, design tokens, demo badge, route placeholders, data/repository interfaces, and working test/lint/typecheck scripts. Do not implement an external backend or future services. Run the available checks and report their actual results, files changed, and remaining issues. Stop after Phase 0.

5. Run the app using the scripts actually created in `package.json` (typically `npm install`, `npm run dev`); **never assume a script exists before checking**. Review in a browser and give feedback before Phase 1.

## 10. Current status and verification

| Capability | State |
|---|---|
| Home (`COS-HOME-001`) | Implemented with demonstration data; acceptance results in `docs/TEST_EVIDENCE.md` |
| Unified Calendar + Task Panel (`COS-CAL-001`) | Implemented with demonstration data; acceptance results in `docs/TEST_EVIDENCE.md` |
| Actual user-provided schedules | Not yet imported (no data supplied); everything shown is `demoSeed` or created in the browser |
| React application | Runs locally: `npm install`, `npm run dev` (see `docs/ARCHITECTURE.md`) |
| Local persistence, tests | Implemented and executed; Chromium only, no manual screen-reader pass yet |
| Booking-dependent tests (`H-T08`, `C-T18`) | Deferred / partial: the Booking module is not approved |
| All other feature families | Brainstormed; not approved for implementation |
| Real-time demo backend | Explicitly deferred to the **final** phase; nothing is built |

**Success criterion for the first build:** An evaluator can explore a polished Home/Calendar, create personal plans, inspect source-labelled academic fixtures, switch views and layouts, and see consistent local state—without being misled into believing an institution has connected its systems.
