# CampusOS — Student Community: Lost & Found, Clubs & Committees, Sports Fixtures & Teams

**Specification ID:** `COS-COMMUNITY-001`  
**Version:** `1.0 — scope and architecture baseline; scheduled for V2 deepening`  
**Original group brainstorm coverage:** `F16` Lost & Found; `F20` Clubs & Committees / member meetings; `F24` Intra-college sports fixtures and team sign-ups.  
**Related scope:** Calendar `F02`, Home, Notifications `F25`, Sports & Fitness `F04/F06/F07`, Faculty/BMS appointments `F17/F23`, Time Tax analytics.  
**Status:** **PROPOSED specification**. Original user feature intentions are source-grounded; the behaviors, schemas, policies and UI choices suggested here are not automatically user-approved.  
**Prototype constraint:** Local-first, profile-scoped, explicitly labelled demo records and actions. No actual club outreach, institutionally approved fixture, external notification, shared campus directory, official claim adjudication or live backend until specifically authorized.  
**Future phase:** Final backend may support cross-client update demonstration after student UX and all local workflows are tested; this file does not authorize implementing the backend now.

> **Read this before implementing.** This is a **V1 coverage contract**, NOT a final richness/design freeze. Continue building only when its phase is approved. A separate V2 exercise will deepen each of the three features independently, exploring user research, interaction design, interface states, privacy, failure modes and operational realism. Do not interpret any unexplored corner as permission to invent behavior.

## 0. Original source boundary

The group's brainstorm describes: (a) a searchable, photo-based Lost & Found gallery with Lost/Found reports, locations/dates/categories, ownership verification questions, possible automatic matches and removal from public view following handover; (b) a directory of clubs and committees, what each does, members and roles, public social-media details, recruitment status, and a way to request a conversation or appointment; (c) sports fixtures, joining or creating teams across year groups, captain roles, roster capacity, looking-for-players requests, sports-committee approval and match postponement/cancellation notices. These are the source-derived requirements. The source **does not** supply actual clubs, membership/contact permissions, real student identifiers, event schedules, official game rules, authorized staff identities, sports committee procedures, facilities, claim-dispute policy or integration credentials. All such records must be supplied, demonstrably authorized or labelled demo.

## 1. Product purpose, core principles and non-goals

**Product promise:** Make campus community opportunities easier to discover, coordinate and participate in, without compromising privacy or implying unverified institutional authority. The Time Tax benefit is potentially reduced time spent asking around for contacts, locating lost belongings, or coordinating teams and match changes; evidence must distinguish estimates from observation.

### 1.1 Shared design and technical principles

1. Reuse the **CampusOS hybrid professional × student-life design system**: warm neutral surfaces, compact but readable typography, teal primary actions, selective category colour, friendly visuals, robust responsive layouts.
2. Keep a unified `/community` landing page with three feature destinations and a small relevant-events area. Don't create a social network or generic infinite feed.
3. Reuse canonical Calendar records for club events and sports fixtures; reference IDs from Community rather than copying event objects. Home Campus Pulse is a projection of publicly shareable Community records.
4. Reuse existing appointment/request primitives for club-member contact requests where reasonable; do not conflate requests for club meetings with official faculty appointments.
5. Use local demo-profile access boundaries. A simulated student can manage **only their own reports, teams, membership requests and preferences**, except visible Settings-gated Demo Operations controls.
6. Each record has stable ID, `dataMode`, visibility/audience, record owner, created/updated timestamps, and optional provenance/source. `demoSeed`, `userCreated`, `provided`, and `simulated` are distinct from whether a record is verified.
7. No invented contacts, no automatic release of private ownership proofs, no full legal-name/phone disclosure from user-entered reports, no real institutional approval claim, no unsourced match results.
8. Every CTA has a real route/side effect, a documented disabled state or an explicit *demo-only* label. Persist supported changes and offer a deterministic Reset Demo.
9. Validate all inputs; protect user-entered free text from injection/XSS; constrain images to safe local preview storage with size/type limits (do not claim malware scanning exists). Keep private metadata out of public indexes.
10. No real-world messages to actual students, club leaders or sports committee members; no real payments or direct contact integration.

### 1.2 Explicit exclusions for V1

No campus-wide public social posting, chat, direct messages, external signup forms without supplied URLs, facial recognition, location surveillance, automated transfer of ownership, real prize/bracket management, league officiating, paid event tickets, automatic cross-device synchronization, or genuine backend role authentication.

## 2. Information architecture and routes

Use the project's current routing convention. Paths are suggested canonical destinations, **not permission to duplicate existing routes**.

| Route | Screen | Core interactions |
|---|---|---|
| `/community` | Community home | Overview cards, upcoming permitted events, shortcuts, My Activity |
| `/community/lost-found` | Lost & Found | Lost/Found/My Reports tabs, search, category/date/location filters, gallery/list toggle |
| `/community/lost-found/new?type=lost\|found` | New report | Conditional form, photo preview, audience, review, save |
| `/community/lost-found/:reportId` | Report detail | Public-safe detail; owner actions; report timeline; possible matches |
| `/community/lost-found/claims/:claimId` | Claim tracking | Request ownership review, timeline, final demo disposition |
| `/community/clubs` | Clubs & Committees | Directory search/filter, recruitment highlights, categories |
| `/community/clubs/:clubId` | Club detail | Mission, sourced activities, roles (permitted), recruitment, request meetup |
| `/community/clubs/requests` | My Club Requests | Pending/responded/cancelled demo requests and history |
| `/community/sports-events` | Sports & Teams home | Fixtures, Find Team, Create Team, My Participation, Looking for Players |
| `/community/sports-events/teams/:teamId` | Team detail | Roster, captain, capacity, join request, roster status |
| `/community/sports-events/fixtures/:fixtureId` | Fixture detail | Match details, participants, venue and Calendar deep-link |
| `/community/sports-events/my-participation` | My Participation | Own team memberships/requests, fixtures, cancellations |

Global navigation remains `Community` under the existing shell. Avoid adding 12 primary sidebar items; use a second-level module navigation and contextual breadcrumbs.

## 3. F16 — Lost & Found

### 3.1 User goals and information hierarchy

**Lost report:** A student has misplaced something and wants to make it findable without exposing private identifiers.  
**Found report:** A student or demo staff member has located an item and needs a safe contact/handover path.  
**Claim:** A potential owner recognizes an item and wants to verify privately.  
**Resolution:** Authorized demo handover is acknowledged; the record is archived or marked returned.

The landing screen shows a concise heading, report CTAs, Lost/Found tabs, item search, filters and a responsive item card grid. My Reports gives access to current owner-visible draft, published, claimed or closed entries. Counts are derived from actual local records, never fabricated stats. The default sort is newest *recorded* first, not invented item discovery time.

Card fields: broad category, safe short title, generalized find/last-seen area, reported date, source mode badge, report type, safe image thumbnail or icon fallback, and current public-safe status. Hide precise room/location or serial numbers when they could enable fraudulent claims; allow the reporter to supply more specific private details held separately.

### 3.2 Report creation

**Report Lost:** Title, item category, optional safe description, approximate last-seen date/time (unknown is allowed), generalized location, optional picture, visibility and optional private identifying characteristics.  
**Report Found:** Title, category, date, generalized find location, picture, where item is held (only if safe to publish), private identification details, and whether item is in a designated demo office custody or held by the reporter.

Flow: Choose Lost/Found → enter details → preview public versus private fields → validate → create local record with a stable ID and source label → display My Report. No public message is sent. Student can update own unresolved report and close it; edits affecting matching signals should recompute candidate suggestions, not silently overwrite a prior claim record.

If no image exists, use category icon—not generated realistic photos presented as evidence. If an ID card is reported, avoid a legible photograph of personal data. Phone numbers and campus IDs are not public gallery fields.

### 3.3 Matching, claims, and ownership verification

For V1, matching is **candidate suggestion**, not owner identification. Implement deterministic scoring using broad category plus optional colour, place and date proximity; each contributing attribute must be available in the record, and the UI must label matches as `Possible match`, never `Verified owner`. Do not construct missing data. If no safe match exists, show no suggestions.

A claim request is distinct from a report: `requested → review_pending → demo_approved | demo_rejected | withdrawn` with documented reason where appropriate. The claimant provides a non-public detail only the legitimate owner is likely to know. **Do not display these answers to other users** or create a public reveal. The reporter/authorized demo operator reviews a claim through an explicitly labelled simulation control; the reporter cannot approve a claim of their own found item using the same student role without a controlled demonstration of that authorization boundary.

The found report may have multiple candidate claims; approving one must invalidate conflicting pending claims for the same item within the local data model. On handover, a separate `returned` confirmation records `handoverAt` and changes the public view to `Returned` or removes it from active search while preserving private history. This is not a real theft-prevention or legal ownership guarantee.

**Suggested V1 state model:** `draft → published → match_suggested? → claim_under_review? → returned | closed_unresolved`. `match_suggested` is better represented as derived metadata; `claim_under_review` as an association rather than an exclusive report state. Store the authoritative report lifecycle `draft/published/returned/closed` and separate `ClaimRequest` records. Conflicting report edits must not delete claim history.

### 3.4 Lost & Found screen states and edge cases

| Case | Required UI/system response |
|---|---|
| No results | Explain filters/no records and offer Report Lost/Found |
| Claimed item | Publicly mark Returned or remove from active listing; preserve report history |
| Same item reported twice | Suggest potential duplicate; do not merge without user confirmation |
| Two claimants | Separate private reviews; no simultaneous approval of incompatible claims |
| Found ID card | Redact identifying details and require private verification |
| Repeated image or unsafe upload | Client-side restrictions, reject unsupported types/oversize, no false claim of antivirus scanning |
| Item date unknown | Preserve unknown instead of inferring today's time |
| Report owner deletes account/demo profile | Follow explicit demo reset/privacy deletion path; no orphaned public personal details |
| Claim rejected | Explain result without disclosing winning claimant's private information |
| Item photo absent | Use stable category placeholder, not fabricated evidence |

### 3.5 V2 deepening reserved

Design actual photo-card gallery and safe item-detail layout; define a claim-verification decision tree and conflict appeal; determine custody handover method and identity redaction; research actual campus lost-property process; decide on suggestion confidence thresholds and whether notifications are opt-in by category/location. Do not implement speculative machine-learning matches.

## 4. F20 — Clubs & Committees

### 4.1 User goals and directory

A student should quickly answer: **What club is this? Who should I contact through a permissioned channel? When are events or recruitment happening? How do I request a conversation?**

Directory: searchable categories (club, committee, academic/social/cultural/sports if records provide classification); cards showing official or demo identity, one-line purpose, public events count and recruitment status. The source mentions roles, social handles and phone numbers, but **contact information may appear only when supplied with explicit sharing permission**. A name, role, personal phone and Instagram link must never be invented. If no authorized detail exists, show `Contact details not provided` and a demo request form.

Club detail tabs: `Overview`, `Events`, `Recruitment`, `Members & Roles` (only published fields), `Connect`. Reuse Campus Pulse and Calendar for permitted club events by reference to the same `CampusEvent` ID. Announcements can show original source or demo provider; posting one does not authorize changing the University's class timetable.

### 4.2 Recruitment states and interactions

`Not announced → Open → Closing soon (derived from supplied close date) → Closed → Archived`. `Closing soon` must not be generated without a valid deadline and agreed threshold; store raw `openDate/closeDate` as optional. For link-only recruitment, open only a provided URL. If campus club recruitment has no source/URL, show a not-provided state, not a fake application submission.

Students may bookmark/follow a club locally and select permitted announcement notifications. Following is a per-profile preference; it is not joining the club. Club membership itself is not verified in V1.

### 4.3 Request a club-member meetup

The original source asks to arrange an appointment to talk with club or committee members. Suggested workflow:

1. Open club page → `Request a conversation`.
2. Select purpose (learn about club / recruitment / event / other) and propose a preferred time if no validated availability exists; free-text topic optional.
3. Review: `This is a local demo request and has not been sent to club officers`.
4. Submit → `requested_demo`; show in My Club Requests and Home My Activity.
5. Explicit Settings-gated Demo Operations can simulate `alternative_proposed`, `accepted_demo`, `declined_demo` and `cancelled_demo`; no automatic acceptance or implied real outreach.
6. Accepted demo appointment projects a single clearly labelled Calendar event; cancelled/rescheduled requests update the same canonical reference.

Keep request engine in a shared core with faculty and BMS appointments where possible, but `actorKind=clubRepresentative` and response vocabulary must remain distinct. If no actual availability is provided, use proposed times, not a fabricated bookable calendar.

### 4.4 Privacy and integrity

Do not expose private phone numbers, real student IDs, membership rosters, unverified social links, or recruitment decisions. A closed recruitment event must not remain labelled `Apply now`. Contacts and meeting requests are private to the requesting demo profile. No in-app impersonation of a real club leader.

### 4.5 V2 deepening reserved

Design club identity/cards and discovery editorial approach; recruitment pipeline and RSVP behavior; club event publishing permissions; representative contact consent; differentiating club versus committee structures; interest-based filtering and discoverability; and how Campus Pulse highlights relevant opportunities without turning into an algorithmic social feed.

## 5. F24 — Sports Fixtures, Teams & Sign-ups

### 5.1 Goals and shared boundaries

The original source requests a student-friendly way to **join or create mixed-year teams**, look for remaining players, and follow official sports fixtures. It also mentions a sports committee that creates fixtures and approves teams. The V1 prototype may **simulate** those approvals but must not present them as real.

Unlike Sports & Fitness, which books physical courts/equipment, this module manages **teams, roster interest, fixture participation and event updates**. Both modules may refer to the same facility resource, but team registration does not create a court booking automatically.

### 5.2 Screens

- **Fixtures:** Calendar/list grouped by sport and upcoming/past, with sourced/demo status, date/time when supplied, venue, participating teams, result if provided, and Calendar deep-link.
- **Find a Team:** Cards show sport, team name, captain label (demo where needed), available roster positions, eligibility/year constraints only if defined, and Request to Join.
- **Create Team:** Enter sport, name, maximum roster capacity, optional description, captain (current demo profile by default), and whether to open recruitment. No automatically approved participation in an official tournament.
- **Looking for Players:** A time-bound team need linked to an actual team and optional fixture; positions needed, deadline if known, eligible users and closing status.
- **My Participation:** My created teams, join requests, approved demo membership, pending roster actions and linked fixtures.

### 5.3 Team roster lifecycle

Suggested `Team` states: `draft → recruiting → roster_closed → submitted_for_demo_approval → approved_demo | declined_demo | withdrawn`. Distinguish the two processes:

**Roster request:** `requested → accepted_by_captain | rejected_by_captain | withdrawn`. Accept requires available capacity and no duplicate accepted membership in the same team; captain acts through a Settings-gated demo actor switch or a clearly controlled locally authorized captain identity.

**Event entry approval:** Even if the captain accepts a student, the team is **not necessarily sports-committee approved**. `approved_demo` is a distinct simulated event-entry status. Do not conflate membership acceptance with official competition eligibility.

Multiple students may request the last slot in the prototype; acceptance must revalidate capacity at transition time. The initial local repository can ensure consistency within one browser/profile data store; do not claim multi-browser concurrency correctness.

Rules about maximum players, age/year groups, multiple teams per tournament and competition eligibility are **unknown** until supplied. Use configurable demo settings and label them accordingly. A junior/senior mix is explicitly welcome in the original brainstorm where eligibility permits; do not invent restrictive default rules.

### 5.4 Fixtures and match changes

Canonical `SportsFixture` includes sport, start/end times when known, venue or unknown, team references, source status, original source, status `scheduled/tentative/rescheduled/cancelled/completed_demo`, and optional result. It projects to the Calendar and Home once when visibility allows.

In a controlled demo simulator, a fixture can be rescheduled; the update must preserve the stable fixture ID, prior schedule and change history, update Calendar projection and generate **one in-app notification** to affected subscribed demo profiles. No real sports committee or team receives a message. Completed-demo results are visible only if deliberately set through a demo control; passage of time must not automatically invent a result.

**Conflicts:** Team membership doesn't automatically block student calendar time. Actual accepted fixture attendance may optionally appear on the student's personal schedule. Compare known time-specific commitments for conflict warnings, but do not auto-decline a join request due to a private calendar overlap. Venue capacity and court reservations remain owned by Sports & Fitness bookings.

### 5.5 Sports edge cases

| Case | Required behavior |
|---|---|
| Team already full | Disable new approvals; can accept waitlist interest only if configured |
| Same student requests twice | One active request per student/team; explain current request status |
| Captain cancels team | Preserve history; inform affected demo participants in-app; release only legitimately held resources |
| Looking-for-players post expires | Mark closed; do not show stale urgent CTA |
| Fixture has no venue/time | Show unknown; do not insert timed Calendar block until known |
| Match rescheduled | Update canonical fixture and related Calendar projection, no duplicates |
| Team roster count changes | Derived count must equal accepted members, not pending requests |
| Student leaves team | Capacity recalculates; affected membership/status updates consistently |
| Unauthorized user edits roster | Reject action; do not rely only on hidden buttons |
| Two teams have same name | Stable IDs disambiguate; do not use name as primary key |

### 5.6 V2 deepening reserved

Tournament formats, brackets, sports committee demo console, inviting teammates, multi-division eligibility, team captain handover, match-day emergency player search, consented roster display, scoring/result verification, waitlists and policies for no-show or withdrawal. These should be researched with the campus sports committee or explicitly labelled demo behavior rather than invented.

## 6. Shared records, ownership and selectors

Inspect the existing app before naming files, repositories or event sources. The following is a **proposed logical data model**, not approval to create a parallel data architecture.

| Entity | Core fields | Owned by / projections |
|---|---|---|
| `LostFoundReport` | id, ownerProfileId, kind, title, category, safePublicDescription, privateProofFields?, approximateDate?, generalizedLocation?, photoRef?, status, visibility, dataMode, timestamps | Community; My Reports; public-safe gallery |
| `LostFoundMatchCandidate` | id or deterministic pair, lostReportId, foundReportId, signals, generatedAt | Derived from two reports; optional in-app notification |
| `ClaimRequest` | id, reportId, claimantProfileId, privateAnswer, status, reviewerActor, decisionReason?, timestamps | Community private claim flow; My Activity |
| `Club` | id, source, displayName, type, purpose, publishedRoles?, publicContacts?, recruitmentState?, visibility | Club Directory; Campus Pulse |
| `ClubEvent` / existing `CampusEvent` | id, clubId, title, time?, venue?, sourceStatus, visibility | Canonical Calendar + Community + Home |
| `ClubMeetRequest` / shared `MeetingRequest` | id, clubId, requesterId, purpose, proposedTime?, status, history, dataMode | Requests; Home My Activity; Calendar only when confirmed demo |
| `SportsTeam` | id, sportId, name, captainProfileId, maxRoster?, status, participants, approvalState, dataMode | Community team cards and participation |
| `TeamJoinRequest` | id, teamId, profileId, status, createdAt, decidedAt? | Team queue, My Participation |
| `PlayerNeed` | id, teamId, fixtureId?, description, positionsNeeded?, expiresAt?, status | Looking for Players |
| `SportsFixture` | id, sportId, teamIds, scheduledTime?, venue?, status, result?, source, revisions | Community + canonical Calendar + Home |
| `Notification` | existing canonical record with source feature, transition ID, recipient, in-app status | Notification Center; deep-links |

**Cross-module invariants:**

- A Community event is displayed once through a **reference** to its canonical Calendar event ID; no duplicate copied fixtures.
- A sports team is **not** a booked court, a followed club is **not** a member, a pending claim is **not** proof of ownership, and a request to speak with a member is **not** a confirmed meeting.
- Record IDs and data provenance survive edits; rejected actions preserve previous state and display actionable errors.
- Source content remains read-only unless the current demo profile owns it or an explicit demo operation authorizes the specific mutation.
- Deleting or resetting a personal record must not delete institution-provided fixtures or another profile's private information.

## 7. Design system and interactions

Design should feel like **CampusOS**, but Community may use slightly more imagery and inviting typography than Administration. Use common navigation, typography, button styles, focus rings, responsive spacing and status badges. Good interaction patterns:

1. **Community home:** Three strong category entry cards, a concise next-events list and an `My activity` digest. No blank endless feed.
2. **Lost & Found:** Photo/list switch; accessible card labels; visible distinction between report and verified claim; safe public/private preview in create form; claim drawer on detail page; explicit after-handover archive.
3. **Club Directory:** Search, filter, distinct identity per club, sourced event/recruitment state; connect CTA opens a scoped request modal; never open non-existent social links.
4. **Sports:** Tabs for fixtures/team discovery/team creation/participation; status chips; capacity count; captain actions only where permitted; match details drawer with source/changed-date history.
5. **Mobile:** Route-level tabs become horizontal scrollable tabs or a section menu; cards stack; detail drawers become sheets; sticky primary actions only when they have real behavior.
6. **Accessibility:** Keyboard reachable controls, descriptive button text, accessible images, clear error text, reduced-motion support, no colour-only status cues.
7. **Empty/loading/error states:** Sources missing, no records, filtered results empty, unsupported upload, stale fixture dates, rejected request, missing permissions and failed persistence each have clear messages and sensible recovery.

## 8. Notifications, Home, Calendar and Time Tax

| Event | In-app projection | Important boundary |
|---|---|---|
| Possible lost/found match detected | Notification to relevant opted-in report owners | Candidate, not proof of ownership; do not expose private proof fields |
| Claim requested / demo decision | Notification to permitted affected profile | Local demo process, no actual gate/security adjudication |
| Club event published/changed | Campus Pulse + Calendar + subscribed notification | Source visibility and status preserved |
| Club meeting demo accepted | Home My Activity + personal Calendar item | Clearly `DEMO accepted` |
| Join request accepted/rejected | My Participation + Notifications | Accepted roster ≠ official sports-event approval |
| Fixture rescheduled/cancelled | One canonical Calendar event updated and one scoped notification | Do not invent organizer action or actual external delivery |
| Looking-for-players posting | Community feed / optional subscribed notification | Must have known team; avoid public pressure or personal-data leakage |

**Time Tax research hooks:**

- Lost & Found: time spent searching, posting and arranging handover; item-return rates can be reported only from sample/real records with disclosed denominator.
- Clubs: effort needed to identify the right representative and arrange a meeting (search/contact cycles, response time).
- Sports: coordination time spent recruiting players and finding updated fixtures; distinguish time saved by the *information workflow* from duration of the match.

Do not calculate observed savings from fictional records. Use `demo scenario` for any illustrative before/after comparison. Time Tax calculations should reuse the canonical model and evidence labels established earlier, not introduce a new competing totals system.

## 9. Proposed implementation phases (only when authorized)

- **CO-0 — Discovery & compatibility:** Inspect existing Home/Calendar/booking/appointments repositories, route conventions, preferences and notifications. Map dependencies; report conflicts; no coding before approval.
- **CO-1 — Community shell & records:** Route hierarchy, design system extensions, typed local data, source/visibility and personal data boundaries, deterministic fixtures.
- **CO-2 — Lost & Found:** Reporting, filtering, gallery, private claims and conservative deterministic candidate suggestions with accessible fallbacks.
- **CO-3 — Clubs:** Source-aware directory, detailed club view, recruitment, request conversation with simulated response, shared Calendar events.
- **CO-4 — Sports:** Team creation, join requests/captain decisions, roster capacity, fixture list and reschedule simulator.
- **CO-5 — Integration & verification:** Home/Calendar/Notifications/Time Tax projections, responsive/keyboard/contrast testing, demo reset, error paths and evidence report.
- **Final backend phase:** If later approved, add a small cross-client authorized demo change workflow, reusing existing repository interfaces. Do not implement now.

Don't begin CO-3 automatically when CO-2 tests pass; follow the project phase approval gates. No spec is complete merely because a card renders.

## 10. Acceptance tests — proposed, not executed

### F16 Lost & Found (`CO-AT-01`–`CO-AT-13`)

1. **CO-AT-01:** Lost/Found/My Reports tabs show only appropriate source- and visibility-scoped records.
2. **CO-AT-02:** Search and category/date/location filters work together; reset restores unfiltered content.
3. **CO-AT-03:** Creating a lost report validates required fields and saves after refresh.
4. **CO-AT-04:** Creating a found report retains privately entered proof details outside public cards.
5. **CO-AT-05:** Unsupported/oversize photo upload is rejected without losing the draft.
6. **CO-AT-06:** Missing photos use safe placeholders, not invented item evidence.
7. **CO-AT-07:** Deterministic possible-match suggestion never says `verified owner`.
8. **CO-AT-08:** Claim requires non-public identifying response and creates private status history.
9. **CO-AT-09:** Unauthorized profile cannot access another profile's claim proof fields.
10. **CO-AT-10:** Two competing claims cannot both close the same found report as returned.
11. **CO-AT-11:** Return/handover archives item from active listing without erasing owner history.
12. **CO-AT-12:** Duplicate report suggestions do not auto-merge or overwrite user data.
13. **CO-AT-13:** Empty and permission-denied states explain their reason and recovery.

### F20 Clubs (`CO-AT-14`–`CO-AT-24`)

14. **CO-AT-14:** Directory categorization/search resolves only supplied or labelled demo clubs.
15. **CO-AT-15:** Unsourced/unauthorized personal contact details never appear in cards or search.
16. **CO-AT-16:** Club details show description, published roles and recruitment only when available.
17. **CO-AT-17:** Following a club changes per-profile preference without inventing membership.
18. **CO-AT-18:** Missing signup link shows an honest unavailable state, not a fake apply success.
19. **CO-AT-19:** Meeting request remains pending until explicit demo actor response.
20. **CO-AT-20:** Accepted demo meeting projects exactly one appropriately labelled Calendar event.
21. **CO-AT-21:** Club events appear consistently in Community, Calendar and Home where permitted.
22. **CO-AT-22:** Cancelled or rescheduled club events update the same ID and link correctly.
23. **CO-AT-23:** Recruitment close dates do not silently invent exact closing times.
24. **CO-AT-24:** Mobile and keyboard flow supports navigation, filters and meeting requests.

### F24 Sports (`CO-AT-25`–`CO-AT-39`)

25. **CO-AT-25:** Create Team validates sport/name/capacity and persists with stable ID.
26. **CO-AT-26:** Two teams with same display name remain distinguishable by ID.
27. **CO-AT-27:** Student can request to join a team once; duplicates do not create multiple active requests.
28. **CO-AT-28:** Captain/demo acceptance revalidates capacity at transition time.
29. **CO-AT-29:** Roster count derives from accepted members, not pending requests.
30. **CO-AT-30:** Withdrawn/rejected join requests don't remain on the accepted roster.
31. **CO-AT-31:** A team member is not automatically sports-committee approved for a fixture.
32. **CO-AT-32:** Looking-for-players cards close on an explicit configured expiration.
33. **CO-AT-33:** Fixture without verified time/venue shows unknown rather than a fabricated detail.
34. **CO-AT-34:** Rescheduling updates one canonical fixture and one corresponding Calendar projection.
35. **CO-AT-35:** Cancellation notifies only relevant opted-in demo profiles once.
36. **CO-AT-36:** Match status does not auto-progress to completed on time passage alone.
37. **CO-AT-37:** Unauthorized edits or captain impersonation are rejected by domain logic.
38. **CO-AT-38:** Team participation does not automatically reserve a sports facility.
39. **CO-AT-39:** Filtering by sport/date/team retains correct linked fixture results.

### Cross-cutting (`CO-AT-40`–`CO-AT-45`)

40. **CO-AT-40:** All student-created records survive refresh and remain properly demo-profile scoped.
41. **CO-AT-41:** Home My Activity deep-links to correct claim, club request or team request.
42. **CO-AT-42:** No module claims external messaging, real committee approval or live synchronization.
43. **CO-AT-43:** Reset Demo returns to deterministic seed state without deleting immutable provided source records.
44. **CO-AT-44:** At supported desktop/mobile widths, visual overflow, empty states and keyboard focus are checked.
45. **CO-AT-45:** Test evidence records actual commands and results, including untested manual visual/real-device checks as incomplete.

## 11. Open questions and V2 enrichment backlog (do not invent answers)

**Lost & Found:** Actual office/gate custody process? Photos allowed? How are owner claims verified and disputed? Should private approximate location and sensitive proof be encrypted/never persisted in a front-end-only prototype? Are students allowed to publish found IDs? Where is a collected item physically stored?

**Clubs:** Official club list and committee categories? Which representatives consent to appearing? Authorized recruitment links and timelines? How should interest/meeting request statuses work? Which announcements can be displayed on Home and Calendar? Are club-managed events truly separate from academic notices?

**Sports:** Sport-specific maximum rosters and substitutions? Captain handover? Fixture creation authority? Real tournament formats? Official eligibility for mixed-year teams? Match rescheduling and team approval policy? Emergency last-minute players? Should teams be public or group-private?

**Cross-cutting:** Demo profile role switch policy; safe user photos; data retention; mobile information density; future backend authorization boundaries; measurement of actual coordination-time reduction.

A **V2 deep-dive must revisit all three modules individually**, with screen-by-screen annotated wireframes, error states, detailed journey narratives, usability assumptions, privacy/audit treatment and negative acceptance tests. This V1 only defines credible scope and interoperability.

## 12. Claude Code integration instructions

1. Save this as `docs/features/CampusOS_Community_Spec_v1.0.md`.
2. Register `COS-COMMUNITY-001` for **F16, F20, F24** in `docs/FEATURE_REGISTRY.md` as **specified / proposed baseline / pending V2 deepening** (not automatically approved to implement).
3. Add a `docs/DECISIONS.md` entry that **bundling is for coverage only; individual feature V2 richness remains outstanding**. Preserve source-derived requirements and proposed defaults separately.
4. Inspect current route, Calendar, app shell, booking, appointment and notification APIs. List reuses and any conflicts; don't create parallel state stores or duplicate domain components.
5. **Do not implement or change current approved phases** without a separate explicit instruction. Do not build cross-client backend now.
6. When implementation is approved, present CO-0 phase first, then implement CO-1–CO-5 with tests and stop gates.

---

*End — COS-COMMUNITY-001 v1.0 baseline, awaiting V2 depth workshop and explicit phase approval.*
