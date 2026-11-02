// Runs the unit/component suite and the browser suite, then writes docs/TEST_EVIDENCE.md mapping the
// acceptance IDs in COS-HOME-001 §12 (H-T01…H-T23), COS-CAL-001 §16 (C-T01…C-T30) and COS-CHILL-001 §14
// (CH-AT-01…CH-AT-30), COS-ADMIN-001 §12 (AD-AT-01…AD-AT-40), COS-SHARED-001 (SH-AT-01…SH-AT-40), COS-ACADEMICS-001 (AC-AT-01…AC-AT-40), COS-COMMUNITY-001 (CO-AT-01…CO-AT-45), COS-CHILL-V2-001 (CH2-AT-01…CH2-AT-30), COS-SPACES-001 §13 (SR-AT-01…SR-AT-35), COS-SPORTS-001 §11 (SP-T01…SP-T35) and COS-ESSENTIALS-001 §10 (ESS-L01…L10, ESS-M01…M08, ESS-P01…P06, ESS-S01…S06) to the tests that
// actually ran and their real results. An ID with no matching test is reported as NOT COVERED — never
// as passed. Run: npm run evidence
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const dir = mkdtempSync(join(tmpdir(), 'campusos-evidence-'))
const unitFile = join(dir, 'unit.json')
const e2eFile = join(dir, 'e2e.json')

const run = (cmd, args, env = {}) =>
  spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
    encoding: 'utf8',
  })

console.log('Running unit/component tests…')
run('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${unitFile}`])
console.log('Running browser tests…')
run('npx', ['playwright', 'test', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: e2eFile })

const unit = JSON.parse(readFileSync(unitFile, 'utf8'))
const e2e = JSON.parse(readFileSync(e2eFile, 'utf8'))

/** @type {{ suite: 'unit' | 'e2e'; name: string; status: 'passed' | 'failed' | 'skipped' }[]} */
const results = []
for (const file of unit.testResults) {
  for (const t of file.assertionResults) {
    results.push({
      suite: 'unit',
      name: t.fullName ?? t.title,
      status: t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped',
    })
  }
}
const walk = (suite, trail = []) => {
  const here = suite.title && !suite.title.endsWith('.ts') ? [...trail, suite.title] : trail
  for (const spec of suite.specs ?? []) {
    const ok = spec.tests.every((t) =>
      t.results.every((r) => r.status === 'passed' || r.status === 'skipped'),
    )
    const skipped = spec.tests.every((t) => t.status === 'skipped')
    results.push({
      suite: 'e2e',
      name: [...here, spec.title].join(' › '),
      status: skipped ? 'skipped' : ok ? 'passed' : 'failed',
    })
  }
  for (const child of suite.suites ?? []) walk(child, here)
}
for (const s of e2e.suites) walk(s)

const ids = [
  ...Array.from({ length: 23 }, (_, i) => `H-T${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 30 }, (_, i) => `C-T${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 30 }, (_, i) => `CH-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `ESS-L${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `ESS-M${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `ESS-P${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `ESS-S${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 35 }, (_, i) => `SP-T${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 35 }, (_, i) => `SR-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 40 }, (_, i) => `AD-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 40 }, (_, i) => `SH-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 40 }, (_, i) => `AC-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 45 }, (_, i) => `CO-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 30 }, (_, i) => `CH2-AT-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `CHAT-AT-${String(i + 1).padStart(2, '0')}`),
]
const DEFERRED = {
  'H-T08':
    'Booking creation/cancellation needs the Bookings module, which is not approved (DEC-023). Home shows read-only sample bookings only.',
  'AC-AT-33':
    'Global Search is not built (the /search route is still "coming later"), so there is no index to constrain. Nothing private is searchable because nothing is searchable.',
  'AC-AT-39':
    'No Academics- or Community-specific Time Tax scenario was added. The shared Time Tax calculator (SH-AT-29…SH-AT-40) already labels every figure as an assumption, but it was not extended with faculty, office, club or Lost & Found presets.',
}

// Behaviour is covered by automated tests, but the acceptance wording asks for a human inspection
// that has not happened, so the ID is reported PARTIAL rather than PASS.
const PARTIAL = {
  'CHAT-AT-01':
    'Launcher, panel, close and the top-bar entry point are tested in components, and the panel fits 320 to 768 px with axe scans (automated, Chromium only). No screen reader or real-device pass has been done.',
  'CH-AT-30':
    'Mobile/desktop journeys, keyboard operation, reduced-motion emulation, overflow and axe scans are automated (Chromium only). No manual screen-reader, real-device or visual sign-off has been done.',
  'ESS-M08':
    'Mess and the Calendar dining overlay are tested against the same supplied records; a changed-menu scenario across Home, Mess and Calendar together has not been run.',
  'ESS-S01':
    'Checked for the specific claims the spec names (labelled simulators, no verified-paid, no live occupancy, no tracking/theft claims). A full wording review of every string has not been done.',
  'SP-T03':
    'Slot selection, review and confirmation work from the keyboard, and pages have no overflow at five widths with axe scans (Chromium only). No manual screen-reader or real-device pass has been done.',
  'AD-AT-36':
    'Checked for the specific claims the spec names (no email, SMS or push sent, no "officially approved", "verified by guard" or "technician fixed" without a demo label). A full wording review of every string has not been done.',
  'AD-AT-37':
    'A complaint is submitted from the keyboard and its timeline is reached (Chromium only). No screen reader was used.',
  'AD-AT-38':
    'Forms, the review step and timelines were exercised at 320 to 1440 px and on a 375 px phone (automated, Chromium only). No real-device pass has been done.',
  'AD-AT-39':
    'Status text, labelled controls and axe scans pass (Chromium only). No manual screen-reader pass has been done, and live-region announcements were not listened to.',
  'SR-AT-26':
    'A space booking gets the existing 30-minute in-app reminder plan and the pages say reminders are in-app only. Per-profile reminder settings are an existing, separately tested Calendar feature and were not re-asserted for spaces.',
  'SR-AT-29':
    'Slot selection and confirmation work from the keyboard (Chromium only). Dialog focus on every booking form has not been checked by hand and no screen reader was used.',
  'SR-AT-30':
    'Overnight intervals are shown in full at 320 to 1440 px and the review is not clipped at 375 px (automated, Chromium only). No real-device pass has been done.',
  'SH-AT-40':
    'Pages and charts have no overflow at 320 to 1440 px and pass axe (automated, Chromium only). No manual screen-reader pass, and no real-device check, has been done.',
  'AC-AT-37':
    'Meeting and mentorship forms were completed from the keyboard and pass axe (automated, Chromium only). No screen reader was used and reduced-motion was not manually reviewed.',
  'AC-AT-38':
    'Course, Faculty, Mentorship and Office pages have no overflow at 320 to 1440 px (automated, Chromium only). No real-device pass has been done.',
  'AC-AT-32':
    'Notices say they are in-app only and no test finds an email/push/WhatsApp claim. A full wording review of every string has not been done.',
  'CO-AT-21':
    'Club events appear in Community and on the Calendar. The default "Balanced Campus" Calendar preset hides Club and Sports items by the frozen Calendar contract, so they are visible only with a preset such as "Campus Life". Home’s schedule widget was not asserted.',
  'CO-AT-42':
    'Notices and pages were checked for the specific claims the spec names (outside delivery, real committee approval, live sync) and no backend code exists. A full wording review of every string has not been done.',
  'CO-AT-44':
    'Overflow at 320 to 1440 px, keyboard operation of the club request form and axe scans are automated (Chromium only). Focus order on every screen was not hand-reviewed and no real-device check was done.',
  'CO-AT-45':
    'This file records the real commands and results. Manual screen-reader, real-device and visual sign-off checks listed above have not been done, so the criterion is reported as incomplete.',
  'CH2-AT-29':
    'Overflow at 320 to 1440 px, keyboard operation of ordering and the arrival marker, a reduced-motion run and axe scans on the tracker, ticket, Ops Lab and the three Time Tax views are automated (Chromium only). No manual screen-reader, real-device or visual sign-off has been done.',
  'CH2-AT-30':
    'The scripted path from recorded walk-ins to a student collection is automated through the domain and repository. The presenter-driven walk-through of the manual script in the Ops Lab was not rehearsed with an audience.',
  'ESS-S05':
    'Phone and desktop journeys, keyboard form submission, overflow at five widths and axe scans are automated (Chromium only). No manual screen-reader or real-device pass has been done.',
}

const count = (suite, status) =>
  results.filter((r) => r.suite === suite && r.status === status).length
const rows = ids.map((id) => {
  const re = new RegExp(`\\b${id}\\b`)
  const matched = results.filter((r) => re.test(r.name) && r.status !== 'skipped')
  const failed = matched.filter((r) => r.status === 'failed')
  const partial = matched.some((r) => /\(partial\)/.test(r.name)) || Boolean(PARTIAL[id])
  let status
  if (DEFERRED[id]) status = 'DEFERRED'
  else if (matched.length === 0) status = 'NOT COVERED'
  else if (failed.length) status = 'FAIL'
  else if (partial) status = 'PARTIAL'
  else status = 'PASS'
  const u = matched.filter((r) => r.suite === 'unit').length
  const b = matched.filter((r) => r.suite === 'e2e').length
  return {
    id,
    status,
    u,
    b,
    note:
      DEFERRED[id] ??
      PARTIAL[id] ??
      (partial
        ? 'The Booking module that owns the record does not exist; only Calendar-side behaviour is tested.'
        : ''),
  }
})

const total = (s) => rows.filter((r) => r.status === s).length
const generated = new Date().toISOString()
const md = `# CampusOS — Test Evidence

Generated by \`npm run evidence\` on ${generated} (UTC). It runs the real suites and maps acceptance IDs in test
titles to real results. It records what was executed here; it does not certify anything beyond that.

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Unit + component (Vitest, jsdom) | ${count('unit', 'passed')} | ${count('unit', 'failed')} | ${count('unit', 'skipped')} |
| Browser (Playwright, Chromium only) | ${count('e2e', 'passed')} | ${count('e2e', 'failed')} | ${count('e2e', 'skipped')} |

**Acceptance IDs:** ${total('PASS')} PASS · ${total('PARTIAL')} PARTIAL · ${total('DEFERRED')} DEFERRED · ${total('NOT COVERED')} NOT COVERED · ${total('FAIL')} FAIL (of ${ids.length}).

| ID | Result | Unit/component tests | Browser tests | Note |
|---|---|---:|---:|---|
${rows.map((r) => `| ${r.id} | **${r.status}** | ${r.u} | ${r.b} | ${r.note} |`).join('\n')}

## What this evidence does not cover

- Browsers other than Chromium (no Firefox or Safari run).
- Manual screen-reader testing. Automated axe-core checks (WCAG 2.2 AA rules) pass, but they find only part of the problems a person with assistive technology would.
- Real devices and touch hardware; narrow viewports are emulated.
- Performance budgets (the non-binding "Home under 2 s" goal in COS-HOME-001 §11 has not been benchmarked).
- Behaviour on real campus data: none has been supplied, so every record is demonstration data (\`demoSeed\`) or created in the browser.
- Cross-tab storage synchronisation (not implemented).
`
writeFileSync(join(root, 'docs/TEST_EVIDENCE.md'), md)
console.log(md.split('\n').slice(0, 14).join('\n'))
const bad = rows.filter((r) => r.status === 'FAIL' || r.status === 'NOT COVERED')
if (bad.length || count('unit', 'failed') || count('e2e', 'failed')) {
  console.error(
    `\nAttention: ${bad.map((b) => `${b.id}=${b.status}`).join(', ') || 'failing tests present'}`,
  )
  process.exitCode = 1
}
