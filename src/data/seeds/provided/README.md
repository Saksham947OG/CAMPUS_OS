# Provided datasets

**No supplied data has been imported yet.** This folder is reserved for validated JSON derived from
documents the project owner supplies (timetable, exam schedule, deadlines, birthdays with consent,
mess menu, campus events — see COS-CAL-001 §13).

Rules (from CLAUDE.md and COS-CAL-001 §13):

- Records here have `dataMode: "provided"` and must keep `sourceLabel` / `importBatchId`.
- Unknown values stay unknown. A due date with no time stays date-only. Never fill gaps by guesswork.
- Ambiguous rows go to a review list, not into canonical records.
- Never commit private birthday data or real student records to a public repository.
- Demo records live in `../demo/` and must never be mixed into this folder.
