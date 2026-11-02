import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * COS-V3: Find a time, Grades and Attendance, Report an issue with video evidence, Campus AI. These run
 * on the real clock against the production build, so none depends on a time of day.
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

for (const width of [320, 375, 768, 1440]) {
  test(`V3 pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [
      '/calendar/find-a-time',
      '/calendar/polls',
      '/academics/grades',
      '/academics/attendance',
      '/help/report',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

for (const width of [320, 390, 768]) {
  test(`CampusOS Assistant fits the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/')
    const launcher = page.getByRole('button', { name: 'Ask CampusOS' })
    if (width < 768) await expect(launcher).toBeHidden() // phones use the top-bar button instead
    await page.getByRole('button', { name: 'Open CampusOS Assistant' }).click()
    const panel = page.getByRole('region', { name: 'CampusOS Assistant' })
    await expect(panel).toBeVisible()
    expect(await noOverflow(page), `assistant open at ${width}px`).toBe(false)
    const box = await panel.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    await audit(page, `assistant open at ${width}px`)
  })
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('Find a time: suggestions, a room, one confirmation, and the guest’s reply', async ({
    page,
  }) => {
    await page.goto('/calendar')
    await page.getByRole('link', { name: 'Find a time' }).click()
    await page.getByLabel('Add people (search by name)').fill('Student B')
    await page.getByRole('button', { name: 'Add Reference Student B' }).click()
    const list = page.getByTestId('suggestions')
    await expect(list.getByRole('button', { name: /Choose this time/ }).first()).toBeVisible()
    await audit(page, 'Find a time with suggestions')
    await page.getByLabel('Meeting title').fill('Project sync')
    await list
      .getByRole('button', { name: /Choose this time/ })
      .first()
      .click()
    await expect(page.getByTestId('rooms')).toBeVisible()
    await page
      .getByTestId('rooms')
      .getByRole('button', { name: /Use this room/ })
      .filter({ hasNotText: 'Selected' })
      .nth(2)
      .click()
    await page.getByRole('button', { name: 'Confirm meeting' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Project sync' })).toBeVisible()
    await expect(page.getByText(/not everyone’s acceptance/)).toBeVisible()
    await audit(page, 'Meeting page')
    await page.getByRole('link', { name: 'Open in Calendar' }).click()
    await expect(page.getByText(/Meeting: Project sync/).first()).toBeVisible()
  })

  test('Grades: a simulated grade projects a CGPA and never changes a recorded one; Attendance meets or misses its target in words', async ({
    page,
  }) => {
    await page.goto('/academics/grades')
    await expect(page.getByTestId('prior')).toContainText('CGPA')
    await page.getByRole('tab', { name: 'Calculator' }).click()
    await page.getByLabel('Simulated grade').first().selectOption('A')
    await expect(page.getByTestId('projection')).toContainText('Projected SGPA')
    await expect(page.getByText(/cannot be changed here/)).toBeVisible()
    await page.getByRole('tab', { name: 'Target Goal' }).click()
    await page.getByLabel('Target CGPA').fill('9.9')
    await expect(page.getByTestId('required')).toContainText('Not achievable')
    await audit(page, 'Target goal')
    await page.goto('/academics/attendance')
    await expect(page.getByTestId('status-DEMO-102')).toContainText('Below target')
    await expect(page.getByTestId('status-DEMO-101')).toContainText('Meets the configured target')
    await audit(page, 'Attendance planner')
  })

  test('Report an issue: a video is validated, saved on this device, previewed after a reload and removable', async ({
    page,
  }) => {
    await page.goto('/help/report?from=/calendar')
    await page.getByLabel('What happened?').fill('Projector flickers in G12')
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(2048),
    ])
    await page
      .getByLabel('Add photo or video')
      .setInputFiles({ name: 'flicker.mp4', mimeType: 'video/mp4', buffer: mp4 })
    await expect(page.getByText(/flicker\.mp4 · .* saved on this device/)).toBeVisible()
    await page
      .getByLabel('Add photo or video')
      .setInputFiles({ name: 'fake.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(100, 7) })
    await expect(page.getByRole('alert')).toContainText(/does not look like a real video/)
    await audit(page, 'Report form with evidence')
    await page.getByRole('button', { name: 'Save report' }).click()
    await expect(page.getByText(/Recorded on this device/).first()).toBeVisible()
    await page.reload()
    const rec = page.locator('[data-report]').first()
    await expect(rec).toContainText('Projector flickers in G12')
    await expect(rec.locator('video')).toHaveCount(1) // recreated from the saved file after a reload
    await expect(rec.getByText(/no longer on this device/)).toHaveCount(0)
  })

  test('Complaint and teaching-aid forms take video evidence, saved on this device and shown on the ticket', async ({
    page,
  }) => {
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(2048),
    ])
    for (const path of ['/administration/complaints/new', '/administration/teaching-aids/new']) {
      await page.goto(path)
      if (path.includes('teaching'))
        await page
          .getByLabel(/Classroom/)
          .first()
          .fill('G12')
      await page.getByLabel('Description').fill('Flickering light with a video')
      await page
        .getByLabel('Add photo or video')
        .setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: mp4 })
      await expect(page.getByText(/clip\.mp4 · .* saved on this device/)).toBeVisible()
      await page.getByRole('button', { name: /^Submit/ }).click()
      await expect(page.getByText('Photo or video evidence')).toBeVisible()
      await expect(page.locator('video')).toHaveCount(1)
      await expect(page.getByText(/not sent to any team/)).toBeVisible()
    }
  })

  test('Dark theme: chosen in Settings, kept after a reload, and the main pages still pass axe', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.getByRole('radio', { name: 'Dark' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    for (const path of [
      '/',
      '/calendar?view=agenda',
      '/bookings',
      '/services/chill-spot',
      '/academics',
      '/settings',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await audit(page, `dark ${path}`)
    }
  })

  test('CampusOS Assistant: answers with a source, refuses to act, closes with Escape', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ask CampusOS' }).click()
    const panel = page.getByRole('region', { name: 'CampusOS Assistant' })
    await panel.getByRole('button', { name: 'What is my next exam?' }).click()
    await expect(panel.getByText(/Source: Exam records/)).toBeVisible()
    await panel.getByLabel('Ask CampusOS Assistant').fill('book CR1 for me')
    await panel.getByRole('button', { name: 'Send question' }).click()
    await expect(panel.getByText(/can’t book, approve, cancel or send anything/)).toBeVisible()
    await audit(page, 'CampusOS Assistant panel')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Ask CampusOS' })).toBeFocused()
  })
})
