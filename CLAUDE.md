# CampusOS — instructions for Claude Code

You are developing **CampusOS**, a **working academic prototype** for the IBO/Business Operations **Time Tax** problem. The implementation must be modular, accessible, cohesive, and factual about what is real versus simulated. Read `README.md` for product context.

## Authoritative inputs (read before editing)

1. `docs/DECISIONS.md` — user-confirmed decisions, approved changes and proposed defaults.
2. `docs/FEATURE_REGISTRY.md` — what is scoped, specified, implemented, or deferred.
3. `docs/features/CampusOS_Home_Dashboard_Spec_v1.0.md` — **COS-HOME-001**, Home contract and acceptance IDs.
4. `docs/features/CampusOS_Unified_Calendar_Spec_v1.0.md` — **COS-CAL-001**, Calendar + Task Panel contract and acceptance IDs.
5. `docs/features/CampusOS_Chill_Spot_Spec_v1.0.md` — **COS-CHILL-001**, Chill Spot (implemented locally; see `docs/DECISIONS.md` DEC-046–DEC-058), with its V2 addendum `docs/features/CampusOS_Chill_Spot_V2_Enrichment_Addendum.md` (**COS-CHILL-V2-001**, implemented locally; DEC-124–DEC-130).
6. `docs/features/CampusOS_Laundry_Mess_Parcels_Spec_v1.0.md` — **COS-ESSENTIALS-001**, Laundry, Mess and Parcels (implemented locally; DEC-059–DEC-071).
7. `docs/features/CampusOS_Space_Reservations_Spec_v1.0.md` — **COS-SPACES-001**, Library, Music Room and Chill Zone (implemented locally on the Sports engine; DEC-088–DEC-099).
8. `docs/features/CampusOS_Administration_Spec_v1.0.md` — **COS-ADMIN-001**, Leave, Complaints and Teaching-Aid reports (implemented locally; DEC-100–DEC-112).
9. `docs/features/CampusOS_Sports_Fitness_Spec_v1.0.md` — **COS-SPORTS-001**, Gym, Badminton and Other Sports (implemented locally; policy values still PROPOSED; DEC-072–DEC-087).
10. `docs/features/CampusOS_Shared_Experience_Analytics_Spec_v1.0.md`, `docs/features/CampusOS_Academics_Faculty_Spec_v1.0.md` and `docs/features/CampusOS_Community_Spec_v1.0.md` — **COS-SHARED-001**, **COS-ACADEMICS-001** and **COS-COMMUNITY-001** (implemented locally; policy values still PROPOSED; DEC-113–DEC-123). `docs/V2_DEEPENING_ROADMAP.md` is a planning backlog, not authorization.
11. `docs/reference/CampusOS_Information_Architecture_v1.md` and `docs/reference/ibo grp 5 (1).md` — **context and future vision**, not automatic permission to build.

When a spec describes an earlier phase as unfinished, defer to newer approved feature specs (e.g. Home's historical Round 2 handoff is superseded by `COS-CAL-001`). If binding documents conflict, **surface the conflict and ask before changing product behavior**. Never claim background context is a confirmed requirement.

## Immediate mandate: phased work, two features only

- **Current implementation scope:** shared shell/infrastructure, **Home** and **Unified Calendar + Task Panel**, using `README.md` Phase **0 → 5**. Do not implement all phases in one turn.
- **After Phase 5:** future services arrive **only as individually approved** `docs/features/*.md` contracts and registry changes. Keep future routes honest placeholders until approved.
- **FINAL PHASE ONLY:** small backend + Demo Operations interface to showcase updates in separate clients. Design repository interfaces now, **do not create a server, WebSocket, provider account, database schema or fake live workflow yet**. The one exception (DEC-046, DEC-070) is the *local* Demo Operations panels on the Chill Spot, Laundry, Mess, Parcels and Bookings pages (Sports, Library, Music Room and Chill Zone), the Administration pages, and the Academics, Community and exam-seating pages: manual, single-browser, clearly labelled as simulated, reachable only from an explicit Settings toggle, with no timers and no staff identity. It is not the final-phase interface and does not replace it.
- Start each phase with a read-only plan: scope, exact files, dependencies, test cases, stop conditions. Implement **one approved phase at a time**, then stop for review.
- Do not modify the two frozen feature specs or user data sources without an explicit accepted change; record decisions in `docs/DECISIONS.md` and update tests.

## Product invariants — never violate

- **No invented campus facts:** lecture times, venues, teacher availability, birthdays, mess menus, deadlines, occupancy, official approvals and measurements come from provided records or are explicitly marked `demoSeed`.
- Every persisted record has a stable ID, provenance (`dataMode` such as `provided`, `demoSeed`, `userCreated`, `simulated`) and applicable status/visibility metadata; `connected` is reserved for a future real integration.
- **Data mode is not verification.** A supplied deadline can still be tentative. Simulated data must never be called institutional/live/official.
- Keep **date-only** deadlines date-only. Never fabricate `23:59` or turn an unspecified deadline into a timed appointment. Default timezone: `Asia/Kolkata`.
- Never equate personal task completion with official submission, form submission with verified payment, or simulated leave approval with real permission.
- Birthdays are private unless permission and audience are documented; isolate each demo profile's personal events, tasks, preferences and notifications.
- Calendar is a **projection of canonical records**, not a copy of assignments, bookings, menus, or orders. Home derives its schedule, deadlines, tasks and activities from the same selectors/repositories.
- Presets, filters, hide/show and layout reset change **presentation only**, not data. Demo reset is a separate, deliberate, confirmed operation.
- Week/Day conflicts warn without silently rescheduling personal plans; exclusive booking capacity belongs to the eventual Bookings module.
- Free Pockets uses **only known timed busy commitments**. Date-only deadlines, birthdays and the optional mess dining overlay are not busy blocks.
- Initially, reminders are **in-app only**. Never say push/email/WhatsApp/background delivery occurred when not implemented.
- Time Tax: clearly distinguish **simulation, estimated potential, field-observed baseline, and experimentally verified effects**. Never present invented measured savings.
- Never simulate operator actions using hidden timers, or claim real-time updates exist. Demo actions must be visible, auditable, repeatable, and accurately labelled.

## Design and interaction contract

- Hybrid professional × student-life aesthetic: warm neutral canvas, deep-ink typography, restrained teal/terracotta accents, meaningful event colours; use shared design tokens.
- Accessible, responsive desktop/tablet/mobile, keyboard navigable, sufficient contrast, touch-friendly controls; respect reduced-motion preferences.
- Home is **highly personalized**: Agenda/Week centerpiece, widgets, filters, layouts, drag-and-drop **and keyboard fallback**, quick action preferences, Free Pockets, deterministic context suggestions.
- Calendar has **Month / Week / Day / Agenda**, smart layers, optional mess-time overlay, contextual **Details / Tasks / Day Context** panel, owned personal editor, recurring classes/exceptions and conflict warnings.
- Every visible CTA must actually navigate, perform a permitted local action, or be clearly disabled with an explanation. No decorative dead controls.
- Every module includes loading (where relevant), empty, invalid, error and success states. Source freshness and unknown data must be displayed honestly.
- Context7/21st.dev/frontend-design MCP or skills may help with documentation and aesthetics, **but tool output never overrides feature specs**. Confirm current APIs and dependencies rather than guessing.

## Architecture and implementation guardrails

- **Phase 0 stack proposal** in README: React + TypeScript + Vite, Tailwind/shadcn, supported Calendar engine, validation, browser/unit tests; inspect what already exists before installing anything. Record finalized stack choices in `docs/DECISIONS.md`.
- Define **typed domain models + repository/service interfaces** before components need data; initial adapter = validated seed fixtures plus profile-scoped local persistence. Do not have components independently parse arbitrary fixtures or directly write unrelated localStorage keys.
- Use deterministic IDs, seeded clocks in tests, immutable source data, and stable event/recurrence identities. Prevent duplicate projections across Calendar/Home.
- Keep shared design components and utility selectors in coherent modules. Avoid premature full-stack scaffolding or building a large generic abstraction without a concrete two-feature need.
- Only add dependency/package scripts after checking current package files. Never invent installed tools, scripts, file paths, passing tests or integrations.
- Never commit keys, tokens, credentials, private birthday data, or actual student records to a public repo. Use anonymized demo fixtures unless user explicitly authorizes handling specific records.

## Required per-phase process

1. **Read** README, decisions, registry, and feature spec sections relevant to this phase. Inspect actual repository files. State knowns, unknowns and discrepancies.
2. **Plan** smallest vertical slice: exact files, behavior, dependencies, tests, out-of-scope items. Seek approval before cross-feature or breaking scope changes.
3. **Implement** only approved tasks, reusing canonical interfaces and design system. Don't silently 'improve' unrelated modules.
4. **Verify** with real `typecheck`, `lint`, `test`, `build` scripts **if they exist**, plus targeted browser inspection and mobile/keyboard checks. If not configured, report that fact, not a fabricated pass.
5. **Report** implemented vs stubbed vs deferred; commands/results, changed files, actual test IDs checked, remaining failures and assumptions.
6. **Stop** at the phase exit gate. Do not start the next phase or the demo backend without approval.

A feature is **complete** only when its documented acceptance criteria are run and recorded, visual/user flows are inspected, and the registry status is updated with evidence. A UI that merely looks correct is not complete.

## Adding future feature specifications

For each newly approved `docs/features/<Feature_Name>_Spec_vX.Y.md`:

- Register a unique stable feature ID, approval status, routes, actors, source-of-truth records, data modes, UX and states, non-goals, cross-module dependencies, interaction IDs, acceptance IDs.
- Update `docs/FEATURE_REGISTRY.md` and change log before implementation. Follow the same phase plan → approval → implement → test → evidence → stop cycle.
- Never promote a brainstorm bullet or reference route to approved functionality by inference; never expand `CLAUDE.md` with an entire new feature specification.

**Current next action if the repository contains documentation only:** present the read-only Phase 0 plan, wait for explicit go-ahead to scaffold, then implement Phase 0 only.
