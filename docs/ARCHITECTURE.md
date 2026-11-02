# CampusOS — Technical Architecture

Describes what **exists in the repository now** (Phases 0–5: shell, Home, Unified Calendar). Decisions live in
[`DECISIONS.md`](DECISIONS.md) (DEC-012, DEC-013, DEC-016–DEC-035); feature behaviour lives in the specs.
Nothing here overrides a feature spec.

## Running it

Requires Node ≥ 20.19 (developed on 20.20.2; `.nvmrc` = 20).

```bash
npm install
npm run dev            # Vite dev server
npm run typecheck      # tsc -b (app, node and e2e projects)
npm run lint           # oxlint (react, typescript, jsx-a11y)
npm test               # Vitest + React Testing Library
npm run test:e2e       # Playwright against a production build (run `npx playwright install chromium` once first), includes axe accessibility scans
npm run evidence       # runs both suites and regenerates docs/TEST_EVIDENCE.md
npm run check:contrast # WCAG contrast of the design tokens
npm run build
```

## Stack (installed versions)

React 19.3.1 · TypeScript 7.0.2 · Vite 8.3.5 · Tailwind CSS 4.3.3 · shadcn/ui (new-york) on `radix-ui` 1.8.1 ·
Lucide React 1.66.0 · React Router 7.18.5 · Zustand 5.0.16 · Zod 4.6.7 · temporal-polyfill 1.0.6 ·
Vitest 4.1.12 · Testing Library · Playwright 1.64.1 · oxlint 1.90.0 · Prettier 3.9.10 ·
Inter Variable and Fraunces Variable (self-hosted via Fontsource).

Added after Phase 0: @dnd-kit (Home drag-and-drop) and @axe-core/playwright (accessibility checks). Deliberately not used: FullCalendar (DEC-029), Recharts, Motion.

## Layout

```
src/
  app/            providers, router, route registry, app store, shell/ (sidebar, top bar, mobile nav), pages/
  components/     shared presentational pieces; ui/ = shadcn primitives (generated, themed by tokens)
  design/         tokens.css — the single source of design tokens
  domain/         provenance, profile and record schemas (Zod), layer/category mapping, id helpers
  data/
    storage/      StorageAdapter — the ONLY code allowed to touch browser storage
    domain/       CampusDataRepository (seed + user layer, validated writes), user-data parsing
    prefs/        per-profile preference schemas: calendar, home, planning, reminders, notifications
    chill/        ChillRepository: ONE global café store (orders, counter report, busy, pause) + per-profile carts
    ess/          EssRepository: ONE global Campus Essentials store (laundry loads, machines, reservations, mess sessions, fee, parcels)
    admin/        AdminRepository: ONE global Administration store (leave requests with revisions, tickets for complaints and teaching aids)
    shared/       SharedRepository: ONE global store for exams, private exam seats and Time Tax scenarios
    academics/    AcademicsRepository: ONE global store for notices, faculty/office/club meetings, project groups and mentor invitations
    community/    CommunityRepository: ONE global store for Lost & Found, clubs and sports teams/fixtures
    sports/       SportsRepository: ONE global Sports store (resources, reservations, waitlist, gym self-reports, equipment, operation log)
    service-runner.ts  the shared persist-then-announce loop every global service store uses
    repositories/ generic interfaces + profile, preferences and app-state adapters
    seeds/        demo/ (fictional, labelled, dates relative to today) and provided/ (empty; see its README)
  features/       home/ (widgets, Customize, layout-ops), calendar/ (views, editors, tasks panel), chill/ (menu, cart, orders, queue panel, simulator, Time Tax), essentials/ (laundry, machines, mess, fees, parcels, simulators), sports/ (bookings hub, gym, badminton, other sports, library, music room, chill zone, My Bookings, waitlist, Demo Controls), administration/ (hub, leave, complaints, teaching aids, My Requests, simulator), services/ (hub), tasks/, notifications/ (reminder engine + inbox), settings/, placeholders/, common/
  selectors/      pure functions: occurrences, filters, conflicts, Free Pockets, deadlines, Up next, reminders, Home widgets
  lib/time/       Clock, DateOnly/LocalTime, Temporal helpers, half-open intervals, formatting
  test/           setup, in-memory storage, renderApp helper, architecture guardrail tests
e2e/              Playwright: viewports, keyboard, drag-and-drop, editing flows, axe accessibility scans
scripts/          check-contrast.mjs
```

## Data flow

```
seed fixtures (immutable) ─┐
                           ├─► repositories (async, Zod-validated, subscribe) ─► Zustand store ─► pure selectors ─► components
user deltas (localStorage)─┘            ▲
                                        └─ the final-phase demo backend is a new adapter behind the same interfaces
```

- Components never read fixtures or storage directly. `src/app/services.ts` is the composition root.
- Source records (`provided`, `demoSeed`, `simulated`) are never mutated; only `userCreated` records are writable
  (contract documented in `repositories/types.ts`).
- Calendar and Home will both derive from the same selectors, so a record exists once.
- Chill Spot keeps one canonical order record (`campusos:chill:v1`). The tracker, My Orders and Home My Activity all read it through `ownOrders`, and carts live in `campusos:chill-cart:v1:<profileId>`. Money is integer paise (`lib/money.ts`). Order state changes only through `transitionOrder`, which enforces the transition table, bumps the version and appends history. The three queue measures (counter line, preparation backlog, pickup) are separate selectors and are never summed. Reading never writes; the starting scenario lives in memory until the first change (DEC-053).
- Chill Spot V2 (`COS-CHILL-V2-001`) is additive on the same store: optional order fields (`exceptionFlag`, `studentReportedArrivalAt`), an optional `handlingNote` on a transition, one optional store flag (`requireHandlingNote`, off by default) and per-profile favourites in `campusos:chill-favs:v1:<profileId>`. Every operator action still goes through `transitionOrder`; flags and the arrival marker are annotations that change no status or version, and the Operations view derives its counts and durations from the recorded transitions only.
- Campus Essentials keeps one canonical store (`campusos:ess:v1`) the same way. Pure rules live in `domain/ess-logic.ts` and return the next store plus the in-app notices a change earned; the repository persists first, then announces. Machine reservations are exposed to Calendar and Home only through the existing booking projection (`extraBookings` → `BookingRef`), so a reservation exists once. `EssWatcher` shows due messages (uncollected parcel, reached cycle estimate) once, each time `useNow` re-reads the clock; it owns no timer (DEC-064).
- Reservations share one engine. `domain/booking-core.ts` decides whether a slot is allowed (past, horizon, per-owner limit, overlap and capacity with an optional turnover buffer) for Sports courts and tables and for the Essentials washing machines; `domain/service-core.ts` and `data/service-runner.ts` carry the audit, notice and persistence plumbing. The check also understands overnight intervals (an optional end date) and refuses an end that is not after the start. The Library, Music Room and Chill Zone are resources in the same Sports store, not a third store. Each module keeps its own states and policy values. Both reach Calendar and Home through the single `BookingRef` projection (`extraBookings`), so a reservation exists once. Collision checks hold only within one browser's data (DEC-087).
- Administration is a fourth global store (`campusos:admin:v1`) on the same plumbing, with typed leave and ticket variants. Privileged transitions are domain guards keyed on a simulated role, decisions are bound to a revision and status version, and `/administration/requests/:id` only forwards to the canonical record.
- Shared, Academics and Community are the fifth, sixth and seventh global stores (`campusos:shared:v1`, `campusos:academics:v1`, `campusos:community:v1`) on the same runner. Faculty, BMS Office and club conversations use one meeting engine (`domain/academics-logic.ts`) keyed by `actorKind`; accepted meetings, followed-club events and team fixtures reach Calendar and Home only as read-only `BookingRef` projections from each repository's `bookingRefs` (one record, shown once), so no store copies another's records. Private fields (exam seats, claim answers, report proof details, group data) are filtered by selectors and by owner checks in the domain rules, never only by hidden buttons. Notification category is derived from a message's link, and a per-category mute hides only standard and optional messages.
- Classrooms (`campusos:classrooms:v1`) and the simulated Campus Mail (`campusos:mail:v1`) are the eighth and ninth global stores. Classrooms reuse `booking-core` for interval checks and project confirmed reservations through `bookingRefs`. Mail never owns a seat: it extracts candidates with line evidence, then writes the seat through `SharedRepository.applyMailSeat` (versioned, silent) and sends its single alert only after that write succeeded; the alert key carries the notice id, so a replay cannot repeat it. Nothing in mail is real: no account, token, fetch, or push exists.
- V3 adds group meetings and polls (`campusos:meetings:v1`) and issue reports (`campusos:reports:v1`). Scheduling is a pure engine (`domain/availability.ts`) fed by `selectors/availability.ts`, which turns a profile's own calendar projection into bare busy intervals; a meeting is projected to each guest through `bookingRefs`, and a room held for it is a Classrooms reservation with a `meetingId` so Calendar shows one entry. Evidence blobs live in IndexedDB (`data/evidence`), never in localStorage. Check-in leases are derived in `normalizeSportsStore` on every read, so expiry needs no timer.

## Persistence

`campusos:<area>:v<version>[:<profileId>]`, e.g. `campusos:home:v1:demo-student-a`, `campusos:app:v1`.
Reads are schema-validated and never throw; corrupt data yields defaults (`source: 'recovered'`) and is **not**
deleted. If storage is unavailable or full the adapter switches to memory and the shell shows a visible notice;
writes then return `ok: false`, so no UI may claim "Saved".

## Time

Date-only deadlines are `DateOnly` and cannot become instants without an explicit `LocalTime`. "Today" is computed
in `Asia/Kolkata` from an injected `Clock`. Intervals are half-open `[start, end)`. Only `src/lib/time` may call
`new Date`, `Date.now` or `Temporal.Now` (enforced by `src/test/architecture.test.ts`).

## Guardrails enforced by tests

`architecture.test.ts` fails the build if code outside its allowed place: reads the clock, touches
`localStorage`/`sessionStorage`/`indexedDB`, or uses `setTimeout`/`setInterval` (no hidden timers that could pretend
to be an operator or server). `routes.test.ts` fails if any route claims to be `live` before it is, and
`app-shell.test.tsx` / e2e assert every non-live page says it is in development or coming later.

## Adding a feature route

1. Register or update its entry in `src/app/routes.ts` (status, registry refs, planned phase).
2. Replace its element in `src/app/router.tsx`.
3. Move its status to `live` only when its acceptance tests have been run and recorded.

## Known limitations

- All data is demonstration data or created in the browser; no real timetable, deadline, birthday or menu has been supplied (`src/data/seeds/provided/` is empty).
- Bookings, complaints and leave requests do not exist: Home shows read-only sample bookings and the profile's demo Chill Spot orders, and tests `H-T08` / `C-T18` are deferred or partial (DEC-023).
- Tested in Chromium only; automated accessibility checks pass but no manual screen-reader pass has been done.
- Timed events cannot cross midnight; several optional behaviours were intentionally not built (DEC-033).
- No backend, WebSocket or live update exists. Machine and space collisions are checked only in one browser's data; two browsers can double-book a slot (the final phase would add transactions). Chill Spot's Demo Operations panel changes data in one browser only; another browser or device never sees it. Menu, prices, queue figures and hours are fictional. The final-phase demo backend would replace the adapters created in `src/app/services.ts`.
- Dark mode is not specified and not built. Cross-tab storage synchronisation is not implemented.
