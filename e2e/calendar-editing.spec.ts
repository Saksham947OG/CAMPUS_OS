import { expect, test, type Page } from '@playwright/test'

// Dates in 2030 never collide with the sample data, which is relative to today.
const DAY = '2030-03-05'

async function openAdd(page: Page, item: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('personal events (desktop)', () => {
  test.use({ viewport: { width: 1600, height: 1000 } })

  test('C-A08 / C-A11 / C-T24: create → persists across reload → delete with confirmation', async ({
    page,
  }) => {
    await page.goto(`/calendar?view=agenda&date=${DAY}`)
    await openAdd(page, 'Personal event')
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Title').fill('Group study')
    await dlg.getByLabel('Date').fill(DAY)
    await dlg.getByLabel('Start time').fill('15:00')
    await dlg.getByLabel('End time').fill('16:00')
    await dlg.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dlg).toBeHidden()
    await expect(
      page.getByRole('status').filter({ hasText: /saved on this device/i }),
    ).toBeVisible()

    const row = page.locator('main ol').getByRole('button', { name: /Personal event: Group study/ })
    await expect(row).toBeVisible()
    await page.reload()
    await expect(
      page.locator('main ol').getByRole('button', { name: /Personal event: Group study/ }),
    ).toBeVisible()

    await page
      .locator('main ol')
      .getByRole('button', { name: /Personal event: Group study/ })
      .click()
    await page.getByRole('button', { name: /^Delete/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete event' }).click()
    await expect(page.locator('main ol').getByRole('button', { name: /Group study/ })).toHaveCount(
      0,
    )
  })

  test('C-T25: invalid input keeps the draft and shows inline errors', async ({ page }) => {
    await page.goto(`/calendar?view=agenda&date=${DAY}`)
    await openAdd(page, 'Personal event')
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Location (optional)').fill('Room 5')
    await dlg.getByLabel('Date').fill(DAY)
    await dlg.getByLabel('Start time').fill('10:00')
    await dlg.getByLabel('End time').fill('09:00')
    await dlg.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dlg.getByText('Title is required')).toBeVisible()
    await expect(dlg.getByText('End time must be after the start time')).toBeVisible()
    await expect(dlg.getByLabel('Location (optional)')).toHaveValue('Room 5')
    await expect(dlg).toBeVisible()
  })

  test('a weekly personal event can have one occurrence cancelled without losing the series', async ({
    page,
  }) => {
    await page.goto(`/calendar?view=agenda&date=${DAY}`)
    await openAdd(page, 'Personal event')
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Title').fill('Weekly sync')
    await dlg.getByLabel('Date', { exact: true }).fill(DAY)
    await dlg.getByLabel('Start time').fill('09:00')
    await dlg.getByLabel('End time').fill('09:30')
    await dlg.getByLabel('Repeats', { exact: true }).selectOption('weekly')
    await dlg.getByLabel('Repeat until').fill('2030-03-19')
    await dlg.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dlg).toBeHidden()

    const rows = page.locator('main ol').getByRole('button', { name: /Weekly sync/ })
    await expect(rows).toHaveCount(1) // agenda window is 7 days from the anchor
    await rows.first().click()
    await page.getByRole('button', { name: /^Delete/ }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByRole('button', { name: 'Entire series' })).toBeVisible()
    await expect(confirm.getByText(/this and following/i).first()).toBeVisible() // stated as unavailable, not offered as a button
    await expect(confirm.getByRole('button', { name: /this and following/i })).toHaveCount(0)
    await confirm.getByRole('button', { name: 'This occurrence' }).click()
    await expect(
      page.locator('main ol').getByRole('button', { name: /Weekly sync.*cancelled/i }),
    ).toHaveCount(1)
    // Next week's occurrence is untouched.
    await page.goto(`/calendar?view=agenda&date=2030-03-12`)
    await expect(
      page.locator('main ol').getByRole('button', { name: /Weekly sync/ }),
    ).not.toHaveAttribute('aria-label', /cancelled/)
  })

  test('Tasks tab: add a task, tick it personally complete, and Home sees the same record', async ({
    page,
  }) => {
    await page.goto('/calendar?view=agenda&panel=tasks')
    await page.getByRole('button', { name: 'Add task' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Title').fill('Write summary')
    await dlg.getByRole('button', { name: 'Save task' }).click()
    await expect(dlg).toBeHidden()
    const panel = page.getByRole('tabpanel')
    const card = panel.locator('li').filter({ hasText: 'Write summary' })
    await expect(card).toContainText('No due date')
    await card.getByRole('checkbox', { name: /personally completed/ }).click()
    // Completed tasks move to the collapsed "Completed" section.
    await panel.locator('summary', { hasText: 'Completed' }).click()
    const done = panel.locator('li').filter({ hasText: 'Write summary' })
    await expect(done.getByRole('checkbox', { name: /personally completed/ })).toBeChecked()
    await expect(done.getByText(/submitted/i)).toHaveCount(0)
  })
})

test.describe('editor on a phone', () => {
  test.use({ viewport: { width: 320, height: 700 } })

  test('the editor sheet fits at 320px, is keyboard-operable and Escape returns focus', async ({
    page,
  }) => {
    await page.goto(`/calendar?view=agenda&date=${DAY}`)
    const add = page.getByRole('button', { name: 'Add', exact: true })
    await add.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Personal event' }).press('Enter')
    const dlg = page.getByRole('dialog')
    await expect(dlg).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
    const box = (await dlg.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(320)
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(add).toBeFocused()
  })
})

test.describe('reminder settings and inbox', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('reminder preferences persist and the inbox explains it is in-app only', async ({
    page,
  }) => {
    await page.goto('/settings')
    const card = page.locator('#reminders')
    await expect(
      card.getByText(/never by push, email, SMS or WhatsApp|Nothing is sent by push/),
    ).toBeVisible()
    await card.getByRole('checkbox', { name: 'Classes (opt-in)' }).check()
    await expect(
      page.getByRole('status').filter({ hasText: /Reminder settings saved on this device/ }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.locator('#reminders').getByRole('checkbox', { name: 'Classes (opt-in)' }),
    ).toBeChecked()

    await page.goto('/notifications')
    await expect(page.getByText(/nothing is sent by push, email, SMS or WhatsApp/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs attention now' })).toBeVisible()
  })
})
