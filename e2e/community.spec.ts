import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Community (COS-COMMUNITY-001): Lost & Found, clubs and sports teams/fixtures.
 * Everything is a labelled demo: no club officer, committee or lost-property office is involved.
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
  '/community',
  '/community/lost-found',
  '/community/lost-found/new?type=found',
  '/community/lost-found/rep-1',
  '/community/clubs',
  '/community/clubs/club-robotics?tab=connect',
  '/community/sports-events',
  '/community/sports-events?tab=create',
  '/community/sports-events/teams/team-1',
  '/community/sports-events/fixtures/fx-1',
]
for (const width of [320, 375, 768, 1440]) {
  test(`CO-AT-44 Community pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('CO-AT-24: a club conversation request works on a phone', async ({ page }) => {
    await page.goto('/community/clubs/club-quiz?tab=connect')
    await page.getByLabel('Preferred date').fill('2030-01-15')
    await page.getByLabel('Start').fill('12:00')
    await page.getByLabel('End').fill('12:30')
    await audit(page, 'Club request form (phone)')
    await page.getByRole('button', { name: 'Record request locally' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'My club requests' })).toBeVisible()
    await expect(page.getByText(/Request recorded \(not sent to anyone\)/)).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('CO-AT-08 / CO-AT-09 / CO-AT-11: a private claim is reviewed by the simulator and the item is archived', async ({
    page,
  }) => {
    await page.goto('/community/lost-found/rep-1')
    await page.getByLabel(/Something only the owner would know/).fill('blue keychain')
    await page.getByRole('button', { name: 'Request to claim' }).click()
    await expect(page.getByRole('link', { name: 'Open your claim' })).toBeVisible()
    await page.getByRole('link', { name: 'Open your claim' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your claim' })).toBeVisible()
    await expect(page.getByText(/not a real security or lost-property decision/)).toBeVisible()
    await audit(page, 'Claim page')

    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/community/lost-found')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Lost & Found simulator')
    await ops.getByRole('button', { name: 'Start review' }).click()
    await ops.getByRole('button', { name: 'Approve claim' }).click()
    await ops.getByRole('button', { name: 'Record handover' }).click()
    await expect(page.getByText('Black backpack')).toHaveCount(0)
  })

  test('CO-AT-25 / CO-AT-27 / CO-AT-37: create a team, and a join request needs the captain', async ({
    page,
  }) => {
    await page.goto('/community/sports-events?tab=create')
    await page.getByLabel('Team name').fill('Late Night Hoops')
    await page.getByRole('button', { name: 'Create team' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Late Night Hoops' })).toBeVisible()
    await expect(page.getByText(/does not reserve a court or pitch/)).toBeVisible()
    await page.goto('/community/sports-events/teams/team-1')
    await page.getByRole('button', { name: 'Request to join' }).click()
    await expect(page.getByText(/Your request is waiting for the captain/)).toBeVisible()
    await audit(page, 'Team page after a request')
  })

  test('CO-AT-34: a simulated reschedule shows one change history entry', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/community/sports-events/fixtures/fx-1')
    const ops = page.getByTestId('demo-ops')
    await ops.getByLabel('New date').fill('2030-02-01')
    await ops.getByLabel('Start').fill('10:00')
    await ops.getByLabel('End').fill('11:00')
    const row = ops.locator('li', { hasText: 'Demo Hoopers vs Demo Strikers' })
    await row.getByRole('button', { name: 'Reschedule' }).click()
    await expect(page.getByText(/Version 1 \(until/)).toBeVisible()
    await audit(page, 'Fixture after a reschedule')
  })
})
