# CampusOS Assistant — COS-CHAT-001

**Status:** Approved for this local prototype on 2026-11-02.

The CampusOS Assistant is an accessible, bottom-right local chat panel. It answers common student questions by applying deterministic rules to the active profile's records and the established CampusOS routes.

## Boundaries

- It is not a generative AI service and makes no network request.
- It never claims demo records, simulated workflows, availability, outcomes or campus updates are live or official.
- It links to the responsible CampusOS route instead of performing an external action.
- It reads only the active profile's audience-filtered data.

## Acceptance IDs

- `CHAT-AT-01`: Shared-shell launcher opens an accessible labelled panel.
- `CHAT-AT-02`: Typed and suggested questions work; close is keyboard accessible.
- `CHAT-AT-03`: Schedule and task answers use active-profile records and link to Calendar.
- `CHAT-AT-04`: Service, booking, academics, administration and community answers link to live routes.
- `CHAT-AT-05`: Data-authenticity answers describe the demo and link to labels.
- `CHAT-AT-06`: Unknown questions remain honest and suggest supported topics.

## Non-goals

No backend, LLM provider, credential, search crawler, message delivery, real campus integration, data upload or action automation is added.
