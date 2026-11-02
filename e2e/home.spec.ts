import { expect, test, type Page } from '@playwright/test'

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const top = async (page: Page, name: string) => (await region(page, name).boundingBox())!.y

for (const width of [320, 375, 768, 1024, 1280, 1440]) {
  test(`H-T13 Home has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
    ).toBeVisible()
    await expect(region(page, 'Your schedule')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  })
}

test.describe('Home layout order', () => {
  test('mobile reads Up next → Schedule → Deadline focus → Quick actions (spec §3.3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/')
    const [up, schedule, deadlines, quick] = [
      await top(page, 'Up next'),
      await top(page, 'Your schedule'),
      await top(page, 'Deadline focus'),
      await top(page, 'Quick actions'),
    ]
    expect(up).toBeLessThan(schedule)
    expect(schedule).toBeLessThan(deadlines)
    expect(deadlines).toBeLessThan(quick)
  })

  test('desktop pins the schedule beside the Up next / Deadline stack', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const schedule = (await region(page, 'Your schedule').boundingBox())!
    const up = (await region(page, 'Up next').boundingBox())!
    expect(Math.abs(schedule.y - up.y)).toBeLessThan(4)
    expect(up.x).toBeGreaterThan(schedule.x + schedule.width - 4)
  })
})

test.describe('Home behaviour', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('Agenda/Week persists per profile and survives reload', async ({ page }) => {
    await page.goto('/')
    const schedule = region(page, 'Your schedule')
    await expect(schedule.getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await schedule.getByRole('button', { name: 'Week', exact: true }).click()
    await expect(schedule.getByRole('group', { name: 'Days of the week' })).toBeVisible()
    await page.reload()
    await expect(
      region(page, 'Your schedule').getByRole('button', { name: 'Week', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('opening an event goes to the Calendar details for the same record', async ({ page }) => {
    await page.goto('/')
    const schedule = region(page, 'Your schedule')
    await schedule.getByRole('button', { name: 'Week', exact: true }).click()
    // A day with a class exists in every week; pick the first class link anywhere in the week.
    const days = schedule.getByRole('group', { name: 'Days of the week' }).getByRole('button')
    for (let i = 0; i < (await days.count()); i++) {
      await days.nth(i).click()
      const link = schedule.getByRole('link', { name: /Class: Sample Course/ }).first()
      if (await link.count()) {
        await link.click()
        await expect(page).toHaveURL(/\/calendar\?.*event=/)
        await expect(page.getByRole('article', { name: /Details: Sample Course/ })).toBeVisible()
        return
      }
    }
    throw new Error('expected at least one class in the sample week')
  })

  test('quick actions navigate to real destinations', async ({ page }) => {
    await page.goto('/')
    const qa = region(page, 'Quick actions')
    await expect(qa.getByRole('link')).toHaveCount(4)
    await qa.getByRole('link', { name: /Laundry/ }).click()
    await expect(page).toHaveURL(/\/services\/laundry$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Laundry' })).toBeVisible()
    await page.goBack()
    await expect(region(page, 'Quick actions')).toBeVisible()
  })

  test('schedule filters hide items without deleting them and can be cleared', async ({ page }) => {
    await page.goto('/')
    const schedule = region(page, 'Your schedule')
    await schedule.getByRole('button', { name: /^Filter/ }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('checkbox', { name: 'Birthdays' }).uncheck()
    await expect(sheet.getByRole('checkbox', { name: 'Birthdays' })).not.toBeChecked()
    await sheet.getByRole('button', { name: 'Clear filters' }).click()
    await expect(sheet.getByRole('checkbox', { name: 'Birthdays' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('marking a task personally completed is visible in the Calendar and never says "submitted"', async ({
    page,
  }) => {
    await page.goto('/')
    const focus = region(page, 'Deadline focus')
    const title = await focus.locator('li').first().locator('a').first().textContent()
    const button = focus.getByRole('button', { name: 'Mark personally completed' }).first()
    await button.click()
    await expect(focus.getByText(title ?? '', { exact: true })).toHaveCount(0)
    await expect(focus.getByText(/submitted/i)).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: /saved on this device/i }),
    ).toBeVisible()
  })
})
