# CampusOS — V2 Feature Deepening Roadmap

**Status:** Product design planning. This document is a depth/quality checklist, **not** blanket implementation authorization or retroactive approval of existing proposed defaults.

## Why a V2 pass?

V1 was used to map all original brainstorm features into an interoperable CampusOS architecture quickly. Combining multiple features into one document helped find reusable records, booking engines, request flows and consistent design rules, but **does not establish that each module is richly or completely designed**. The second pass will deepen one feature at a time (or two only where inseparable) after the V1 coverage round finishes.

## Two separate kinds of completion

- **Specification coverage:** A V1 file accounts for a feature's purpose, route, minimal states, key interactions, integration boundaries, tests and non-goals.
- **Product richness:** A V2 file has researched/coherent workflows, screen-by-screen UX, representative content layouts, edge cases, role permissions, operational constraints, measurements, and tested demo scenarios.

A feature may be V1-specified and V2-pending even if Claude Code has already written a working implementation. A running UI is not automatically product-approved.

## Mandatory V2 template for each feature

1. **Primary user problem and observable scenario:** context of use, why existing workflow fails, target outcome and alternatives.
2. **Distinct actors and responsibilities:** student, permitted staff/operator, demo role; where data originates, who can approve or revise.
3. **End-to-end flows:** happy path, alternative path, edge case, recovery, failure, cancellation and reset.
4. **Screen-by-screen UX:** information hierarchy, visual design direction, desktop/mobile/keyboard states, contents and actions, zero-data states.
5. **Detailed functional contracts:** states, permissible transitions, exact validation, statuses, timestamps, source/verification/visibility.
6. **Cross-module relationships:** canonical sources; Home, Calendar, Notifications, Search, Time Tax, booking/request engines.
7. **Operational realism:** physical constraints, lead times, capacity, queue policy, staffing, existing paper workflows, permissions and unrecorded reality.
8. **Data requirements:** source documents to request from the team; missing data left unknown rather than fabricated.
9. **Analytics and evidence:** one measurable outcome, one baseline method, a defensible simulated scenario, assumptions and limits.
10. **Testing and negative cases:** acceptance and rejection tests, accessibility and responsive inspection, test evidence, replayable demo script.
11. **Deliberate scope:** Must-have versus strong enhancements versus deferred, including dependencies and cost.
12. **V2 sign-off:** user approval of important product decisions, update registry/decisions, then implement or revise code in a subsequent authorized phase.

## Proposed deepening sequence

| Group | Existing v1 area | V2 emphasis |
|---|---|---|
| Foundations | Home | Prioritization, widget layout behavior, meaningful personalization, mobile experience |
| Foundations | Calendar + Tasks | Recurrence engine, filters/presets, full day/week UX, task editor and reminders |
| Food | Chill Spot | Real menu, physical + digital backlog, fair queue discipline, pickup and Time Tax field evidence |
| Essentials | SS Laundry | Individual load statuses, provider pickup/return exception handling, service update ownership |
| Essentials | Laundry machines | Real machine availability versus reservations, cycle-completion accuracy, no-shows |
| Essentials | Mess | Menus, provenance, occupancy reliability, payment due/verification, dietary labels |
| Essentials | Parcels | Chain of custody, privacy, uncollected statuses, verified handover |
| Sports | Gym | Occupancy, operating periods, check-in, equipment breakdown and rules |
| Sports | Badminton | Booking fairness, doubles/group bookings, waitlist, no-show cases |
| Sports | Other Sports | Sport-specific constraints, courts versus equipment, booking cases |
| Spaces | Library | Study-seat occupancy versus reservations, catalogue/loans boundary |
| Spaces | Music Room | Group sessions, equipment conditions, booking/cancellation policy |
| Spaces | Chill Zone | Midnight birthday bookings, overlapping slots, consent and facility permission |
| Admin | Leave & Out-Time | Multi-step institutional approval logic (demo-only), invalid documents, gate step |
| Admin | Complaints | Assignment, prioritization, SLA and reopen/escalation integrity |
| Admin | Teaching aids | Class disruption, equipment-specific history and deduplication |
| Academic | Course Hub | Hierarchy of notices/resources/assignments, actual course data, study planning |
| Academic | Faculty Appointments | Authorized published availability, request/reschedule and privacy |
| Academic | Mentorship | Student groups, mentor requests, feedback, milestone permissions |
| Academic | BMS Office | Waiting, forms, appointment and office workflow boundary |
| Community | Lost & Found | Safeguarded proof, gallery, possible matches, claim and handover |
| Community | Clubs & Committees | Directory personality, recruitment, approved public contacts, meetups |
| Community | Sports Fixtures & Teams | Rosters, captains, join flows, fixture changes, committee simulation |
| Shared | Notification Center | Mandatory/optional categories, dedupe, source and critical-alert behavior |
| Shared | Best Time to Go | Actual versus illustrative demand data; data minimums and interpretation |
| Shared | Time Tax Analytics | Reliable quantitative methodology and operational metrics |
| Shared | Exam Seating | Individualized verified-data visibility, privacy and update notifications |

## Gaps to return to after V1 coverage

- Actual institution-specific schedules, policies, timings, menu/pricing, capacities, and source files.
- What the campus can truly update, and which staff/provider role could maintain those updates.
- Human-friendly visual design: card imagery, information density, accessible typography, visual hierarchy and realistic demo narratives.
- How every feature handles non-participating users and incomplete/freshness-limited records.
- One unified test-evidence register, source-to-feature matrix and demo script for the IBO presentation.
- The final backend should be introduced only after those decisions and a single-browser prototype are stable.

## Claude Code handling

Keep this roadmap in `docs/` as a **planning backlog**. A future V2 file should supersede only its designated feature contract when approved, and any contradiction with already implemented code must be identified before changes. Never silently merge V2 exploration into an approved V1 implementation, or present proposed enhancements as completed functionality.
