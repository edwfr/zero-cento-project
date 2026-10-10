import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records a package of one program, sees the "last program"
 * warning on every alert surface, then deletes the package and the warning goes.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 *   - Migration 20261010000000_add_program_package_renewals applied
 */

const LAST = /ultima scheda disponibile|last program available/i

test.describe('Trainer: program packages', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('a package of one program warns everywhere, and deleting it clears the warning', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/?]+$/)
        const traineeUrl = page.url()
        const traineeName = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? ''

        // Record a package of 1 program
        await page.getByRole('button', { name: /^(abbonamento|subscription)$/i }).click()
        await page.getByRole('button', { name: /registra rinnovo|record renewal/i }).click()
        const dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: /a schede|by programs/i }).click()
        await dialog.locator('#renewal-program-count').fill('1')
        await expect(dialog.getByTestId('renewal-balance-preview')).toBeVisible()
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        // Tab: balance line and the movement
        await expect(page.getByTestId('program-balance')).toHaveText(LAST)
        await expect(page.getByText(/pacchetto da 1 schede registrato|package of 1 programs recorded/i)).toBeVisible()

        // Profile banner
        const banner = page.getByRole('alert').filter({ hasText: LAST })
        await expect(banner).toBeVisible()

        // Athlete list icon
        await page.goto('/trainer/trainees')
        const row = page.getByRole('row').filter({ hasText: traineeName })
        await expect(row.getByRole('img', { name: LAST })).toBeVisible()

        // Subscriptions page
        await page.goto('/trainer/subscriptions')
        const list = page.getByRole('list', { name: /abbonamenti registrati|recorded subscriptions/i })
        await expect(list.getByRole('link').filter({ hasText: traineeName }).filter({ hasText: LAST })).toBeVisible()

        // Home alerts
        await page.goto('/trainer/dashboard')
        await expect(page.getByRole('link').filter({ hasText: traineeName }).filter({ hasText: LAST })).toHaveCount(1)

        // Clean up: delete the package, the banner disappears, the deletion is in the history
        await page.goto(`${traineeUrl}?tab=subscription`)
        // Target the package row: the seeded athlete may have other renewals, sorted above it
        const packageRow = page.getByRole('row').filter({ hasText: /a schede|by programs/i }).first()
        await packageRow.getByRole('button', { name: /elimina rinnovo|delete renewal/i }).click()
        await page.getByRole('dialog').getByRole('button', { name: /elimina|delete/i }).first().click()
        await expect(banner).toBeHidden()
        await expect(page.getByText(/rinnovo eliminato|renewal deleted/i)).toBeVisible()
    })
})
