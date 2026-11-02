import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Administration (COS-ADMIN-001): leave and out-time, facility complaints and teaching-aid reports.
 * Everything is a labelled demo: no office, guard or maintenance team is involved.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function audit(page: Page, label: string) {
  await page.waitForTimeout(500) // let a fading toast finish so contrast is measured on settled colours
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
  '/administration',
  '/administration/leave',
  '/administration/leave/new',
  '/administration/complaints',
  '/administration/complaints/new',
  '/administration/teaching-aids',
  '/administration/teaching-aids/new',
  '/administration/requests',
]

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`AD-AT-38 Administration pages have no horizontal overflow at ${width}px`, async ({
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

async function enableOps(page: Page) {
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('AD-AT-38 / AD-AT-39: a complaint can be submitted on a phone and its timeline stays readable', async ({
    page,
  }) => {
    await page.goto('/administration/complaints/new')
    await page.getByLabel('Location (optional)').fill('Sample Block')
    await page.getByLabel('Description').fill('Tap keeps dripping')
    await audit(page, 'New complaint (phone)')
    await page.getByRole('button', { name: 'Submit demo ticket' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Plumbing ticket' })).toBeVisible()
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Timeline' }).getByText('submitted'),
    ).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
    await audit(page, 'Complaint detail (phone)')
  })

  test('AD-AT-38: the leave form works on a phone, with a review step and no clipping', async ({
    page,
  }) => {
    await page.goto('/administration/leave/new')
    await page.getByLabel('Reason').fill('Family visit')
    await page.getByRole('button', { name: 'Review request' }).click()
    await expect(page.getByText('Review your local request')).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
    await audit(page, 'Leave review (phone)')
    await page.getByRole('button', { name: 'Submit local request' }).click()
    await expect(page.getByText(/Saved on this device as leave-/)).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('AD-AT-37: a keyboard-only user can submit a complaint and inspect its timeline', async ({
    page,
  }) => {
    await page.goto('/administration/complaints/new')
    await page.getByLabel('Description').focus()
    await page.keyboard.type('Light flickers in the corridor')
    const submit = page.getByRole('button', { name: 'Submit demo ticket' })
    await submit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: /ticket$/ })).toBeVisible()
    const timeline = page.getByRole('region', { name: 'Timeline' })
    await expect(timeline).toBeVisible()
    await expect(timeline.getByText('submitted')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
  })

  test('AD-AT-06 / AD-AT-07 / AD-AT-11 / AD-AT-12: the simulator reviews, approves and logs gate steps separately, always as demo', async ({
    page,
  }) => {
    await page.goto('/administration/leave/new')
    await page.getByLabel('Reason').fill('Family visit')
    await page.getByRole('button', { name: 'Review request' }).click()
    await page.getByRole('button', { name: 'Submit local request' }).click()
    await expect(page.getByText(/Saved on this device as leave-/)).toBeVisible()
    await expect(page.getByRole('button', { name: /approve|start review/i })).toHaveCount(0)

    await enableOps(page)
    await page.goto('/administration/leave')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Administration simulator')
    await ops.getByRole('button', { name: 'Start review' }).click()
    await ops.getByRole('button', { name: 'Approve locally' }).click()
    await ops.getByRole('button', { name: 'Demo Gate' }).click()
    await ops.getByRole('button', { name: 'Log departure' }).click()
    await page.getByRole('link', { name: 'Open request' }).click()
    await expect(page.getByText('Departure logged locally').first()).toBeVisible()
    await expect(page.getByText(/NOT A VALID GATE PASS|not a valid campus/i).first()).toBeVisible()
    await audit(page, 'Leave detail after a simulated departure')
  })

  test('AD-AT-31: a transition notification opens the exact request', async ({ page }) => {
    await page.goto('/administration/complaints/new')
    await page.getByLabel('Description').fill('Wi-Fi drops in the lab')
    await page.getByRole('button', { name: 'Submit demo ticket' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /ticket$/ })).toBeVisible()
    await page.goto('/notifications')
    await page.getByRole('link', { name: 'Open: Ticket recorded in CampusOS demo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /ticket$/ })).toBeVisible()
    await expect(page).toHaveURL(/\/administration\/complaints\/ticket-/)
  })

  test('AD-AT-20: a resolved ticket is reopened on the same ticket from the student side', async ({
    page,
  }) => {
    await page.goto('/administration/teaching-aids/new')
    await page.getByLabel('Classroom').fill('Room 12')
    await page.getByLabel('Description').fill('Projector shows no signal')
    await page.getByRole('button', { name: 'Submit equipment report' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Projector report' })).toBeVisible()
    const url = page.url().split('?')[0]!
    await enableOps(page)
    await page.goto('/administration/teaching-aids')
    const ops = page.getByTestId('demo-ops')
    await ops.getByRole('button', { name: 'Demo Maintenance' }).click()
    await ops.getByRole('button', { name: 'Assign' }).click()
    await ops.getByRole('button', { name: 'Start work' }).click()
    await ops.getByRole('button', { name: 'Mark resolved' }).click()
    await page.goto(url)
    await page.getByRole('button', { name: 'It is not fixed: reopen' }).click()
    await page.getByLabel('What is still wrong?').fill('Still no signal')
    await page.getByRole('button', { name: 'Reopen ticket' }).click()
    await expect(page.getByText('Reopened', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('region', { name: 'Timeline' }).getByText('resolve')).toBeVisible()
    await expect(page).toHaveURL(url)
    await audit(page, 'Reopened teaching-aid ticket')
  })

  test('AD-AT-33: the scoped Administration reset leaves other services alone', async ({
    page,
  }) => {
    await page.goto('/administration/complaints/new')
    await page.getByLabel('Description').fill('Wi-Fi drops')
    await page.getByRole('button', { name: 'Submit demo ticket' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /ticket$/ })).toBeVisible()
    await enableOps(page)
    await page.goto('/services/parcels')
    await page.getByTestId('demo-ops').getByRole('button', { name: 'Log parcel' }).click()
    await page.goto('/administration/requests')
    await page
      .getByTestId('demo-ops')
      .getByRole('button', { name: 'Reset Administration local records…' })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Reset Administration records' })
      .click()
    await expect(page.getByText(/You have not made any requests yet/)).toBeVisible()
    await page.goto('/services/parcels')
    await expect(page.getByRole('link', { name: /Collect parcel details/ })).toBeVisible()
  })
})
