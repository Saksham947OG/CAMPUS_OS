# CampusOS — Information Architecture & Interaction Blueprint

**Version:** 1.0 — product specification draft  
**Project:** Introduction to Business Operations / Time Tax campus prototype  
**Design direction:** Hybrid professional productivity + welcoming student lifestyle  
**Status:** Proposed architecture; not yet approved for implementation  
**Source of feature IDs:** Group brainstorming file `ibo grp 5 (1).md` (26 numbered items, plus unnumbered notes)  
**Later-stage requirement:** Small demo backend/control panel to demonstrate updates across clients; deliberately deferred to final implementation phase.

## 0. The product contract

### 0.1 What this is
A responsive, interactive student-facing **academic prototype** that centralizes campus schedules, services, requests and bookings and demonstrates how reducing waiting and information friction could save student time. It is useful as an integrated prototype even when no real provider is connected. User-provided calendars, menus and birthdays will supply genuine source data when provided.

### 0.2 What it is not
- Not an officially approved university ERP, records system or leave/gate authorization tool.
- Not a real payment gateway; a form submission is not a verified payment.
- Not a real-time occupancy sensor, a guaranteed service availability tracker, or an actual predictor without evidence.
- Not a complete LMS or replacement for Google Classroom, institutional email or approved communication.
- Not a platform for tracking individual students' movements or faculty locations.
- Not 26 separate backends, and not dependent on 26 operator accounts.

### 0.3 Demo truth model
Every piece of time-sensitive content must carry an internal `dataMode`: `provided`, `demoSeed`, `userCreated`, `simulated`, or (future only) `connected`; and a separate `verificationStatus`: `confirmed`, `tentative`, `unknown`, or `notApplicable`. Time-sensitive updates can show `sourceLabel` and `updatedAt`. **Demo data must never be labelled “live,” “official,” “confirmed by admin,” “paid,” or “approved” unless the appropriate actual source and authorization exist.** A simulated approval should be visibly called a demo approval.

### 0.4 Terminology
- **Screen**: a distinct route or dedicated view.
- **Tab**: subsection of a screen, not necessarily its own route.
- **Drawer**: contextual overlay used to view or edit a record while retaining context.
- **Demo workflow**: local actions persisted in browser storage or controlled by the final-phase demo backend.
- **Backend-ready**: designed around service/data interfaces; does not mean a backend currently exists.

## 1. Global app shell & navigation

### 1.1 Desktop structure
- **Left sidebar (fixed/collapsible, grouped):** Home, Calendar, Campus Services, Bookings, Academics, Administration, Community, Time Tax.
- **Top bar:** current section/title, global search, notification bell with unread count, demo mode indicator, profile menu.
- **Main area:** breadcrumbs when necessary; title and concise context; primary action at top right; responsive cards/tables/calendar; clear empty states.
- **Global overlays:** search palette, event detail drawer, notifications drawer, confirmation dialog, command and toast feedback.
- **Utility settings:** Profile, calendar defaults, notifications, accessibility/theme; demo controls added only in final phase.
- **Never duplicate every leaf page in the sidebar**; use cards or horizontal tabs in hub screens.

### 1.2 Mobile structure
- Bottom navigation: Home / Calendar / Services / Bookings / More.
- “More” exposes Academics, Administration, Community and Time Tax plus settings.
- Search and notifications remain in header; editing forms use full-width sheets; long tables become cards.
- No essential functionality should rely on hover or precise pointer interactions.

### 1.3 Route map
```text
/
/calendar                     [month / week / day / agenda / filters; event drawer]
/services
  /services/chill-spot         [menu / cart / my orders]
  /services/laundry           [SS laundry / machines]
  /services/mess              [today / weekly menu / occupancy / fees / feedback]
  /services/parcels           [incoming / collected / history]
  /services/best-time         [illustrative traffic patterns]
/bookings
  /bookings/gym
  /bookings/badminton
  /bookings/sports             [table tennis, pool, basketball]
  /bookings/library
  /bookings/music-room
  /bookings/chill-zone
  /bookings/classrooms        [optional, derived from unnumbered CR-booking note]
  /bookings/my-bookings       [cross-resource summary]
/academics
  /academics/courses          [course hub + assignments]
  /academics/exams            [exam schedule + example seating]
  /academics/faculty          [published appointments, not live location]
  /academics/mentorship
  /academics/announcements    [CR/SR, academic notices]
/administration
  /administration/leave       [leave / out-time / illustrative attendance counter]
  /administration/complaints  [unified complaint system]
  /administration/bms-office  [office hours / meeting request]
/community
  /community/lost-found
  /community/clubs
  /community/sports-events
  /community/events           [unified events directory]
/time-tax                     [scenario model / fieldwork / methodology]
/notifications
/search                       [optional results route; palette is primary]
/settings                     [preferences, profile, visual/accessibility]
```
The route map describes a desired IA; actual route slugs can be refined before implementation. Every route must resolve to content, not a broken or visually empty page.

## 2. Screen-by-screen contracts

**Each contract covers:** purpose → information → interaction → persisted/change result → fallback/state limitations. “Proposed” means the team has not yet approved it.

### S00 — App shell, navigation, search, notifications
- **Content:** sidebar categories and active route; breadcrumb; search; bell; account/profile; permanently visible demo-data distinction where relevant.
- **User actions:** expand/collapse nav; select page; keyboard-accessible global search; open notifications; open settings.
- **Search behavior:** index only existing local records (services, event titles, courses, clubs, issues) and navigate to exact records. If no result, show “No matching records in this prototype,” not an AI-generated answer.
- **Notification behavior:** local inbox with read/unread state, deep links, filtering; preferences for optional categories. Important academic alerts can be presented as recommended defaults rather than asserted institutional mandates.
- **Failure:** stale record deep link shows a friendly missing-record state; no fake live notification from unconnected services.

### S01 — Home `/`
- **Purpose:** answer “What do I have today? What is next? What can I do?” in under one screen of scrolling.
- **Content hierarchy:** personalized greeting/date; TODAY agenda combining lectures, assignment deadlines, birthdays and personal events; next deadline; service shortcuts; upcoming bookings/orders; recent notices; Time Tax scenario insight (explicitly estimated); optional mess preview.
- **Actions:** click agenda row → calendar event drawer; click due item → course/assignment record; quick-action cards → exact service; open active booking/order; reorder/hide optional widgets (later, not first build).
- **Shared behavior:** home widgets derive from same canonical records used by calendar and feature pages. No separate manually edited home data.
- **Empty state:** “Add your schedule” / “No events imported for today,” not fictional classes.

### S02 — Unified Campus Calendar `/calendar`
- **Purpose:** consolidate academic, social, personal and service activity without overwhelming users.
- **Views:** Month / Week / Day / Agenda; month controls, Today shortcut, category chips, course/batch filter, search, “Add personal event.”
- **Categories:** Classes, Exams, Assignments/Homework, Projects/Presentations, Birthdays, Mess schedule/special meals, Clubs, Campus Events, Sports/Fixtures, Personal Events, Bookings, Administrative Deadlines, Holidays, Meetings.
- **Display rules:** Month = compact dots/labels; week/day = scheduled time blocks; agenda = long details and deadlines; recurring mess opening times may appear as a collapsible layer to prevent clutter.
- **Event drawer:** title, category, local date/time and all-day status, location, associated course/batch, recurrence, source, confidence (confirmed/tentative), notes, reminder status, related record action.
- **Actions:** change views/month; multi-select visibility filters; add/edit/delete *personal* events; complete a personal task; click institutional events to inspect without silently editing source data; configure reminders (in-app during prototype).
- **Data imports:** raw provided documents are mapped into validated event records with original source text/ID; unknown times stay missing; recurring events support exceptions; imported events can be superseded only by a deliberate update.
- **Cross-links:** new booking appears in calendar; sports match appears in calendar; course deadline appears in both calendar and Academics; birthday sourced from consented birthday list; mess special meal can appear as relevant event.
- **Failure:** duplicate event IDs rejected; conflicting times visually flagged, not automatically resolved; reminders only fire while supported by actual browser/app mechanism; events outside relevant cohort hidden by chosen demo profile filter.

### S03 — Campus Services hub `/services`
- **Purpose:** access everyday transaction and information services in one place.
- **Content:** searchable cards for Chill Spot, Laundry, Mess, Parcels and Best Time to Go; “your active items”; service reliability label and source/update timestamp when available.
- **Actions:** card navigation; filter by service type; quick link to active order/parcel.
- **Fallback:** all services represented even if they have only a demonstration or informational section.

### S04 — Chill Spot `/services/chill-spot` [F01]
- **Tabs:** Menu, Cart, My Orders.
- **Content:** food categories, prices, sample/authorized availability, customization only if menu supports it; cart subtotal; order history and statuses.
- **Actions:** add/remove items, adjust quantity, checkout without real payment, confirm order, cancel while pending; inspect order tracking.
- **Allowed status model:** `draft → pending → accepted → preparing → ready → collected`; alternative `pending → rejected`, `pending/accepted → cancelled` subject to demo rules. Student cannot mark accepted or ready. The final demo-control panel can legitimately simulate operator transitions and label them explicitly.
- **Validation:** prevent empty order, negative quantity, ordering demo-unavailable items, accidental double submission; show “payment not integrated.”
- **Home/notification effects:** order created → My Orders and home active items update; state change in final demo → notification (labelled simulated).

### S05 — Laundry `/services/laundry` [F05]
- **Tabs:** SS Laundry (external pickup/return), Campus Machines.
- **SS content:** published pickup/return schedule; illustrative batch ID, items submitted, `notSubmitted / collected / processing / delayed / delivered / pickedUp` state; expected date may be unknown; delay reasons only if supplied.
- **Actions:** browse schedule, inspect tracking, optionally create *demo* pickup request if an operator simulation is included; do not imply external provider received it.
- **Machines content:** machine cards, available/booked/occupied/maintenance/unknown states, finishing time only if supplied or demo-mode known; book a demo slot through shared booking engine.
- **Cross-effects:** machine booking goes to My Bookings and calendar; SS status update in last-phase control panel produces notification; when state unknown show it as unknown.

### S06 — Mess `/services/mess` [F09, F10, F11]
- **Tabs:** Today, Weekly Menu, Occupancy, Fees & Payment, Feedback.
- **Today/menu content:** breakfast/lunch/snacks/dinner, serving windows, sourced menu and substitutions; special meals; archive as data permits.
- **Occupancy:** show “demo check-ins” or “sample estimate,” *not actual seats occupied*, unless verified data source exists; display calculation and last update. Optional check-in/check-out buttons affect only demo participation count.
- **Fees:** due date/amount only when provided; link to supplied official form URL if known; `notSubmitted / studentReportsSubmitted / awaitingVerification / verified` separation; never call student submission a confirmed payment.
- **Feedback:** rating/comment updates local sample records; avoid confidential personally identifiable complaints in shared feed.
- **Cross-effects:** menus/special meals populate calendar where enabled; due dates to calendar; user feedback and demo status persist.

### S07 — Parcels `/services/parcels` [F13]
- **Content:** mock incoming parcels addressed to currently selected demo persona; courier, received timestamp, pickup point, uncollected history; status `arrived / collected`.
- **Actions:** filter, view details; collection action must be labelled demo acknowledgement or performed through a later admin control, never implied official gate verification.
- **Cross-effects:** arrived record can create inbox notification; picked-up record clears home item.
- **Privacy:** show only selected persona's parcels in student mode; no real tracking numbers by default.

### S08 — Best Time to Go `/services/best-time` [F18]
- **Content:** service selector (mess, gym, laundry), hour/day patterns, small chart, source, sample window, uncertainty disclaimer.
- **Actions:** switch service/day; compare calm versus busy periods; click service to navigate.
- **Truth:** prototype uses clearly labelled illustrative patterns; no claim of statistically reliable prediction or actual live occupancy; don't equate service popularity with exact queue length.

### S09 — Bookings hub `/bookings`
- **Content:** resource families, next reservations, facility hours, filter by date/category; My Bookings link.
- **Actions:** select resource → date → slot → capacity availability → confirm → see booking + calendar item; cancel eligible booking.
- **Shared engine constraints:** no past bookings, no duplicate overlapping reservation for same exclusive slot, grace period/no-show policies only when specified, prevent booking closed/maintenance times, keep slot conflict feedback explicit.
- **Demo truth:** availability is calculated from seeded slots plus this prototype's reservations; not an actual campus availability feed.

### S10 — Gym `/bookings/gym` [F04]
- **Content:** example hours/closures, capacity, selected date slots, maintenance notices, source label, demo occupancy if available.
- **Actions:** reserve/cancel slot; optional demo check-in/out when feature is enabled; report equipment issue linking to complaints.
- **Fallback:** if no actual machine-level availability data, don't show precise equipment status or live gym occupancy.

### S11 — Badminton `/bookings/badminton` [F06]
- **Content:** one or more courts, weekly availability, booking policies, partner name optional.
- **Actions:** choose court and slot, confirm, add optional partners (demo only), cancel; show waitlist only if genuinely implemented.
- **Validations:** capacity/conflicts/booking limit/grace-period policy must be configured; don't silently implement automatic no-show release without reliable time/check-in data.

### S12 — Other Sports `/bookings/sports` [F07]
- **Content:** table tennis, pool and basketball resource selector; consistent slot picker and facility info.
- **Actions:** choose activity/resource/time; confirm; cancel; see booking on calendar.
- **Design:** same booking components as badminton with different resource configuration.

### S13 — Library `/bookings/library` [F08]
- **Tabs:** Study Spaces / Hours & Rules / Book Catalogue (demo or external link only if data exists).
- **Actions:** book group-study space through shared booking flow; view demo availability and reservations; search sample books only if supplied.
- **No false claim:** do not invent a live circulation system or borrowing history. If not integrated, the screen explains catalogue/return data is unavailable.

### S14 — Music Room `/bookings/music-room` [F19]
- **Content/actions:** room photos/rules if provided; schedule, occupancy/availability based on demo records, reserve/cancel; event added to calendar.
- **Edge:** potential equipment/access restrictions or venue rules displayed only if provided.

### S15 — Chill Zone `/bookings/chill-zone` [F22]
- **Content:** birthday spot cards (three only if actual names/locations are provided), booking slots around celebrations, capacity/rules marked as to-be-confirmed.
- **Actions:** select area/time, request/reserve demo slot, cancel; add birthday event to calendar if user chooses.
- **Safety/authority:** does not grant permission to hold an event or occupy restricted areas; no silent assumption about midnight access rules.

### S16 — My Bookings `/bookings/my-bookings`
- **Content:** upcoming, past, cancelled demo bookings across all resource types; status chips, date, venue, source.
- **Actions:** view details, cancel if permitted, navigate to corresponding resource.
- **Cross-effect:** cancelled booking removed/marked cancelled on calendar and resource availability restored.

### S17 — Academics hub `/academics`
- **Content:** today classes, subjects, nearest assignments, exam announcements, faculty hours, CR/SR updates; link to all academic pages.
- **Actions:** open subject, assignment, exam seating or faculty request.
- **Source:** only user-supplied timetable, provided academic files or explicitly marked seeds.

### S18 — Course Hub `/academics/courses` [F15]
- **Tabs:** My Courses / Course Details / Assignments / Resources / Group Projects.
- **Content:** per-course title, faculty, next class, deadlines, announcements, reference materials/links; status of assignments if user sets it.
- **Actions:** view course; add personal task related to course; mark own task complete; link to supplied external submission page. The prototype does not pretend to upload to Google Classroom or officially submit work.
- **Cross-effect:** sourced assignment/project deadlines appear on calendar and home; updates point to one canonical assignment record.

### S19 — Exams & Seating `/academics/exams` [F26]
- **Content:** dated exam list, subject, venue/time if provided, illustrative personalized seat/row/column; source and publication label.
- **Actions:** choose exam, see seating card, navigate to relevant calendar entry.
- **Important:** never claim that example seats are official allocations. Do not use actual student identifiers in shared demos without permission.

### S20 — Faculty Appointments `/academics/faculty` [F17]
- **Content:** opt-in/published office hours and appointment slots, not passive tracking of on-campus presence.
- **Actions:** filter professor/course; make a *demo* meeting request; see requested/accepted/rejected sample states; add confirmed demo meeting to calendar.
- **No claim:** request is not actually sent to a professor until a real channel is connected.

### S21 — Faculty Mentorship `/academics/mentorship` [F21]
- **Content:** student group/project profile, mentors directory based on consent or demo seeds, invitation form, feedback thread sample.
- **Actions:** create demo mentorship request, add project metadata, view invitation history; sample response only from controlled simulation.
- **Boundary:** not an official faculty assignment mechanism.

### S22 — Academic Announcements `/academics/announcements` [unnumbered CR/SR updates]
- **Content:** time-ordered academic notices tagged course, batch, section, owner and source, publication timestamp.
- **Actions:** filter/search, save, open source; due-date notices can link to calendar record.
- **Authority:** notices from teammates in demo mode are not automatically official institutional statements.

### S23 — Administration hub `/administration`
- **Content:** leave requests, complaints, BMS office appointments, status summary, data-mode labels.
- **Actions:** open appropriate request workflow; track demo status.

### S24 — Leave & Out-Time `/administration/leave` [F03]
- **Tabs:** New Request / My Requests / Attendance & Out-Time (informational unless real data available).
- **Content:** leave type, date range, reason, optional evidence note, missed classes, submission history, demo status, comments.
- **Actions:** validate form; submit a local demo request; edit when in draft/changes requested; withdraw; display sample approval sequence as explicit simulation.
- **Status:** `draft → submitted → underReview → changesRequested/approved/rejected`; `approved` must render as “Approved in demo” unless an authorized institutional integration exists. Gate verification is demonstrative only.
- **Privacy:** do not prefill or publicly display personal medical reasons; avoid uploading real medical certificates into a local demo.

### S25 — Complaints & Maintenance `/administration/complaints` [F12, F14]
- **Tabs:** My Tickets / Report Issue / Teaching Aids / Status & FAQ.
- **Content:** facility categories (plumbing, electricity, internet, cleanliness, classrooms), location, description, optional demo photo, ticket number, timestamps and status.
- **Actions:** submit demo issue, filter, reopen simulated resolved issue; teaching aids (projector, mic, AC, smartboard) are a *category in the same ticket engine*, not a separate backend.
- **Status:** `submitted → assigned → inProgress → resolved`, optional `awaitingParts` and `reopened`. Only a labeled simulation controller can advance staff-owned statuses.
- **Privacy:** show tickets created by active persona and non-sensitive mock examples; do not display private real complaint content to others.

### S26 — BMS Office `/administration/bms-office` [F23]
- **Content:** published office hours, services, required documents if provided, appointment slot request, contact channel if provided.
- **Actions:** pick demo meeting purpose/slot and submit request; save appointment as requested (not confirmed) until simulated/authorized acceptance.
- **Fallback:** no official availability claim if office has not supplied slots.

### S27 — Community hub `/community`
- **Content:** event highlights, clubs, lost-and-found items, sports fixtures, campus notice feed.
- **Actions:** browse and navigate; apply category filters.

### S28 — Lost & Found `/community/lost-found` [F16]
- **Tabs:** Lost / Found / My Reports.
- **Content:** anonymized photo gallery, category, date, general location, status.
- **Actions:** submit lost/found report (demo); filter, view details, request a claim, provide non-public verifying detail.
- **Match:** optional deterministic suggestion based on shared category/time/location labelled “possible match”; no proof of ownership. Completed handover is a separate verified/demo-control action.
- **Privacy/security:** do not show ID-card numbers or exact private item details; no unsupervised claim transfer.

### S29 — Clubs & Committees `/community/clubs` [F20]
- **Content:** searchable directory, mission, active recruitment period (if known), role list, public/social handles, events and office-hour style meeting requests.
- **Actions:** explore, apply filters, open public links, request demo meetup, bookmark club.
- **Boundary:** phone numbers only if intentionally publicly shared; no fabricated recruitment dates.

### S30 — Sports Fixtures & Sign-ups `/community/sports-events` [F24]
- **Tabs:** Fixtures / Find a Team / Create a Team / My Participation.
- **Content:** match dates, venues, teams and roster capacity, event status; source label.
- **Actions:** create demo team, submit join request, leave team, indicate interest, view upcoming fixtures; status changes update calendar where an event record exists.
- **Validation:** enforce team capacity, prevent joining same team twice, flag overlaps; fixture reschedules recorded as event updates; official sports-committee approval not implied.

### S31 — Campus Events `/community/events`
- **Content:** cross-cutting event listing for clubs, cultural activities, birthdays where shared, workshops, sports tournaments and campus announcements.
- **Actions:** search, filter, save to personal calendar if not already shared, open detail.
- **Deduplication:** event shown once and referenced from multiple pages.

### S32 — Time Tax Dashboard `/time-tax` [added signature feature]
- **Tabs:** Overview / Scenario Calculator / Fieldwork Data / Assumptions & Methodology.
- **Content:** modelled student-hours saved, baseline/after hypothetical values, by-service breakdown and charts, source/sample size, scenario controls, limitations.
- **Actions:** choose service, adjust population/frequency/baseline/after, inspect calculation, switch between illustrative model and observed data if uploaded; reset.
- **Core model:** `hours = students × visits_per_student_per_period × max(0, baseline_on_site_wait − scenario_on_site_wait) / 60`.
- **Integrity:** distinguish observed baseline, hypothetical post-intervention, measured post-intervention. No double count of overlapping populations when computing a campus-wide number; explain assumptions and population scope. Avoid claiming total completion-time savings when only on-site presence was reduced.
- **Cross-effect:** link from relevant service pages to corresponding scenario; the calculator does not claim every simulated order produced a measured saving.

### S33 — Notification Center `/notifications` [F25]
- **Content:** chronological inbox with categories, unread/read, linked object, preferences for noncritical alerts.
- **Actions:** filter/read/mark all read/manage category subscriptions. Locally generated notifications on user-created booking/order or changes made in final demo controls.
- **Source:** avoid sending unsourced “official” alerts; no promise of OS-level push, SMS or background reminders unless implemented.

### S34 — Settings & Demo Profile `/settings`
- **Content:** selected example student profile, academic cohort (when provided), calendar visibility defaults, theme, notification preferences, demo-data legend and reset.
- **Actions:** change mock persona, preferences, clear local demo records with confirmation. Data for one mock persona does not leak into another persona's views.
- **Future:** link to a controlled demo operations panel added at final implementation stage; separate admin permissions in that phase.

## 3. Canonical inventory — all 26 original features

**Legend:** `I` = meaningful student-side interaction in first prototype; `D` = demonstrative/seed-backed screen or action; `N` = navigable informational experience. These are *recommended*, not approved implementation commitments.

| Original ID | Group's idea | Primary destination | Proposed depth | Shared engine / important rule |
|---:|---|---|:---:|---|
| 01 | Chill Spot advance ordering | S04 | I | Order/cart states; no real fulfillment |
| 02 | Academic calendar | S02 | I | Unified calendar with imported events |
| 03 | Administration leave & out-time | S24 | I | Local request, explicit demo approval |
| 04 | Gym schedule/check-in/occupancy | S10 | D | Booking; no false live occupancy |
| 05 | SS and in-house Laundry | S05 | D/I | Tracking preview; machine booking |
| 06 | Badminton booking | S11 | I | Shared booking engine |
| 07 | Other sports—TT, pool, basketball | S12 | I | Booking engine, configurable sports |
| 08 | Library hours, spaces and catalogue | S13 | D/I | Study-space booking; no fabricated live book data |
| 09 | Mess occupancy check-in/out | S06 Occupancy | D | Demo-participant count only |
| 10 | Mess menu & updates | S06 Menu | I | Provided schedule, weekly view, feedback |
| 11 | Mess fee reminder/form link | S06 Fees | D | No verified payment without evidence |
| 12 | General complaint tracker | S25 | I | Unified ticket engine |
| 13 | Parcels/couriers | S07 | D | Mock receipt/collection statuses |
| 14 | Teaching aids maintenance | S25 Teaching Aids | I | Ticket engine with classroom category |
| 15 | Subject/course Google Classroom-style hub | S18 | D/I | Course info, links, tasks—not full LMS |
| 16 | Lost & Found | S28 | I | Reports and claim requests; no guaranteed matching |
| 17 | Professor availability/meetings | S20 | D | Published slots, not location tracking |
| 18 | Best Time to Go forecast | S08 | D | Illustrative trends until measurements exist |
| 19 | Music room booking | S14 | I | Shared booking engine |
| 20 | Clubs/committees meeting and directory | S29 | D/I | Public directory and demo request |
| 21 | Faculty mentorship group invitations | S21 | D | Demonstrative invitations, not live delivery |
| 22 | Chill Zone birthday spots | S15 | I | Shared booking, rules subject to confirmation |
| 23 | BMS Office meeting | S26 | D | Example appointment request |
| 24 | Sports fixtures/team signup | S30 | I | Teams, join request, fixtures → calendar |
| 25 | Notification preferences center | S33 | I | In-app inbox and preferences |
| 26 | Personalized exam seating notifications | S19 + S33 | D | Clearly illustrative until official data supplied |

**Also preserved from unnumbered group notes:** unexpected meetings (calendar), admin input (data source to be defined), CR/SR weekly updates (S22), campus clubs/academic announcements (S22/S31), fixed schedules (S02), optional CR classroom booking (S09 `/bookings/classrooms`), leaves and attendance counter (S24), and SS laundry arrival/delay notifications (S05/S33).

## 4. Shared information architecture: one record, many representations

| Canonical entity | Primary editor in prototype | Surfaces reading it |
|---|---|---|
| CalendarEvent | User personal entry / imported dataset | Calendar, Home, Events, Academics |
| Course / Assignment | Imported academic file, user personal task | Course Hub, Calendar, Home |
| Birthday | Consented supplied data / user's own personal entry | Calendar, Home, optional Community Events |
| MessMenu | Imported supplied menu | Mess, Home, optional Calendar |
| ServiceStatus | Seed data; final-phase demo control | Service pages, Home, Notification Center |
| Booking | Student action in local prototype | Resource page, My Bookings, Calendar, Home |
| CafeOrder | Student checkout; final-phase simulation for operator stages | Chill Spot, Home, Notifications |
| LaundryRecord | Seed data; final-phase demo control | Laundry, Home, Notifications |
| Ticket | Student submission; final-phase simulation for technician stages | Complaints, Home, Notifications |
| LeaveRequest | Student submission; final-phase demo approver stages | Leave, Home, Notifications |
| Parcel | Seed data; final-phase demo control | Parcels, Home, Notifications |
| SportsTeam / Fixture | Demo user actions and provided fixture list | Sports Events, Calendar, Home |
| Notification | App events or explicit demo update | Bell, Notifications |
| TimeTaxScenario | Calculator form values | Time Tax only, optional Home excerpt |

**Source precedence rule:** don't invent a blanket “latest wins.” Keep `source`, `updatedAt`, `verificationStatus`, and change history; if two sources conflict, surface conflict instead of quietly overwriting confirmed records. The chosen demo persona is a filter, not an authenticator.

## 5. Cross-screen interaction contracts

### Journey J01: Calendar first
1. Open Home; click an upcoming class or deadline.
2. Open the same canonical event in the Calendar drawer.
3. Click course/deadline link to the underlying Academics record.
4. Changing a personal event updates both Calendar and Home; provided institutional records are read-only in student view.
5. If absent, show “No schedule provided” rather than fabricated data.

### Journey J02: Book a badminton court
1. Open Bookings → Badminton; choose date/court/time.
2. UI checks configured hours/capacity and existing demo bookings.
3. Confirm; create a `Booking` ID and display confirmation.
4. My Bookings, Calendar and Home show the same booking.
5. Cancel; slot becomes available again and corresponding surfaces update.
6. Rebooking a conflicted slot yields explicit validation error.

### Journey J03: Chill Spot order
1. Menu → add items → cart → place demo order.
2. Persist `pending` record and receipt in My Orders.
3. Do not automatically claim that the operator accepted/prepared the order.
4. In final-phase operations demo, authorized demo control changes state; student view reflects change and inbox notification appears.

### Journey J04: File a complaint
1. Administration → Complaints → category/classroom/description.
2. Submit and receive demo ticket ID.
3. My Tickets lists ticket as `submitted`.
4. In final-phase operations demo, simulated technician advances status; notification updates and detail history records transitions.
5. User reopens if simulated resolution is insufficient.

### Journey J05: SS laundry delay
1. Laundry screen shows provided/seeded pickup window and example tracking record.
2. Later demo control moves one record to `delayed`, optionally updating expected return date.
3. Student screen changes; relevant notification appears; unreliable ETA is never generated automatically.

### Journey J06: Class rescheduled
1. Supplied event appears in calendar and on Home.
2. Later demo control edits the event time and adds a “Changed in demo” indicator.
3. Old event instance is superseded (not duplicated); affected audience demo notification links to revised record.
4. The UI preserves previous value in a change history for demonstration.

### Journey J07: Time Tax demonstration
1. Choose “Chill Spot” or “Laundry” scenario.
2. Provide population, visits/week, before/after on-site wait assumptions.
3. Show modelled hours saved with formula, confidence and labels.
4. Switch to uploaded baseline observations if available; do not silently imply hypothetical outcomes are measured.

## 6. Interaction conventions and universal states

### 6.1 Navigation & buttons
- Every visible button has a defined action: navigate, mutate valid local state, open modal, download generated artifact, or explicitly show an unavailable/informational state.
- No dead buttons, fake payment confirmations, pretend email sends, or calls to nonexistent APIs.
- Internal navigation retains scroll and filters when useful; browser Back works.
- User actions have undo/cancel where feasible; destructive resets require confirmation.

### 6.2 Required states per screen
- Populated: readable records, source and status.
- Empty: clear explanation and next action.
- Loading: only when async work actually exists; don't show perpetual spinners.
- Error: actionable message with safe recovery.
- Stale/unknown: visible reliability warning where relevant.
- Demo: obvious but unobtrusive badge. No “live now” wording on seed data.

### 6.3 Forms and validation
- Required fields labelled; date/time and quantity validated; character lengths reasonable; keyboard and screen-reader support.
- Show validation near the field, preserve typed content after failure, disable rapid duplicate submission.
- Don't collect actual sensitive student information in a shared demo unless justified and protected; use synthetic identities and placeholders.

### 6.4 Notification rules
- Local in-app notifications can fire from app actions and controlled demonstrations; user choices persist.
- Notifications deep-link to records and do not claim push/SMS/email delivery without it.
- Calendar reminders require an explicitly implemented scheduling mechanism; otherwise show upcoming items and provide demo-triggered alerts.

## 7. Visual design system — hybrid professional/student

### 7.1 Personality
- Professional productivity structure + welcoming, student-centered details.
- Calm and uncluttered, but not sterile; clear data hierarchy over decorative flourish.
- Prefer polished typographic rhythm, thoughtfully coloured event categories, warm neutral surfaces and subtle interaction feedback.

### 7.2 Proposed foundational tokens (subject to accessibility review)
- Background warm paper `#F7F5F0`.
- Text deep ink `#192B34`.
- Main accent teal `#317C72`.
- Secondary accent terracotta `#D58A65`.
- Supporting mist `#E9EDF3`.
- Use functional accessible status colours distinctly from branding; text+icon labels must accompany colour.
- Type: contemporary neutral sans for interface (e.g., Inter or similar system-safe fallback); restrained display treatment only in greetings/major headings.
- Radius: 10–16 px for panels; compact controls; consistent spacing system based on 4/8 px increments.
- Shadows only where they establish elevation; avoid glossy neon gradients and excessive glassmorphism.

### 7.3 Page patterns
- **Home:** greeting + daily briefing, deadlines, actionable shortcut cards, upcoming service status, Time Tax highlight.
- **Calendar:** wide calendar canvas with compact filter rail; event drawer on desktop, bottom sheet on mobile.
- **Service:** hero with one primary CTA, important status, tabs/cards, upcoming activity.
- **Resource booking:** date/time selector + availability grid + right-side confirmation summary.
- **Directory:** search and filter row + responsive cards + detail drawer.
- **Ticket workflow:** clear step form + status timeline + history.
- **Analytics:** KPI row + clearly labelled model inputs + chart + formula/methodology.

### 7.4 Responsive & accessibility
- Desktop sidebar, tablet collapsed rail, mobile bottom navigation.
- Interactive elements have visible focus and 44px-class touch targets where practicable.
- Sufficient contrast, text alternatives, reduced-motion respect, clear validation and non-colour-only status indicators.
- Honor screen reader semantics, aria labels for icons, and keyboard navigation to dialogs and date selection.

## 8. Data files to request from the user

| Data | Preferred original input | Fields needed | Handling |
|---|---|---|---|
| Academic timetable | PDF, spreadsheet or screenshots | Course, weekday, time, room, group/section, date range | Recurrences + exceptions |
| Academic calendar | PDF, spreadsheet | Holidays, exams, official dates | Preserve source and uncertainty |
| Assignments/projects/homework | Any structured list or docs | Title, course, deadline, tentative/confirmed, details | Canonical task/deadline |
| Birthdays | Consented CSV/list | Display name, day/month, visibility | Year optional; default private |
| Mess schedule/menu | Weekly chart or PDF | Day, meal, time window, item, substitution | Distinguish meal service hours from special events |
| Events/clubs | List or announcements | Event title, date, time, venue, organizer, audience | Dedupe across sources |
| Facilities & bookings | Hours/locations/resource list | Resource, slots, capacity, closures, rules | Don't invent rules |
| Time Tax fieldwork | Observation sheet | Service, observed duration, timestamp, sample count, method | Separate observations from simulations |

## 9. Feature acceptance gates before implementation

**Design ready** only when: route exists in IA, primary and secondary actions are specified, data mode is clear, read/write ownership is defined, empty/error states are described, and at least one acceptance test is written.

**Functional ready** only when: feature uses seeded/imported/user-created records correctly; no impossible status transitions; relevant cross-screen sync; persistence after reload where expected; accessible form/interaction; test pass and limitation documented.

**Prototype ready** only when: all 26 numbered features have reachable destinations; flagship flows J01–J07 demonstrable; no dead CTAs; no mock “official/live” claims; calendar data provenance visible; Time Tax distinguishes illustrative from measured outcomes; demo resets repeatably.

## 10. Deferred final-phase demo backend — requirements reservation ONLY

**Do not build now.** Keep a separable data-access layer with repository/service interfaces (not direct hard-coded cross-component arrays everywhere) so the UI can later swap in a simple backend.

Desired *eventual* demonstration: two browser windows, one student-facing and one authenticated demo-operations window. A controlled update (e.g., Chill Spot order becomes ready, laundry delayed, class time changed, complaint resolved) persists server-side and propagates to the student view. Show timestamps, source = “Demo operator,” and an explicit DEMO indicator. Role-based separation and access rules must be real in the demo backend, rather than a cosmetically hidden route. Technology choice and implementation details intentionally deferred.

## 11. Open decisions, deliberately not invented

| Decision | Current state |
|---|---|
| Official campus name/identity, permitted logo | Unknown |
| Exact student persona, course/semester and sections | Awaiting supplied data |
| Academic timetable and dates | Awaiting supplied files |
| Birthday list and display consent | Awaiting supplied data |
| Mess weekly menus and payment instructions | Awaiting supplied data |
| What “CR booking” means in practice and rules | Needs team clarification; informational optional route reserved |
| Number of actual courts, gym capacity, machine count | Unknown, seeded mock values must be marked |
| Approval rules for leave and gate out-times | Not officially established; demo only |
| Whether browser storage vs local lightweight DB for initial persistence | Proposed browser storage; confirm during technical design |
| Exact first three fully showcased end-to-end journeys | Proposed calendar, booking, Chill Spot; to approve |
| Demo-backend framework, authentication and hosting | Explicitly deferred to final phase |

## 12. Proposed implementation order (not the detailed engineering plan)
1. Specification approval, exact screen inventory, source-data plan and demo personas.
2. Hybrid visual design system and shared navigation shell.
3. Canonical data contracts, seed data, local persistence and calendar import validation.
4. Unified Calendar and Home daily briefing.
5. Resource booking workflow and shared state propagation.
6. Chill Spot order workflow; laundry/mess/service views.
7. Academics, administration and community screens with honest demo scope.
8. Notifications and Time Tax model, accessibility and journey tests.
9. Only **after** core prototype is stable: small demo backend and controlled operator console demonstrating cross-client updates.
10. Final regression tests, presentation walkthrough, limitations and reproducible reset.

---

**Specification boundary:** This file defines proposed UX and interaction contracts, not code, a final data schema or institutional authorization. Real records take precedence over seed content only after mapping and user review. Any unresolved rule must be explicitly flagged rather than supplied by Claude Code as an assumption.
