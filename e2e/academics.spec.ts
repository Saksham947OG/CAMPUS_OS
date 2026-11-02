import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Academics (COS-ACADEMICS-001): Course Hub, faculty and BMS Office meetings, mentorship.
 * Everything is a labelled demo: no real person or office is involved.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function audit(page: Page, label: string) {
  await page.waitForTimeout(500)
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
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

const paths = [
  '/academics',
  '/academics/courses',
  '/academics/courses/course-a',
  '/academics/courses/course-a/materials',
  '/academics/faculty',
  '/academics/faculty/fac-a',
  '/academics/faculty/appointments/new?actor=fac-a',
  '/academics/mentorship',
  '/academics/office',
]
for (const width of [320, 375, 768, 1440]) {
  test(`AC-AT-38 Academics pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('AC-AT-17 / AC-AT-19 / AC-AT-20 / AC-AT-21 / AC-AT-37: a keyboard-only request stays pending until the simulator accepts it, then appears on the Calendar', async ({
    page,
  }) => {
    await page.goto('/academics/faculty/appointments/new?actor=fac-a')
    const select = page.getByLabel('Published sample window')
    await select.focus()
    await select.selectOption({ index: 1 })
    const submit = page.getByRole('button', { name: 'Record request locally' })
    await submit.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { level: 1, name: /Meeting with Demo Faculty A/ }),
    ).toBeVisible()
    await expect(page.getByText('Awaiting demo response').first()).toBeVisible()
    await expect(page.getByTestId('demo-ops')).toHaveCount(0)
    await audit(page, 'Meeting detail')

    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/academics/faculty/appointments')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Academics simulator')
    await ops.getByRole('button', { name: 'Accept' }).click()
    await page
      .getByRole('link', { name: /Demo Faculty A/ })
      .first()
      .click()
    await expect(
      page.getByText(/Accepted locally \(not an official appointment\)/).first(),
    ).toBeVisible()

    await page.goto('/calendar?view=agenda')
    await expect(
      page.getByText(/Meeting with Demo Faculty A \(demo, not official\)/).first(),
    ).toBeVisible()
  })

  test('AC-AT-05 / AC-AT-06: read state persists across a reload and a missing link is not a link', async ({
    page,
  }) => {
    await page.goto('/academics/courses/course-a/announcements')
    await page.getByRole('button', { name: 'Mark as read' }).first().click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Mark as read' })).toHaveCount(1)
    await page.goto('/academics/courses/course-a/materials')
    await expect(page.getByText(/Resource not provided. There is no usable link./)).toBeVisible()
  })
})
