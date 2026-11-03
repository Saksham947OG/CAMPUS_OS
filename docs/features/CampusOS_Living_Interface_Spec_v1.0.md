# CampusOS — Living Interface Design & Motion Master Specification

**Prepared for Saksham and the CampusOS / Introduction to Business Operations team**  
**Version:** 1.0 · **Date:** 3 November 2026 · **User timezone:** Asia/Kolkata  
**Live product:** https://campusos-one-mu.vercel.app/  
**Purpose:** A personalised design and implementation handoff for making the existing CampusOS more distinctive, floating, reactive, graphic and enjoyable to use.  
**Status:** Proposed redesign. This document does not claim implementation, backend connectivity, live campus telemetry or verified outcomes.

---

## 1. The design decision

Make CampusOS feel like a living campus desk: warm materials, elevated navigation, tactile objects, connected motion and recognisable campus graphics. Preserve its academic usefulness and professional-and-student character. Give people moments of delight as they move between studying, collaborating, booking facilities and navigating campus life.

The requested floating and hovering behaviour is a core part of this direction. Distribute it across navigation, preview panels, tickets, contextual controls, graphics and transitions. Give each surface a defined resting state, response and purpose.

**The signature combination:**

1. A floating, personalised campus sidebar.
2. A day timeline that visibly connects classes, tasks and reservations.
3. A small illustrated campus that responds to time and selected services.
4. Tactile booking tickets and linked note previews.
5. A spacious collaborative Workspace with floating tools.
6. A Time Tax experience where changes in waiting become understandable visual changes.

These six elements should make CampusOS recognisable even with its name hidden.

## 2. Grounding in the actual product

### 2.1 Observed interface

The Home page was inspected in the live browser on 3 November 2026 during this design discussion. It showed warm cream surfaces, teal accents, a serif greeting, a white left sidebar and a dense collection of bordered panels. The sidebar exposed Home, Calendar, Campus Services, Bookings, Academics, Administration, Community and Time Tax.

Home included a simulated campus occupancy strip, schedule, Up next, deadlines, quick actions, activity, mess preview, personal tasks, free-time gaps and a source-based Time Tax summary. Search, notifications, persona selection, settings and Campus AI were also visible. These observations establish the redesign starting point; deeper service pages and completed booking workflows were not audited in this session.

### 2.2 Why the current composition feels generic

| Observed pattern | Design consequence | Proposed change |
|---|---|---|
| Similar rounded panels throughout | Different activities look interchangeable | Use timelines, tickets, canvases, maps and editorial rows |
| Equal-weight sidebar rows | Daily actions and occasional administration compete | Introduce clear groups, pins and a contextual footer |
| Cards containing more bordered rows | Excess framing reduces hierarchy | Remove unnecessary inner borders; use spacing and subtle tonal grouping |
| Minimal campus-specific imagery | The product could belong to almost any dashboard | Build an original campus illustration and photography system |
| Long explanatory copy near routine actions | Important actions become harder to scan | Keep concise source/status labels; put detailed explanations in accessible disclosures |
| Simulated counts appear in a prominent strip | Activity consumes space before the student's priorities | Integrate compact activity into the campus scene or expandable status control |

### 2.3 Existing decisions to carry forward

- Work on the existing deployment and application; preserve existing functionality and routes.
- Retain all original feature coverage, including the existing 26-feature scope and booking additions. This document changes presentation and behaviour; it does not redefine that inventory.
- Keep the cream, deep ink, teal and restrained terracotta foundation.
- Workspace is a dedicated destination near Academics, with contextual links throughout the OS.
- Calendar brings together classes, exams, deadlines, meals, events and personal activities from available sources.
- Workspace records and tasks have canonical identities across embedded views.
- Time Tax distinguishes measured observations, estimates, planning targets and simulations.
- This is a functional academic prototype. Decorative motion cannot stand in for shared persistence or real operational integrations.

**Companion read:** CampusOS_Collaborative_Workspace_Master_Spec.md, version 1.0, read for this handoff. Its editor, shared spaces, permissions, calendar coordination and saving requirements remain applicable.

## 3. Design principles

### 3.1 Depth has meaning

The page is the stable base. Navigation floats above it. A preview belongs to its trigger. A modal temporarily takes priority. A dragged ticket is visibly lifted. This hierarchy should remain consistent across every module.

### 3.2 Motion connects cause and effect

A reservation becomes a ticket, then appears in the day timeline. A completed task settles into its completed state. A selected campus building reveals its related service. Use animation to explain where information went and what changed.

### 3.3 Campus specificity supplies personality

Use the actual project context: lectures, shared assignments, mess timings, laundry, printing, parcels, facilities, clubs and waiting. Commission or create an illustration family around those objects. Replace placeholder scenes with real campus landmarks when supplied.

### 3.4 Stable targets, responsive surfaces

Buttons, reading text and form fields remain predictable to point at. They can gain depth or respond to a press. Decorative objects may gently float; controls should remain easy to hit.

### 3.5 Honest activity

Animate real state changes when connected. Label illustrative and simulated states. Never generate fake collaborators, fake occupancy changes or fake savings to make the interface feel alive.

## 4. Visual foundation

The following tokens are proposed starting values, not sampled existing CSS or accessibility certification. Validate rendered combinations before release.

| Token | Starting value | Role |
|---|---|---|
| Canvas | `#F6F4EE` | Warm app background |
| Surface | `#FFFEFB` | Main content and readable panels |
| Ink | `#202C30` | Main text |
| Secondary ink | `#52615F` | Supporting labels |
| Teal | `#246E65` | Primary action and active state |
| Teal wash | `#E0ECE6` | Gentle selection and grouping |
| Terracotta | `#A95138` | Restrained secondary accent |
| Blue | `#456C8A` | Selected academic graphics |
| Yellow wash | `#F3E6B8` | Warm illustrative accent |
| Divider | `#D8DDD7` | Quiet separation |

- Use one editorial serif for greetings and major section titles, and one readable sans serif for functional UI. Reuse installed/licensed fonts where suitable.
- Allow large editorial titles on Home and Community; use compact headings inside productive tools.
- Adopt a consistent spacing scale: 4, 8, 12, 16, 24, 32 and 48 px.
- Start with 10–12 px radii for controls, 16–20 px for panels, and 22–26 px for the floating navigation shell. Reserve pills for compact statuses and segmented controls.
- Use soft ambient shadows plus a restrained edge shadow. Avoid a heavy shadow on every row.
- Keep grain or paper texture extremely faint and confined to illustration/background areas.
- Pair muted colour accents with explicit text or icons. Colour alone must not convey status.

### 4.1 Material hierarchy

| Layer | Treatment | CampusOS examples |
|---|---|---|
| Base | Solid warm canvas | Page background |
| Content | Mostly solid, lightly separated | Notes, timelines, service information |
| Elevated | Defined edge, soft shadow | Interactive ticket, draggable item |
| Floating navigation | Tinted translucent surface with readable fallback | Sidebar, bottom navigation, command bar |
| Context overlay | Opaque or nearly opaque surface | Note preview, date picker, action menu |
| Modal | Clear scrim and focused surface | Booking confirmation or substantial form |

Use glass selectively. Background blur should support orientation while foreground labels remain legible. Provide a solid fallback when blur is unsupported, expensive or visually unsuitable. [R1–R2]

## 5. Floating and hovering behaviour system

### 5.1 Four forms of floating

| Form | Meaning | Typical behaviour |
|---|---|---|
| Spatial elevation | A surface appears above the canvas | Inset sidebar, floating toolbar, booking ticket |
| Hover response | A pointer makes an object respond | 2–4 px lift, stronger edge, contextual actions |
| Context preview | Related content appears beside a trigger | Note, event or booking preview |
| Ambient float | A decorative object moves gently over time | A paper plane or cloud inside the campus scene |

Use all four across the product. They should share a visual language without making every element move continuously.

### 5.2 Shared interaction contract

| State | Visual/behaviour contract |
|---|---|
| Rest | Clear shape, readable content, identifiable action |
| Hover | Subtle lift or surface change; optional supporting action reveal |
| Keyboard focus | Strong visible focus indicator; equivalent preview/action access |
| Press | Brief compression or depth reduction; no target displacement |
| Selected | Persistent highlight distinct from temporary hover |
| Pending | Show actual work in progress; prevent accidental duplicate submissions |
| Success | Confirmation after persistence succeeds; update related records |
| Error | Contextual explanation, retained input and recovery action |
| Disabled | Explain why when relevant; suppress misleading press feedback |

### 5.3 Hover and preview rules

- Start simple hover feedback immediately. Use a proposed 300–450 ms intent delay for rich previews; tune after testing.
- A preview must remain open while the pointer moves into it, and be dismissible where required. Escape closes it without moving the pointer. [R9]
- Preview on focus or explicit action; never require mouse hover for essential information.
- On touch, use a visible preview/details action or a tap-open sheet. A normal tap must have a consistent meaning.
- Keep menus within the viewport; flip or shift anchored panels near edges. [R7]
- Opening another transient preview closes the previous one. Do not scatter overlapping miniature windows across the screen.
- Rich interactive previews use suitable popover/dialog semantics. Tooltips contain brief descriptions rather than buttons and forms.
- Modal focus stays within the modal and returns to its trigger when dismissed. Nonmodal previews must not trap users unnecessarily.

### 5.4 Ambient motion budget

- Default to at most two subtle decorative loops in the visible viewport.
- Suggested float amplitude: 3–6 px; cycle: 7–12 seconds with different phases.
- Keep loops inside illustrations. Pause on interaction when movement would interfere.
- No bobbing table rows, body text, form fields or primary buttons.
- Optional pointer parallax applies only to decorative layers, with a small capped displacement.
- Pause ambient animation offscreen and when the page is hidden.
- Provide a reduced-motion state and a user setting to reduce decorative movement.

The user should encounter responsive depth throughout CampusOS, while each reading and working area remains stable.

## 6. Signature floating sidebar

### 6.1 Structure

Desktop starting dimensions: 232–248 px expanded, 68–76 px compact, approximately 12 px inset from the viewport. Use a restrained glass-like tint, rounded shell and a thin edge. Adapt these values to actual content and viewport size.

| Region | Contents |
|---|---|
| Identity | Distinctive CampusOS mark; personal/space context |
| Search | Search and command entry with shortcut hint |
| Your day | Home, Calendar, Bookings |
| Study & collaborate | Academics, Workspace |
| Campus life | Campus Services, Community, Administration |
| Pins | User-selected course, project, service or club shortcuts |
| Footer | Time Tax link, optional Next up capsule, profile/settings and collapse control |

All current destinations remain discoverable. At shorter heights, the middle section scrolls while the shell controls remain reachable. Avoid redundant global controls in both sidebar and header.

### 6.2 Distinctive details

- A shared selection highlight slides between active rows in 180–240 ms.
- Icons respond once on hover/selection: calendar tab shifts, bookmark flexes, ticket edge lifts. Keep the icon silhouette recognisable.
- Pins can be reordered deliberately. Provide keyboard move controls and reset.
- Badges reflect genuine pending/unread states and respect user display preferences.
- The Next up capsule opens the next relevant calendar record; when no commitment exists, show a quiet empty state or omit it.
- Expanded and compact modes persist. Hovering a compact icon may reveal its label; the entire sidebar must not repeatedly expand by accident.
- Workspace focus mode retracts navigation through a clear user action.

Use Linear's personalisation as a reference for user control, then develop the campus materials and icon behaviour independently. [R3–R4]

## 7. Home — a living view of the day

### 7.1 Composition

1. **Day introduction:** greeting, date, brief summary and original campus scene.
2. **Next meaningful action:** one prominent commitment with relevant action links.
3. **Day timeline:** current-time marker, recent context and upcoming commitments.
4. **Campus activity and personal activity:** service state, tickets and recent work.
5. **Continue working:** relevant Workspace pages and projects when available.
6. **Community and Time Tax:** discovery and reflection lower in the page.

Centre the default schedule around the current part of the day. Offer earlier commitments through an explicit expand or scroll interaction. Include date-only deadlines in their own clear area rather than assigning invented times.

### 7.2 Floating campus scene

Create a small original illustration with a library, mess, academic block, hostel and activity area. Use a warm architectural vocabulary consistent with the actual campus when reference photos are supplied. Until then, label it as a conceptual campus illustration rather than a navigable real map.

- Soft shadows ground buildings; clouds or a paper plane supply restrained ambient motion.
- Time-of-day palettes follow the user's selected campus timezone.
- Selecting a building highlights its service and opens a compact information panel.
- Hover can reveal service name and a short state; keyboard and touch offer the same information.
- If counts are simulated, the scene and details retain an unmistakable Simulation label.
- Real coordinates, routes and travel estimates require actual campus data. Do not invent a map-based navigation claim.

### 7.3 Day objects

Make the next reservation a ticket, the next class a timetable entry and the latest note a document preview. On hover, tickets rise slightly and reveal a clear Open details affordance. Reading content remains steady.

## 8. Calendar — connected, spatial and responsive

- Floating date/view toolbar, positioned without obscuring the timeline.
- Day/week/agenda switches use brief continuity where events can retain identity; avoid complex morphs when the views have incompatible structure.
- Event hover/focus preview shows title, time, location, source and linked project or notes where permitted.
- Editable events support drag with a clear ghost, highlighted valid destination and explicit failure recovery.
- Official or read-only events expose details rather than misleading drag handles.
- Conflicts are indicated before a change is committed; unknown availability remains unknown.
- Booking, task and meeting actions update canonical records; calendar views do not create duplicates.
- Current-time marker updates appropriately without announcing every minute to assistive technology.
- Birthday or community details follow the record's visibility settings.

**Signature sequence:** Choose a slot → submit → show actual pending state → persist → resolve into booking ticket → update the calendar → briefly highlight the resulting event. If persistence fails, retain the selection and explain recovery. The animation is interruptible and does not delay opening the result.

## 9. Bookings — tactile tickets and clear decisions

### 9.1 Ticket appearance

Use a small notch or perforation motif, strong time/location hierarchy and a restrained category accent. Include status and source as text. Avoid decorative barcodes or QR codes that imply scanning works when it does not.

### 9.2 Interaction

- Rest: elevated enough to read as a ticket.
- Hover/focus: slightly stronger depth, visible details action.
- Open: ticket expands into a detail panel with an evident return path.
- Confirm: actual pending and success/failure states.
- Cancel/change: show the consequence and apply the existing workflow rules.
- Multiple tickets: light visual stacking for overview, with an accessible list to inspect every booking.
- Touch: open into a full-width sheet; respect safe areas and keyboard visibility.

Availability changes require real source updates. A pulsing dot cannot certify a room is free.

## 10. Workspace — floating tools around a stable canvas

Carry forward the dedicated Workspace and contextual entry points from the companion specification.

| Area | Floating/reactive treatment | Functional requirement |
|---|---|---|
| Editor | Selection toolbar near selected text | Preserve caret, selection, undo and keyboard editing |
| Internal links | Anchored page previews | Respect permissions; resolve links by identity |
| Backlinks | Slide-out contextual panel | Keep current note and scroll position |
| Page tree | Selected-row depth and reorder feedback | Keyboard alternative and reliable nesting |
| Task board | Lift dragged record and animate neighbouring layout | Persist changes; restore failed moves |
| Knowledge graph | Highlight selected node and neighbours | Keep pan/zoom predictable; provide list/search alternative |
| Comments | Anchored thread panel | Show actual comment state and author |
| Presence | Quiet avatars when collaboration is connected | Never seed fictional active editors |
| Focus mode | Side regions recede; canvas expands | Preserve draft and editor focus |
| Quick capture | Floating capture panel | Save before closing; expose failure |

Page covers and notebook graphics are optional and compact. The editor remains a productive working area. Do not make the graph drift continuously or hide essential editing controls behind hover.

Saving indicators must reflect Saving, Saved, Offline draft, Sync pending or Save failed according to actual storage. Shared editing animation is conditional on shared editing functionality.

## 11. Service graphics and contextual motion

| Module | Distinctive visual object | Useful reactive behaviour | Data boundary |
|---|---|---|---|
| Laundry | Illustrated machine or laundry ticket | Progress indicator changes with recorded cycle state | Countdown requires valid start/end data; uncertain finish stays estimated |
| Mess | Menu board, meal illustration or real food photograph | Meal selector changes menu; dish preview opens on action | Menu is distinct from current availability |
| Printing | Document stack and job ticket | File inspection, upload and processing use distinct states | Local selection is not successful printing |
| Parcels | Parcel label and tracking steps | Highlight actual arrival/collection state | Do not imply courier tracking without an integration |
| Facilities | Room, court or equipment illustration | Selection highlights requested resource | Show confirmed, estimated and unknown availability separately |
| Administration | Clear request timeline | Current step and relevant next action expand | Student planning is distinct from official approval |
| Shuttle, if present | Route strip with selected stop | Reveal actual timetable or reported status | Moving vehicle markers require location data; label simulations |
| Academics | Course notebooks and timetable motifs | Course preview reveals next class and linked notes | Personal completion does not imply institutional submission |

Every service keeps its normal list/detail path. Graphics enrich the interaction rather than becoming the only navigation.

## 12. Community — an editorial campus identity

- Use supplied event photography and posters with consistent crops and readable captions.
- Mix compact event rows with occasional larger editorial features.
- On hover, a poster may rise 2–3 px; reveal date, organiser and Open event.
- Clicking opens a readable event detail page or sheet; preserve the route for sharing.
- RSVP changes appear after the actual save succeeds.
- Club/project previews link to permitted Workspace content.
- Avoid inventing attendees, popularity counts or activity feeds.

This is the best place for a little more expressive typography and visual variety. Maintain a restrained common navigation shell.

## 13. Time Tax — the visual expression of the IBO project

Make operations learning visible through interactive comparisons of waiting, processing, travel and schedule choices. This is the strongest opportunity for an original CampusOS experience.

### 13.1 Proposed interaction

Select a process such as printing, mess or laundry. Show baseline and proposed process side by side, using a time scale. Changing a labelled assumption updates the comparison and the potential reduction. Hover/focus exposes the input source, period and formula.

Keep waiting, service, travel, eating and exercise conceptually separate. Show missing inputs explicitly. Preserve the selected persona and reference period. Avoid combining per-use, weekly and semester figures without visible conversion assumptions.

### 13.2 Motion

- Bars resize when an input changes; values settle once per change.
- A selected waiting segment lifts or highlights to explain its contribution.
- Reclaimed time blocks can form a small visual metaphor, linked to the numerical comparison.
- Operational charts retain exact labels and an accessible data table.
- Measured improvements and scenario estimates use different labels and treatments.

**Example fixture, not a finding:** baseline wait 12 minutes/use, proposed wait 5 minutes/use, frequency 3 uses/week → potential waiting reduction 21 minutes/week. This is a demonstration calculation only. Semester extrapolation requires the number of relevant weeks and an explicit assumption that the scenario applies throughout.

Visual delight must help the professor understand process design, capacity, peak load and waiting. It should strengthen the operations argument.

## 14. Search, activity and contextual controls

### 14.1 Command search

Use a floating command panel with a visible search entry and optional Command/Ctrl+K shortcut. Search across accessible destinations and records. Show contextual actions beside the selected result, taking inspiration from Raycast. [R5]

Example intents: Open operations notes; Find my next booking; Create a personal task; Open laundry; Find a shared project. Natural-language interpretation is optional: ordinary search and explicit actions must work first.

### 14.2 Active-item capsule

An optional compact capsule can hold a user-selected active booking, focus session or service process. It expands into details and collapses deliberately. If several processes exist, expose a list or switcher. Avoid rotating automatically between important states.

### 14.3 Global control discipline

Coordinate search, Campus AI, capture, notifications and the active-item capsule. One small screen must not contain five competing floating buttons. Collapse secondary actions into a menu when necessary. Maintain a clear route to each feature.

## 15. Motion specification

All numbers below are proposed defaults. Tune on the actual rendered product and on ordinary student devices.

| Motion | Duration/amplitude starting point | Behaviour |
|---|---|---|
| Button press | 100–140 ms; scale around 0.98 | Content remains legible; hit area stays stable |
| Card hover | 140–180 ms; lift 2–4 px | Restrained shadow increase |
| Sidebar selection | 180–240 ms | Smooth travel to selected destination |
| Popover | 140–200 ms; 4–6 px offset | Origin relates to trigger |
| Sheet/panel | 220–300 ms | Consistent direction and interruption support |
| Page content | 180–250 ms; minimal displacement | Avoid animating the full page on every interaction |
| Task completion | 180–260 ms | Checkmark, then gentle layout adjustment |
| Ticket expansion | 240–340 ms | Preserve visual identity; provide fade fallback |
| Chart update | 250–400 ms | Update only after input/state change |
| Ambient illustration | 7–12 seconds; 3–6 px | Sparse, offscreen-paused and optional |

- Use a restrained spring for selected-object interactions; avoid repeated bounce.
- Let repeated input interrupt animations and move toward the latest state.
- Keep loading tied to actual work. Do not insert artificial delays for dramatic effects.
- Large page entrance staggers should not replay on every visit.
- A success animation must not fire on initial render just because a record is already completed.
- Reduced motion replaces travel, tilt, parallax and ambient loops with stable states or short fades. [R8]

## 16. Personalisation model

CampusOS should feel personal through useful context and user choice.

| Personalisation | Input | Result |
|---|---|---|
| Day greeting and atmosphere | Chosen timezone, current date/time | Appropriate greeting and campus-scene lighting |
| Pins | Explicit user selection | Relevant courses, services and projects nearby |
| Continue working | Accessible recent records | Resume meaningful work |
| Next action | Valid schedule and booking records | Contextual action without fabricated urgency |
| Workspace identity | Chosen space icon/colour and membership | Clear personal versus shared context |
| Display preferences | Density, motion, sidebar mode | Comfortable interface that remembers choices |
| Student role/persona | Explicit selected context | Correct records and labels |

Keep navigation order stable unless the user changes it. Do not infer sensitive traits or expose private notes in shared views. Existing sample personas remain clearly demonstration contexts.

### 16.1 Relevant campus situations

- **Between classes:** Next class and walking context are easy to inspect; the user can open its notes without navigating through several modules.
- **Assignment team:** A project opens into tasks, documents and meetings; team activity appears only if shared records exist.
- **Laundry errand:** A recorded load state is available through a ticket and optional activity capsule.
- **Club organiser:** An event connects its poster, planning workspace and reservation.
- **IBO presentation:** Time Tax scenarios visibly show how process changes affect waiting, with sources and assumptions available.

## 17. Responsive design and accessibility

### 17.1 Layout modes

| Context | Navigation | Floating surfaces |
|---|---|---|
| Wide desktop | Expanded floating sidebar | Anchored previews and optional context panel |
| Small desktop/tablet | Compact sidebar or deliberate drawer | Fewer simultaneous panels |
| Phone | Bottom navigation: Home, Calendar, Campus, Workspace, More | Full-width sheets and safe-area-aware action controls |
| Workspace focus | Explicitly collapsed shell | Minimal editor controls and easy exit |

Start breakpoint exploration around 768 and 1200 px, then choose actual breakpoints according to content fit. Desktop widths and menu labels must not dictate cramped phone controls.

### 17.2 Interaction requirements

- Primary touch targets should aim for at least 44×44 CSS px.
- Test keyboard-only navigation and visible focus at every step.
- Hover content must be dismissible, hoverable and persistent where the applicable accessibility criterion requires it. [R9]
- Keep critical time, location, availability and source information available without hover.
- Provide explicit alternatives to drag interactions.
- Respect OS reduced-motion preferences; permit additional reduction in app settings.
- When increased contrast or forced colours apply, simplify transparency and preserve boundaries.
- Support 200% zoom without losing essential controls.
- Avoid continuous live-region announcements for simulation counts, clocks or animated numbers.
- Keep overlays clear of the software keyboard and bottom safe area.

## 18. Assets and data required

| Asset/data | Purpose | Fallback until supplied |
|---|---|---|
| Campus landmark photos | Personalised architectural illustration | Conceptual campus scene, clearly non-geographic |
| Approved wordmark/logo | Recognisable app identity | Refined original CampusOS wordmark |
| Campus colour/brand guidance | Institutional fit where appropriate | Proposed warm palette |
| Class and exam schedule | Timeline and next commitments | Labelled demonstration fixtures |
| Mess schedule/menu | Contextual meal preview | Supplied menu with source date |
| Reservation records and policies | Ticket states and actions | Explicit local prototype state |
| Service start/end/status data | Laundry/printing progress | Static known state or labelled estimate |
| Event photographs/posters | Community identity | Permission-cleared original illustrations |
| Shared memberships/activity | Collaboration presence | Hide presence until available |
| Time Tax observations | Operations comparison | Explicit scenario assumptions |
| Source metadata | Provenance and confidence | Unknown or missing source label |

Do not needlessly reproduce student ID cards or personal identifiers as decorative assets. Use personal information only where it serves an actual product function.

### 18.1 Asset family brief

Create a coherent set: campus scene, library, mess, academic building, hostel, laundry machine, document stack, booking ticket, notebook, parcel and event poster frame. Use consistent perspective, shadow direction, colour and detail level. Prefer vector/code-native illustrations for simple interactive objects; reserve raster illustration or photography for suitable editorial areas.

## 19. Implementation architecture

Inspect the repository, existing framework, styling, accessible component primitives and installed animation dependencies before choosing packages. This document does not establish the current technical stack.

Suggested reusable components:

| Component | Responsibility |
|---|---|
| `FloatingAppShell` | Navigation geometry, responsive layout and persistent preferences |
| `CampusSidebar` | Groups, selection, pins, compact mode |
| `ElevatedSurface` | Shared depth and interaction states |
| `ContextPreview` | Anchoring, dismissal and accessible preview content |
| `BookingTicket` | Reservation identity and status presentation |
| `DayTimeline` | Current-day event structure and navigation |
| `CampusScene` | Illustrated service entry points and time-of-day atmosphere |
| `ActivityCapsule` | Optional user-selected active process |
| `WorkspaceContextPanel` | Backlinks, comments and properties |
| `MotionPreferences` | Central OS/app motion preference handling |

Use CSS for simple hover, focus and press feedback. If the app uses React and already has Motion, reuse it for coordinated layout transitions. If needed, evaluate Motion's official hover guidance, including touch behaviour. [R6]

Use existing accessible popover primitives where sufficient. Floating UI is an option for anchoring and collision-aware placement. [R7] Rive is optional for a small number of multi-state illustrated assets; it is not required across the app. [R10]

### 19.1 Layer and performance contract

- Define a central stacking order: canvas → content → sticky controls → navigation → popovers → modals → notifications. Coordinate with the existing portal implementation.
- Transform and opacity are preferred for decorative movement. Layout transitions may require measurement; profile them rather than assuming they are inexpensive.
- Avoid animated blur across large regions. Limit persistent backdrop filters.
- Lazy-load optional animation assets and heavier knowledge visualisations.
- Load high-priority text and actions before decorative media.
- Never update component state on every pointer movement if a lighter animation path suffices.
- Use consistent asset dimensions to prevent layout shifts.
- Target smooth interaction on an ordinary student laptop and midrange phone. Measure actual performance; do not claim a frame rate without profiling.

## 20. Delivery sequence

### Phase 1 — Identity and layout

Implement tokens, type hierarchy, revised Home composition and floating sidebar. Preserve routes, sources and all existing actions. Add responsive navigation and persistent user preferences.

**Exit condition:** Home and the app shell feel recognisably CampusOS before ambient animation is enabled.

### Phase 2 — Shared motion and hover system

Implement hover/focus/press states, anchored previews, panel transitions, reduced motion and keyboard behaviour. Consolidate competing floating controls.

**Exit condition:** The same action behaves consistently across at least Home, Calendar and a service detail view.

### Phase 3 — Signature objects

Implement booking tickets, the timeline connection and the original campus scene. Add time-of-day appearance and labelled service states.

**Exit condition:** A supported reservation workflow has coherent pending, success and failure presentation, including the calendar result where supported.

### Phase 4 — Module expression

Extend the visual system into Academics, Workspace, services, Administration and Community. Follow actual feature readiness rather than rendering decorative promises.

**Exit condition:** Each major module has an appropriate visual form while the shell remains consistent.

### Phase 5 — Operations story and polish

Refine Time Tax interaction, replace provisional assets with campus-specific material, profile performance and complete touch/keyboard/reduced-motion checks.

**Exit condition:** The IBO demonstration explains process improvements clearly and all illustrative data remains labelled.

## 21. Review and acceptance criteria

### 21.1 Visual quality

- [ ] Sidebar looks intentional in expanded, compact and mobile modes.
- [ ] Home has a clear priority order rather than equally weighted panels.
- [ ] Repeated inner borders have been reduced where spacing works better.
- [ ] Timelines, tickets, notes and community content have distinct appropriate forms.
- [ ] Campus illustrations belong to one visual family.
- [ ] Glass never undermines label contrast or content readability.
- [ ] Floating surfaces have consistent edges, shadows and spatial relationships.

### 21.2 Behaviour

- [ ] Hover lift does not shift neighbouring layout or make targets difficult to hit.
- [ ] Every essential hover action has keyboard and touch access.
- [ ] Popovers stay within the viewport and can be dismissed.
- [ ] Repeated clicks and rapid navigation do not strand overlays or duplicate actions.
- [ ] Booking confirmation follows actual persistence.
- [ ] Failed saves retain input and offer recovery.
- [ ] Shared previews preserve permissions and canonical record identity.
- [ ] Reduced motion disables ambient drift, parallax and spatial travel.
- [ ] Phone layouts avoid overlapping floating buttons and keyboard-obscured forms.

### 21.3 Product integrity

- [ ] Original module and feature coverage remains accessible.
- [ ] Workspace remains a first-class destination with contextual entry points.
- [ ] Simulations, estimates and supplied facts remain distinguishable.
- [ ] No fake active collaborators, real-time claims or measured savings appear.
- [ ] Source details are easy to inspect without dominating routine action layouts.

### 21.4 Practical evaluation

Ask representative teammates to complete five tasks: find the next class, inspect a reservation, open course notes, locate a shared project and explain a Time Tax comparison. Record first-click success, completion time, errors and comments. Compare against the existing interface where feasible. Treat any numerical improvement as measured only when the method and observations support it.

## 22. Implementation handoff prompt

> Redesign the existing CampusOS application using this specification and the existing master product/Workspace specifications. Inspect the repository and preserve routes, data contracts, all feature coverage and working behaviours. Develop the warm cream/teal identity into a distinctive floating interface with a grouped personalisable sidebar, purposeful hover/focus/press feedback, contextual previews, tactile booking tickets, a current-day timeline and an original campus illustration family. Carry the same language into Calendar, Workspace, services, Community, Administration and Time Tax. Implement phases in order and verify each stage. Keep inputs and reading surfaces stable; reserve ambient drift for a small number of decorative objects. Provide keyboard/touch equivalents and reduced motion. Show actual pending/success/error state and retain input on failure. Do not simulate backend connectivity or invent live occupancy, collaborator presence or measured savings. Reuse suitable existing libraries and accessible primitives. Complete responsive and functional checks before reporting a phase as finished. If a feature depends on missing data or backend support, describe the concrete dependency and implement the honest supported presentation.

## 23. Reference library and adaptation notes

References were consulted on 3 November 2026. These are design/technical references, not endorsements, assets to copy, or evidence that CampusOS already implements a feature. Detailed geometry, colours and timing values in this document are original CampusOS proposals.

| ID | Reference | What to study | CampusOS adaptation |
|---|---|---|---|
| R1 | [Apple — Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Material hierarchy and navigation surfaces | Selective translucent shell; readable content surfaces |
| R2 | [Apple — Meet Liquid Glass, WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) | Dynamic material, depth and connected controls | Coherent floating navigation and contextual panels |
| R3 | [Linear — Personalised sidebar](https://linear.app/changelog/2024-12-18-personalized-sidebar) | Reordering, hiding and notification preferences | Explicit pins and remembered sidebar choices |
| R4 | [Linear — How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) | Hierarchy, density and consistent component behaviour | Fewer competing borders and stronger navigation hierarchy |
| R5 | [Raycast — Action Panel](https://manual.raycast.com/action-panel) | Contextual actions associated with selected results | Campus search that opens records and exposes relevant actions |
| R6 | [Motion — React hover animation](https://motion.dev/docs/react-hover-animation) | Hover gestures and avoiding inappropriate emulated hover | Consistent pointer interaction with touch alternatives |
| R7 | [Floating UI — Getting started](https://floating-ui.com/docs/getting-started) | Anchored elements, positioning and collision handling | Reliable note previews, menus and contextual controls |
| R8 | [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Detecting OS motion preferences | Stable reduced-motion interface |
| R9 | [W3C — Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Dismissible, hoverable and persistent additional content | Previews users can reach, read and dismiss |
| R10 | [Rive — Features](https://rive.app/features) | Interactive graphics, state machines and data-driven behaviour | A few reactive campus/service illustrations |
| R11 | [Apple — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Further motion-system guidance | Reference for implementation review; full page content was not retrievable in the text research tool |

### 23.1 Internal grounding

- Current product: https://campusos-one-mu.vercel.app/ — Home directly inspected in this discussion on 3 November 2026.
- Companion: CampusOS_Collaborative_Workspace_Master_Spec.md — initial product, navigation, editor and collection sections read on 3 November 2026.
- Prior conversation: CampusOS visual direction, current feature scope, IBO Time Tax objective and the user's request for more floating, hovering, reactive and personalised elements.

### 23.2 Avoiding a generic reference collage

Use Apple to inform materials and continuity, Linear to inform navigation clarity, Raycast to inform action discovery and the technical references to implement reliable interactions. CampusOS supplies the identity: its campus architecture, student routines, linked academic work and operations story. Evaluate the finished experience against those campus tasks rather than resemblance to any single reference.
