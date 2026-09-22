import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records body measurements for a trainee.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 */
test.describe('Trainer: trainee measurements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('records weight and arm, then corrects the weight same day', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/]+$/)

        await page.getByRole('button', { name: /misurazioni|measurements/i }).click()
        const addButton = page.getByRole('button', { name: /nuova misurazione|new measurement/i })
        const dialog = page.getByRole('dialog')
        // Value text appears both in the summary card and in the history table: assert on the card
        const weightCard = page.getByRole('listitem', { name: /^(peso|weight)$/i })
        const armCard = page.getByRole('listitem', { name: /^(braccio|arm)$/i })

        await addButton.click()
        await dialog.locator('#measurement-weight').fill('78.5')
        await dialog.locator('#measurement-arm').fill('38.5')
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        await expect(weightCard.getByText('78.5 kg')).toBeVisible()
        await expect(armCard.getByText('38.5 cm')).toBeVisible()

        const historyRowsBefore = await page.locator('table tbody tr').count()

        // Same metric, same day: corrects instead of duplicating
        await addButton.click()
        await dialog.locator('#measurement-weight').fill('79')
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        await expect(weightCard.getByText('79 kg')).toBeVisible()
        await expect(page.locator('table tbody tr')).toHaveCount(historyRowsBefore)
    })
})
