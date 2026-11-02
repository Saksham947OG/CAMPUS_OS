import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Automated accessibility audit (WCAG 2.2 AA rules in axe-core). It finds a real subset of problems —
 * contrast, names, roles, landmarks, focus order cues — but it is not a substitute for manual
 * screen-reader testing, which has not been done.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
  expect(summary, `${label}: axe violations`).toEqual([])
}

const pages: [string, string][] = [
  ['Home', '/'],
  ['Calendar week', '/calendar?view=week'],
  ['Calendar month', '/calendar?view=month'],
  ['Calendar day', '/calendar?view=day'],
  ['Calendar agenda', '/calendar?view=agenda'],
  ['Calendar tasks panel', '/calendar?view=agenda&panel=tasks'],
  ['Notifications', '/notifications'],
  ['Settings', '/settings'],
  ['Services hub', '/services'],
  ['Chill Spot menu', '/services/chill-spot'],
  ['Chill Spot my orders', '/services/chill-spot?tab=orders'],
  ['Laundry hub', '/services/laundry'],
  ['SS Laundry', '/services/laundry/ss'],
  ['Washing machines', '/services/laundry/machines'],
  ['Mess', '/services/mess'],
  ['Mess fees', '/services/mess/fees'],
  ['Parcels', '/services/parcels'],
  ['Bookings hub', '/bookings'],
  ['Gym', '/bookings/gym'],
  ['Badminton', '/bookings/badminton'],
  ['Other sports', '/bookings/sports'],
  ['My bookings', '/bookings/my'],
  ['Waitlists', '/bookings/waitlist'],
  ['Library', '/bookings/library'],
  ['Library books', '/bookings/library/books'],
  ['Library loans', '/bookings/library/loans'],
  ['Music Room', '/bookings/music-room'],
  ['Chill Zone', '/bookings/chill-zone'],
  ['Administration', '/administration'],
  ['Leave and out-time', '/administration/leave'],
  ['New leave request', '/administration/leave/new'],
  ['Complaint tracker', '/administration/complaints'],
  ['New complaint', '/administration/complaints/new'],
  ['Classroom equipment', '/administration/teaching-aids'],
  ['New equipment report', '/administration/teaching-aids/new'],
  ['My requests', '/administration/requests'],
  ['Notification preferences', '/notifications/preferences'],
  ['Exams', '/academics/exams'],
  ['Exam detail', '/academics/exams/exam-1'],
  ['Best time to go', '/services/best-time'],
  ['Time Tax', '/time-tax'],
  ['Time Tax scenarios', '/time-tax/scenarios'],
  ['Time Tax observations', '/time-tax/observations'],
  ['Academics', '/academics'],
  ['My courses', '/academics/courses'],
  ['Course overview', '/academics/courses/course-a'],
  ['Course notices', '/academics/courses/course-a/announcements'],
  ['Course materials', '/academics/courses/course-a/materials'],
  ['Course assignments', '/academics/courses/course-a/assignments'],
  ['Course projects', '/academics/courses/course-a/projects'],
  ['Faculty Connect', '/academics/faculty'],
  ['Faculty profile', '/academics/faculty/fac-a'],
  ['My faculty meetings', '/academics/faculty/appointments'],
  ['New faculty meeting', '/academics/faculty/appointments/new?actor=fac-a'],
  ['Mentorship', '/academics/mentorship'],
  ['BMS Office', '/academics/office'],
  ['My BMS Office requests', '/academics/office/appointments'],
  ['New BMS Office request', '/academics/office/appointments/new'],
  ['Community', '/community'],
  ['Lost and Found (found)', '/community/lost-found'],
  ['Lost and Found (mine)', '/community/lost-found?tab=mine'],
  ['New lost report', '/community/lost-found/new?type=lost'],
  ['New found report', '/community/lost-found/new?type=found'],
  ['Found report', '/community/lost-found/rep-1'],
  ['Clubs', '/community/clubs'],
  ['Club overview', '/community/clubs/club-robotics'],
  ['Club recruitment', '/community/clubs/club-robotics?tab=recruitment'],
  ['Club connect', '/community/clubs/club-robotics?tab=connect'],
  ['My club requests', '/community/clubs/requests'],
  ['Sports fixtures', '/community/sports-events'],
  ['Find a team', '/community/sports-events?tab=teams'],
  ['Looking for players', '/community/sports-events?tab=looking'],
  ['Create a team', '/community/sports-events?tab=create'],
  ['Team', '/community/sports-events/teams/team-1'],
  ['Fixture', '/community/sports-events/fixtures/fx-1'],
  ['My participation', '/community/sports-events/my-participation'],
  ['Coming-later page', '/search'],
  ['Not found', '/nope'],
]

for (const [name, path] of pages) {
  test(`axe: ${name} (desktop)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    await page.waitForTimeout(300)
    await audit(page, name)
  })
  test(`axe: ${name} (phone)`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    await page.waitForTimeout(300)
    await audit(page, `${name} (phone)`)
  })
}

test.describe('overlays', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('axe: Customize Home sheet (every tab)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Customize' }).click()
    const dialog = page.getByRole('dialog', { name: 'Customize Home' })
    for (const tab of ['Layouts', 'Widgets', 'Quick actions', 'Display']) {
      await dialog.getByRole('tab', { name: tab }).click()
      await audit(page, `Customize › ${tab}`)
    }
  })

  test('axe: editors and confirmation dialog', async ({ page }) => {
    await page.goto('/calendar?view=agenda')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Personal event' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0) // let the closing menu finish animating before auditing
    await page.waitForTimeout(400)
    await audit(page, 'Event editor')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Study / focus block' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.waitForTimeout(400)
    await audit(page, 'Focus editor')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.goto('/settings')
    await page.getByRole('button', { name: /Reset demo data/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page, 'Reset confirmation')
  })

  test('axe: mobile More sheet and Calendar filters sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Main navigation, mobile' })
      .getByRole('button', { name: 'More' })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page, 'More sheet')
    await page.keyboard.press('Escape')
    await page.goto('/calendar')
    await page.getByRole('button', { name: /Layers & filters/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page, 'Filters sheet')
  })
})
