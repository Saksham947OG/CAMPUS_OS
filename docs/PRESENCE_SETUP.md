# Campus activity and opt-in presence

The campus activity panel is available across the website. It animates 300 fictional students with conserved counts and facility capacity limits. Pause stops its timer. Reduced-motion settings disable avatar motion. These counters never write fake orders, room holds, check-ins or washing-machine reservations into the real service stores.

Reference capacities: library 140 and mess 100 are owner updates. Gym 20 uses the earlier approximate persona value. Classrooms 80, Chill Spot 30 and two laundry places are illustrative configuration. Occupancy is not booking availability: do not subtract occupants from reservations to promise a slot.

Choose **Real check-in setup** for foreground geofencing. Enter the facility latitude/longitude, boundary radius and capacity. Location starts only after **Enable location check-in** and the browser's permission prompt. Two accurate readings are required; accuracy must be no worse than half the radius or 50 metres. A 20-metre exit buffer limits boundary flicker. Hidden pages stop tracking and check out. Closing the page or losing connectivity expires the optional shared server session after 60 seconds. Indoor room-level location and background tracking are not guaranteed by browser GPS.

Coordinates remain in the browser. Only an anonymous random session ID, facility ID and presence boolean are sent to an explicitly configured shared server. Participants opt in; absent participation is unknown, so this is not a verified headcount.

## Optional shared server

Run `node scripts/presence-server.mjs` in a terminal. It listens on `127.0.0.1:4180`. Enter `http://localhost:4180` as the shared server URL when running the app on this Mac. Multiple browser sessions using that server see shared counts through 15-second heartbeats. GET `/presence` returns counts; POST accepts only `{sessionId, facilityId, present}`. Repeated check-in is idempotent and moving facilities replaces the old session location. Expired sessions do not count.

The server is memory-only and designed for trusted local testing. A restart clears sessions. Configure `PRESENCE_ORIGINS` as a comma-separated exact allowlist when using another frontend origin. `PORT` and `PRESENCE_HOST` control the bind address. For use on the public Vercel site, deploy a protected, rate-limited, HTTPS presence service and enter its URL; an HTTPS page cannot use an insecure remote HTTP service. No public presence backend, identity provider or campus coordinates have been provisioned by this change. Production use needs verified boundaries, consent policy, abuse protection and durable/shared storage appropriate to the deployment.

## Persona planning assumptions

All three profiles now have potential-reduction totals. The second and third personas receive owner-authorized illustrative baselines where measurements were missing. These are waiting/coordination estimates, not observed time saved, and exclude productive exercise, eating and study. They remain separate from recorded observations.

Illustrative exam seating assigns Conference Hall, column 3, rows 5–7 to the three personas. Source labels explicitly identify the assignment as a scenario, not an official allotment. Supplied schedules and the original document text remain available.
