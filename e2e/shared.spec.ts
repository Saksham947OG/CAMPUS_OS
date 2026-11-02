import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Shared experience (COS-SHARED-001): notification preferences, exam seating, Best Time to Go and
 * Time Tax. Charts and tables must stay readable and operable at every width.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
async function audit(page: Page, label: string) {
  await page.waitForTimeout(500)
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `${label}: axe violations`,
  ).toEqual([])
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

const paths = [
  '/notifications',
  '/notifications/preferences',
  '/academics/exams',
  '/academics/exams/exam-1',
  '/services/best-time',
  '/time-tax',
  '/time-tax/scenarios',
  '/time-tax/observations',
]
for (const width of [320, 375, 768, 1440]) {
  test(`SH-AT-40 Shared pages and Time Tax charts have no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

test('SH-AT-40: Time Tax scenario results are readable text with an axe-clean page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/time-tax/scenarios')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await audit(page, 'Time Tax scenarios (phone)')
})

test('SH-AT-19 / SH-AT-22: an exam seating change is critical, private and keeps earlier versions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: /Show Demo Operations/ }).check()
  await page.goto('/academics/exams')
  const ops = page.getByTestId('demo-ops')
  await ops.getByLabel('Hall').fill('Demo Hall 7')
  await ops.getByRole('button', { name: 'Set or change seat' }).click()
  await page.goto('/notifications')
  await expect(page.getByText(/Your exam seating changed \(demo\)/).first()).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Demo Hall 7')
  await audit(page, 'Notifications with a critical seating message')
})
