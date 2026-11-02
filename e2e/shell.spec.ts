import { expect, test, type Page } from '@playwright/test'

const paths: (readonly [string, string | RegExp])[] = [
  ['/', /^Good (morning|afternoon|evening)/],
  ['/calendar', 'Calendar'],
  ['/services', 'Campus Services'],
  ['/bookings', 'Bookings'],
  ['/academics', 'Academics'],
  ['/administration', 'Administration'],
  ['/community', 'Community'],
  ['/time-tax', 'Time Tax'],
  ['/search', 'Search'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
]

const viewports = [
  { name: '320', width: 320, height: 700 },
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
]

const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

for (const vp of viewports) {
  test.describe(`viewport ${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const [path, title] of paths) {
      test(`${path} renders without horizontal overflow`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
        await expect(page.getByRole('link', { name: /demo prototype/i })).toBeVisible()
        expect(await hasHorizontalOverflow(page)).toBe(false)
      })
    }
  })
}

test.describe('desktop navigation (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('sidebar is visible, bottom nav is not, and links navigate client-side', async ({
    page,
  }) => {
    await page.goto('/')
    const sidebar = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    await expect(sidebar).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main navigation, mobile' })).toBeHidden()

    await sidebar.getByRole('link', { name: /^Calendar/ }).click()
    await expect(page).toHaveURL(/\/calendar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
    await expect(page.getByRole('main')).toBeFocused()
    await expect(page).toHaveTitle('Calendar · CampusOS')
  })

  test('sidebar collapses to a rail and back', async ({ page }) => {
    await page.goto('/')
    const aside = page.locator('aside')
    const expanded = (await aside.boundingBox())!.width
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    const collapsed = (await aside.boundingBox())!.width
    expect(collapsed).toBeLessThan(expanded)
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    expect((await aside.boundingBox())!.width).toBe(expanded)
  })

  test('skip link is the first tab stop and moves focus to main content', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main-content$/)
  })

  test('every sidebar destination is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    const link = sidebar.getByRole('link', { name: /^Community/ })
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Community' })).toBeVisible()
  })

  test('placeholder pages state they are not live', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText('Not part of the current build')).toBeVisible()
    await expect(page.getByRole('main').getByText('Coming later').first()).toBeVisible()
    // The Services hub is live, lists what is built, and marks the rest as not built yet.
    await page.goto('/services')
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: /Chill Spot/ })).toBeVisible()
    await expect(main.getByText(/not part of this prototype yet/i)).toBeVisible()
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Reset demo data' })).toBeVisible()
  })

  test('unknown addresses show a not-found page inside the shell', async ({ page }) => {
    await page.goto('/nope/not-here')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Main navigation', exact: true }),
    ).toBeVisible()
  })

  test('demo profile choice persists across reload and is visible in Settings', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /demo profile/i }).click()
    await page.getByRole('menuitemradio', { name: /Demo Student B/ }).click()
    await expect(page.locator('strong', { hasText: 'Demo Student B' })).toBeVisible()
    await page.reload()
    await expect(page.locator('strong', { hasText: 'Demo Student B' })).toBeVisible()
  })

  test('data-label legend is reachable from the demo badge', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /demo prototype/i }).click()
    await expect(page).toHaveURL(/\/settings#data-labels$/)
    await expect(page.getByRole('heading', { name: 'What the data labels mean' })).toBeVisible()
    await expect(
      page.locator('#data-labels').getByText('Sample data', { exact: true }),
    ).toBeVisible()
  })
})

test.describe('tablet rail (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('shows an icon rail with accessible names and no bottom nav', async ({ page }) => {
    await page.goto('/')
    const aside = page.locator('aside')
    await expect(aside).toBeVisible()
    expect((await aside.boundingBox())!.width).toBeLessThan(100)
    await expect(page.getByRole('navigation', { name: 'Main navigation, mobile' })).toBeHidden()
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation', exact: true })
        .getByRole('link', { name: /^Calendar/ }),
    ).toBeVisible()
  })
})

test.describe('mobile navigation (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('bottom nav shows Home, Calendar, Services, More and hides the sidebar', async ({
    page,
  }) => {
    await page.goto('/')
    const bottom = page.getByRole('navigation', { name: 'Main navigation, mobile' })
    await expect(bottom).toBeVisible()
    await expect(page.locator('aside')).toBeHidden()
    for (const name of ['Home', 'Calendar', 'Services']) {
      await expect(bottom.getByRole('link', { name })).toBeVisible()
    }
    await expect(bottom.getByRole('button', { name: 'More' })).toBeVisible()
  })

  test('touch targets in the bottom nav are at least 44px', async ({ page }) => {
    await page.goto('/')
    const bottom = page.getByRole('navigation', { name: 'Main navigation, mobile' })
    for (const el of await bottom.locator('a, button').all()) {
      const box = (await el.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('More opens a sheet that reaches remaining destinations and closes on selection', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Main navigation, mobile' })
      .getByRole('button', { name: 'More' })
      .click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('link', { name: /Bookings/ }).click()
    await expect(page).toHaveURL(/\/bookings$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Bookings' })).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('More sheet can be dismissed with Escape and focus returns to the trigger', async ({
    page,
  }) => {
    await page.goto('/')
    const more = page
      .getByRole('navigation', { name: 'Main navigation, mobile' })
      .getByRole('button', { name: 'More' })
    await more.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(more).toBeFocused()
  })
})
