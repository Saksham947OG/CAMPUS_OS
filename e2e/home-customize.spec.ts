import { expect, test, type Page } from '@playwright/test'

const sectionOrder = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-widget]')].map((el) => el.getAttribute('data-widget')),
  )

async function openWidgets(page: Page) {
  await page.getByRole('button', { name: 'Customize' }).click()
  const dialog = page.getByRole('dialog', { name: 'Customize Home' })
  await dialog.getByRole('tab', { name: 'Widgets' }).click()
  return dialog
}

test.describe('Customize Home (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('H-T11: mouse drag-and-drop reorders within a section and persists after reload', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('[data-widget="myTasks"]')).toBeVisible() // Home is a lazily loaded route
    const before = await sectionOrder(page)
    expect(before.indexOf('myTasks')).toBeGreaterThan(before.indexOf('messPreview'))
    const dialog = await openWidgets(page)
    const handle = dialog.getByRole('button', { name: 'Drag to reorder My tasks' })
    const target = dialog.getByRole('button', { name: 'Drag to reorder Mess preview' })
    await handle.scrollIntoViewIfNeeded()
    const h = (await handle.boundingBox())!
    const t = (await target.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 - 12, { steps: 4 })
    await page.waitForTimeout(100)
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 - 6, { steps: 20 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await expect
      .poll(async () => {
        const o = await sectionOrder(page)
        return o.indexOf('myTasks') < o.indexOf('messPreview')
      })
      .toBe(true)
    await page.reload()
    await expect(page.locator('[data-widget="myTasks"]')).toBeVisible()
    const after = await sectionOrder(page)
    expect(after.indexOf('myTasks')).toBeLessThan(after.indexOf('messPreview'))
  })

  test('H-T11 / H-T20: the keyboard produces the same result (drag handle, then arrows)', async ({
    page,
  }) => {
    await page.goto('/')
    const dialog = await openWidgets(page)
    const handle = dialog.getByRole('button', { name: 'Drag to reorder My tasks' })
    await handle.focus()
    // dnd-kit attaches its keyboard listeners asynchronously after pick-up, like a real user's pause.
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(150)
    await page.keyboard.press('Space')
    await expect
      .poll(async () => {
        const o = await sectionOrder(page)
        return o.indexOf('myTasks') < o.indexOf('messPreview')
      })
      .toBe(true)
  })

  test('the Up/Down buttons announce the new position in a live region', async ({ page }) => {
    await page.goto('/')
    const dialog = await openWidgets(page)
    await dialog.getByRole('button', { name: 'Move Campus Pulse down' }).click()
    await expect(
      dialog.getByText(/Campus Pulse moved down to position 2 in Discover & reflect/),
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Move Campus Pulse down' })).toBeDisabled()
  })

  test('H-T12: presets replace layout after confirmation; Reset layout restores defaults', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Customize' }).click()
    const dialog = page.getByRole('dialog', { name: 'Customize Home' })
    await dialog.getByRole('radio', { name: 'Campus Life' }).click()
    const confirm = page.getByRole('dialog').last()
    await expect(confirm.getByText(/not touched/)).toBeVisible()
    await confirm.getByRole('button', { name: 'Apply layout' }).click()
    await expect(page.locator('[data-widget="myTasks"]')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Reset layout' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Reset layout' }).click()
    await expect(page.locator('[data-widget="myTasks"]')).toHaveCount(1)
  })

  test('H-T10: a hidden widget stays hidden after reload and can be restored', async ({ page }) => {
    await page.goto('/')
    const dialog = await openWidgets(page)
    await dialog.getByRole('checkbox', { name: 'Show Time Tax snapshot' }).uncheck()
    await expect(page.locator('[data-widget="timeTax"]')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('[data-widget="timeTax"]')).toHaveCount(0)
    const again = await openWidgets(page)
    await again.getByRole('checkbox', { name: 'Show Time Tax snapshot' }).check()
    await expect(page.locator('[data-widget="timeTax"]')).toHaveCount(1)
  })

  test('adding a task from My tasks creates one record that both Home and the Calendar show', async ({
    page,
  }) => {
    await page.goto('/')
    const card = page.locator('[data-widget="myTasks"]')
    await card.getByRole('button', { name: 'Add task' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Title').fill('Pack lab kit')
    await dlg.getByRole('button', { name: 'Save task' }).click()
    await expect(dlg).toBeHidden()
    await expect(card.getByText('Pack lab kit')).toBeVisible()
    await expect(card.getByText('No due date').first()).toBeVisible()
    await page.goto('/calendar?panel=tasks')
    await expect(page.getByRole('tabpanel').getByText('Pack lab kit')).toBeVisible()
  })
})

test.describe('Customize Home (phone)', () => {
  test.use({ viewport: { width: 320, height: 700 } })

  test('the sheet fits at 320px and reordering works without any drag gesture', async ({
    page,
  }) => {
    await page.goto('/')
    const dialog = await openWidgets(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
    await dialog.getByRole('button', { name: 'Move My tasks up' }).click()
    await expect(dialog.getByText(/My tasks moved up/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
