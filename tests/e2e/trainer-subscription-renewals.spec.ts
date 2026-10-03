import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records a renewal expiring within 14 days and sees the alert
 * in the profile, the athlete list, the subscriptions page and the home KPI.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 *   - Migration 20261003000000_add_subscription_renewals applied
 */

/** start = today − 20 days, 1 month → ends 8–11 days from today: always "expiring". */
function expiringStartDate(): string {
    const start = new Date()
    start.setDate(start.getDate() - 20)
    const pad = (value: number) => String(value).padStart(2, '0')
    // The form takes Italian dd/MM/yyyy
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`
}

test.describe('Trainer: subscription renewals', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('an expiring renewal shows up everywhere, and deleting it clears the alert', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/?]+$/)
        const traineeUrl = page.url()
        const traineeName = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? ''

        // Record the renewal
        await page.getByRole('button', { name: /^(abbonamento|subscription)$/i }).click()
        const dialog = page.getByRole('dialog')
        await page.getByRole('button', { name: /registra rinnovo|record renewal/i }).click()
        await dialog.locator('#renewal-start-date').fill(expiringStartDate())
        await dialog.locator('#renewal-duration').fill('1')
        await expect(dialog.getByTestId('renewal-end-preview')).toBeVisible()
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        // Profile banner
        const banner = page.getByRole('alert').filter({ hasText: /scade il|expires on/i })
        await expect(banner).toBeVisible()

        // Athlete list badge
        await page.goto('/trainer/trainees')
        const row = page.getByRole('row').filter({ hasText: traineeName })
        await expect(row.getByText(/scade il|expires on/i)).toBeVisible()

        // Subscriptions page (via the hamburger menu entry's URL), deep link back to the tab
        await page.goto('/trainer/subscriptions')
        const list = page.getByRole('list', { name: /abbonamenti registrati|recorded subscriptions/i })
        const entry = list.getByRole('link').filter({ hasText: traineeName })
        await expect(entry).toBeVisible()
        await expect(entry).toHaveAttribute('href', /\?tab=subscription$/)

        // Home KPI counts at least this athlete
        await page.goto('/trainer/dashboard')
        const kpi = page.getByRole('link', { name: /abbonamenti|subscriptions/i }).filter({ hasText: /in scadenza|expiring/i })
        await expect(kpi).toBeVisible()
        await expect(kpi.locator('span.text-3xl')).not.toHaveText('0')

        // Clean up: delete the renewal, the banner disappears
        await page.goto(`${traineeUrl}?tab=subscription`)
        await page.getByRole('button', { name: /elimina rinnovo|delete renewal/i }).first().click()
        // Confirm button is first in ConfirmationModal; its label is "<confirm> - <title>"
        await page.getByRole('dialog').getByRole('button', { name: /elimina|delete/i }).first().click()
        await expect(banner).toBeHidden()
    })
})
