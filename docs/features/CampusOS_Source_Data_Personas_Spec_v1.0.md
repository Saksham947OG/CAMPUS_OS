# CampusOS source data and persona import — COS-DATA-001

Approved in chat on 2026-11-03: ingest the supplied Drive folder, personalize all three consumer personas, adapt historical reference dates to the first week of November, use labelled assumptions for missing operational details, flag unavailable data, and make Time Tax source-aware. This supersedes the fixture-only presentation defaults; existing domain/service ownership and personal-data isolation remain.

## Sources and scope

The folder and its curriculum subfolder contain 28 files. The in-app `/sources` register inventories every file, includes searchable extracted text for non-sensitive documents, links process evidence to source entries, and records duplicates, adaptations, ambiguities and protected records. The import is a checked-in snapshot, not a live Drive connection.

- Ananya Sharma: supplied first-year academically engaged persona.
- Rohan Mehta: illustrative name for the unnamed second persona; supplied committee-organiser routine.
- Aanya Sharma: supplied second-year club-planner persona, distinct from Ananya.
- Existing internal profile IDs remain stable so personal records survive the upgrade.
- Source facts use `provided` with attribution. Operational assumptions use `demoSeed` internally and the visible label **Illustrative**. Local actions remain `userCreated` / `simulated`; they do not contact staff or providers.

## Data mapping

- All eight semesters: course titles and credits from the newer programme manual; screenshot discrepancies retained in the gap register. Current persona enrolment is explicit, separate from calendar events.
- Grade scale: A+ 10, A 9, A- 8, B+ 7, B 6, B- 5, C+ 4, C 3, C- 2, D 1, F 0. Anonymous screenshot examples supply only the letter grades actually visible. Missing grades remain pending. Attendance target is 80%; persona attendance is illustrative and uses supplied held-session totals where available.
- Current-week timetable: unambiguous Nov 2–5 sessions, sections, instructors and rooms. Ambiguous workshop timing remains unknown. CR-04 and CR-05 sessions also block classroom availability through the same source rows.
- Historical midterms and quizzes: original date, time, duration and instructions retained; reference instances moved to Nov 2–7. Midterms use an explicitly adapted 18:00 start. These are not newly issued institutional exam notices. Individual seat assignments and current syllabi are missing.
- Mess: seven days × four meals, transcribed from the visually checked October menu, reused for Nov 2–8 with an adaptation note.
- Chill Spot: 41 food/drink items and visible price variants from the two menu-board photographs. Unlabelled hot-drink variants retain the price difference without inventing serving-size names. Stock, operator acceptance and opening hours are not verified.
- Community: research-listed clubs, committees and proposal-only organisations, all 13 proposed events through March 2027. Dates stay tentative; missing times stay unknown. Recruitment contacts and BMS applicability are flagged.
- Gym/library: source-reported reference capacities (~20 / 130), distinct from live occupancy and reservation limits. Two hostel washers come from the persona chart. Equipment, catalogue, parcels, laundry activity and missing operating rules are labelled planning scenarios.
- ID cards and identifiable attendance rows: reviewed and inventoried; raw scans and student identifiers are not placed in the public JavaScript bundle or repository. They require an authenticated private store. The profile selector is not an access-control boundary.

## Time Tax

Every process links to its evidence. Ananya's four-process composite is 53–69 minutes of potential reduction, composed of observations from different days; it is not a measured daily saving. The 30-minute laundry baseline and the conflicting 45–60-minute chart remain distinct. Rohan's two-hour gym visit is not counted as two hours waiting; the exercise/wait split is missing.

Panels re-read 11 canonical app data sources after service changes, report read failures, and show profile-filtered activity counts without converting clicks or reservations to minutes saved. Users can save dated, timed baseline/with-CampusOS observations with a timing method. Before/after counts and means stay separate by process. Best Time to Go uses these timed records, requires three comparable samples per process/phase/weekday/hour, and never treats a persona narrative as a live crowd forecast. The saved what-if calculator remains available.

## Migration and acceptance

- Upgrade source fixtures once per service, preserve user-created records, closures, profile identities, preferences and personal bookings, and do not overwrite unreadable storage.
- A first-semester GPA what-if works with zero prior credits. Switching personas clears unsaved calculator inputs.
- All three profiles render without validation warnings; menus, source links, current enrolment and process evidence agree across views.
- Timed observations persist and do not leak to another persona. No actual ID-card/attendance roster row appears in the public source library.
- Existing regression fixtures remain available explicitly to deterministic tests; the default app uses supplied campus data.
