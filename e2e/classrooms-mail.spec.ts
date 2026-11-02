import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Classrooms and the simulated Campus Mail (COS-MASTER-V2). These run on the real clock, so they
 * book TOMORROW and never rely on a time of day. Everything is a labelled demo.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
async function audit(page: Page, label: string) {
  await page.waitForTimeout(500)
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.help} — ${v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    ),
    `${label}: axe violations`,
  ).toEqual([])
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

for (const width of [320, 375, 768, 1440]) {
  test(`Classrooms and Campus Mail have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/bookings', '/bookings/classrooms', '/notifications/mail']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('Classrooms: compare four rooms, book from a free slot, see it in My bookings, then cancel', async ({
    page,
  }) => {
    await page.goto('/bookings')
    await page
      .getByRole('link', { name: /Classrooms/ })
      .first()
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Classrooms' })).toBeVisible()
    for (const name of ['CR Conference Hall', 'CR1', 'CR3', 'G12'])
      await expect(page.getByLabel('Rooms').getByRole('heading', { name })).toBeVisible()
    await page.getByLabel('Date').fill(tomorrow())
    await page.getByLabel('Start').selectOption(String(14 * 60))
    await audit(page, 'Classrooms')
    await page
      .locator('[data-room="CR3"]')
      .getByRole('button', { name: /Book this room/ })
      .click()
    await page.getByLabel('Group name (optional)').fill('Ops project')
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'CR3 booking' })).toBeVisible()
    await expect(page.getByText('Confirmed (local)').first()).toBeVisible()
    await audit(page, 'Classroom booking')
    await page.getByRole('link', { name: 'View My bookings' }).click()
    await expect(page.getByText(/Classrooms \(1\)/)).toBeVisible()
    await page.locator('a[href^="/bookings/my/bk-"], a[href*="/classrooms/bookings/crb-"]').click()
    await page.getByRole('button', { name: 'Cancel reservation' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel reservation' }).click()
    await expect(page.getByText('Cancelled').first()).toBeVisible()
  })

  test('Classrooms: an uncovered afternoon in G12 is UNKNOWN, never free', async ({ page }) => {
    await page.goto('/bookings/classrooms')
    await page.getByLabel('Date').fill(tomorrow())
    await page.getByLabel('Start').selectOption(String(15 * 60))
    await expect(page.locator('[data-room="G12"]')).toContainText('Unknown / not synced')
    await expect(
      page.locator('[data-room="G12"]').getByRole('button', { name: /Request verification/ }),
    ).toBeVisible()
  })

  test('Campus Mail: the simulated lab delivers a seating email, the seat appears once on the exam page, and a replay changes nothing', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/notifications/mail')
    await expect(page.getByText(/Saved on this device · simulated mail/)).toBeVisible()
    const lab = page.getByTestId('demo-ops')
    await audit(page, 'Campus Mail with the injection lab')
    await lab.getByRole('button', { name: 'Receive Revised Quiz Seating Email' }).click()
    await expect(page.getByText('Quiz Seating — Revised (Demo)')).toBeVisible()
    await lab.getByRole('button', { name: 'Receive Revised Quiz Seating Email' }).click() // same message again
    await expect(page.getByText('Quiz Seating — Revised (Demo)')).toHaveCount(1)
    await page.getByRole('link', { name: /Quiz Seating — Revised/ }).click()
    await expect(page.getByTestId('pipeline')).toContainText('Exact student key and exam matched')
    await expect(page.getByTestId('pipeline')).toContainText('same message arrived again')
    await audit(page, 'Mail detail')
    await page.getByRole('link', { name: 'View my seat' }).click()
    await expect(page.getByText('CR5, row 3, column 2')).toBeVisible()
    await expect(page.getByText(/not an official allotment/).first()).toBeVisible()
  })
})
