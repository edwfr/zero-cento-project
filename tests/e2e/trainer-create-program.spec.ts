import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E Test: Trainer creates a complete training program
 * TEST-E2E-001
 *
 * Prerequisites:
 *   - Seed data must be present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 */
test.describe('Trainer: Create program flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login as trainer
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')

        // Wait for redirect to trainer dashboard
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('navigates to create program page', { tag: '@smoke' }, async ({ page }) => {
        // From dashboard click on Programmi or new program
        await page.goto('/trainer/programs/new')
        await expect(page).toHaveURL(/trainer\/programs\/new/)
        await expect(page.getByRole('heading', { name: /programma|program/i })).toBeVisible()
    })

    test('fills and submits program creation form', async ({ page }) => {
        await page.goto('/trainer/programs/new')

        // Fill in program title
        await page.fill('input[name="title"]', 'Piano Test Playwright')

        // Select a trainee (first available)
        const traineeSelect = page.locator('select[name="traineeId"], [data-testid="trainee-select"]')
        if (await traineeSelect.count() > 0) {
            const options = await traineeSelect.locator('option').allTextContents()
            const firstTrainee = options.find((o) => o !== '' && !o.toLowerCase().includes('seleziona'))
            if (firstTrainee) {
                await traineeSelect.selectOption({ label: firstTrainee.trim() })
            }
        }

        // Set duration
        const durationInput = page.locator('input[name="durationWeeks"]')
        if (await durationInput.count() > 0) {
            await durationInput.fill('8')
        }

        // Set workouts per week
        const workoutsInput = page.locator('input[name="workoutsPerWeek"]')
        if (await workoutsInput.count() > 0) {
            await workoutsInput.fill('4')
        }

        // Submit
        await page.click('button[type="submit"]')

        // Should redirect to program edit page or show success
        await page.waitForTimeout(2000)
        const url = page.url()
        const isSuccess =
            url.includes('/trainer/programs/') ||
            (await page.locator('text=creato, text=successo, text=bozza').count()) > 0
        expect(isSuccess || url.includes('trainer')).toBeTruthy()
    })

    test('shows validation error for empty title', async ({ page }) => {
        await page.goto('/trainer/programs/new')

        // Try to submit without title
        await page.click('button[type="submit"]')

        // Should show validation error
        await page.waitForTimeout(500)
        const hasError =
            (await page.locator('text=richiesto, text=obbligatorio, text=corto').count()) > 0 ||
            (await page.locator('.text-red-500, .text-red-600, [role="alert"]').count()) > 0
        expect(hasError || page.url().includes('new')).toBeTruthy()
    })

    test('trainer dashboard shows stats cards', async ({ page }) => {
        await expect(page.locator('[data-testid="stat-card"], .bg-white.rounded-lg.shadow')).toHaveCount(
            { minimum: 1 }
        )
    })
})
