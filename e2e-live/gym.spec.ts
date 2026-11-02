import { expect, test } from '@playwright/test'

test('gym offers 32 half-hour slots from 6 AM to 10 PM on desktop and mobile', async ({ page }) => {
  await page.goto('/bookings/gym')
  await expect(page.getByRole('heading', { level: 1, name: 'Gym' })).toBeVisible()
  const date = page.getByLabel('Date', { exact: true })
  // Tomorrow remains bookable regardless of the time the smoke check runs.
  await date.selectOption({ index: 1 })
  const slots = page.getByRole('group', { name: /Published slots for/ })
  await expect(slots.getByRole('button')).toHaveCount(32)
  await expect(slots.getByRole('button', { name: '6:00 am', exact: true })).toBeEnabled()
  await slots.getByRole('button', { name: '9:30 pm', exact: true }).click()
  await expect(page.getByText(/Review: Demo gym/)).toContainText('10:00 pm')
  await page.getByRole('button', { name: 'Confirm demo reservation' }).click()
  await expect(slots.getByRole('button', { name: '9:30 pm · yours', exact: true })).toBeDisabled()
  await page.reload()
  await date.selectOption({ index: 1 })
  await expect(slots.getByRole('button', { name: '9:30 pm · yours', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(slots).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  )
})
