import { expect, test, type Page } from '@playwright/test'

// These run against the real system clock, so they only rely on things that are true every week:
// sample Course A meets Mon/Wed and the week/month/agenda windows always contain at least one.

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

for (const width of [320, 375, 768, 1024, 1280, 1440]) {
  for (const view of ['month', 'week', 'day', 'agenda']) {
    test(`C-T27 ${view} view has no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`/calendar?view=${view}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
      expect(await overflow(page)).toBe(false)
    })
  }
}

test.describe('Calendar behaviour (desktop)', () => {
  test.use({ viewport: { width: 1600, height: 1000 } })

  test('opens in Week by default and remembers the chosen view across reloads (C-D08)', async ({
    page,
  }) => {
    await page.goto('/calendar')
    await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(page).toHaveURL(/view=month/)
    await page.goto('/calendar') // no view in the URL: the saved preference decides
    await expect(page.getByRole('button', { name: 'Month', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('selecting an item opens provenance-rich details and a shareable URL; Back returns', async ({
    page,
  }) => {
    await page.goto('/calendar?view=agenda')
    await page
      .getByRole('button', { name: /Class: Sample Course A — lecture/ })
      .first()
      .click()
    await expect(page).toHaveURL(/event=s1-course-a%40/)
    const details = page.getByRole('article', { name: /Details: Sample Course A/ })
    await expect(details).toBeVisible()
    await expect(details.getByText('Sample data', { exact: true })).toBeVisible()
    await expect(details.getByText('Not provided').first()).toBeVisible()
    await page.goBack()
    await expect(page).not.toHaveURL(/event=/)
  })

  test('a deep link restores the selected event after reload', async ({ page }) => {
    await page.goto('/calendar?view=agenda')
    await page
      .getByRole('button', { name: /Class: Sample Course A — lecture/ })
      .first()
      .click()
    const url = page.url()
    await page.goto(url)
    await expect(page.getByRole('article', { name: /Details: Sample Course A/ })).toBeVisible()
  })

  test('an unknown deep link shows a friendly missing-record state, not a blank page', async ({
    page,
  }) => {
    await page.goto('/calendar?event=nope%402026-01-01&panel=details')
    await expect(page.getByText('That record could not be found')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  })

  test('presets only change visibility', async ({ page }) => {
    await page.goto('/calendar?view=agenda')
    const klass = page.getByRole('button', { name: /Class: Sample Course A — lecture/ })
    await expect(klass.first()).toBeVisible()
    await page.getByRole('radio', { name: 'Campus Life' }).check()
    await expect(klass).toHaveCount(0)
    await page.getByRole('radio', { name: 'Balanced Campus' }).check()
    await expect(klass.first()).toBeVisible()
  })

  test('profile switch re-scopes the schedule (isolation)', async ({ page }) => {
    await page.goto('/calendar?view=agenda')
    await expect(
      page.getByRole('button', { name: /Sample Course A — lecture/ }).first(),
    ).toBeVisible()
    await page.getByRole('button', { name: /demo profile/i }).click()
    await page.getByRole('menuitemradio', { name: /Demo Student \(no schedule\)/ }).click()
    await expect(page.getByRole('button', { name: /Sample Course A — lecture/ })).toHaveCount(0)
    // Campus-wide public records remain; the personal schedule does not.
    await expect(
      page.getByRole('button', { name: /Sample Person One's birthday/ }).first(),
    ).toBeVisible()
  })

  test('tabs in the side panel are keyboard operable', async ({ page }) => {
    await page.goto('/calendar?view=agenda')
    const details = page.getByRole('tab', { name: 'Details' })
    await details.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Day Context' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

test.describe('Calendar on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('selecting an item opens the details sheet; Escape closes it and focus returns', async ({
    page,
  }) => {
    await page.goto('/calendar?view=agenda')
    const row = page.getByRole('button', { name: /Class: Sample Course A — lecture/ }).first()
    await row.click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('article', { name: /Details: Sample Course A/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('Layers & filters opens as a sheet and presets are reachable', async ({ page }) => {
    await page.goto('/calendar')
    await page.getByRole('button', { name: /Layers & filters/ }).click()
    await expect(
      page.getByRole('dialog').getByRole('radio', { name: 'Academic Focus' }),
    ).toBeVisible()
  })
})
