import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: the trainer home renders its header and every widget, whatever the data.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 */
test.describe('Trainer: home', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('shows the greeting, quick actions and every widget', { tag: '@smoke' }, async ({ page }) => {
        await expect(
            page.getByRole('heading', { level: 1, name: /buongiorno|buon pomeriggio|buonasera|good (morning|afternoon|evening)/i }),
        ).toBeVisible()
        await expect(page.getByRole('link', { name: /nuovo programma|new program/i })).toHaveAttribute('href', '/trainer/programs/new')

        for (const name of [/da fare oggi|to do today/i, /atleti inattivi|inactive athletes/i, /feedback recenti|recent feedback/i]) {
            const region = page.getByRole('region', { name })
            await expect(region).toBeVisible()
            await expect(region.getByRole('alert')).toHaveCount(0)
        }
    })

    test('quick action opens the new program page', async ({ page }) => {
        await page.getByRole('link', { name: /nuovo programma|new program/i }).click()
        await page.waitForURL('**/trainer/programs/new')
    })
})
