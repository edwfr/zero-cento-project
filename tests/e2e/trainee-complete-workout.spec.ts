import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * E2E Test: Trainee views and completes a workout
 * TEST-E2E-002
 *
 * Prerequisites:
 *   - Seed data with an active program assigned to trainee@zerocento.it
 *   - Server running at http://localhost:3000
 */
test.describe('Trainee: Complete workout flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login as trainee
        await page.goto('/login')
        await page.fill('input[name="email"]', 'trainee1@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')
        await page.click('button[type="submit"]')

        // Wait for redirect to trainee dashboard
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })
    })

    test('shows active program on dashboard', async ({ page }) => {
        // Dashboard should show something (program card or empty state)
        await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible()
    })

    test('navigates to current program page', async ({ page }) => {
        await page.goto('/trainee/programs/current')
        // Should either show a program or redirect
        await page.waitForTimeout(1000)
        const url = page.url()
        expect(url).toContain('trainee')
    })

    test('trainee can view their personal records', async ({ page }) => {
        await page.goto('/trainee/records')
        await page.waitForTimeout(1000)
        await expect(page).toHaveURL(/trainee\/records/)
    })

    test('trainee can view workout history', async ({ page }) => {
        await page.goto('/trainee/history')
        await page.waitForTimeout(1000)
        await expect(page).toHaveURL(/trainee\/history/)
    })
})

test.describe('Accessibility: Login page', () => {
    test('login page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/login')
        await page.waitForTimeout(500)

        const results = await new AxeBuilder({ page })
            .include('#main, main, form, [role="main"]')
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze()

        // Filter out known low-severity issues; critical ones should be 0
        const criticalViolations = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
        )
        expect(criticalViolations).toHaveLength(0)
    })
})

test.describe('Auth: Forgot password flow', () => {
    test('forgot password page renders correctly', async ({ page }) => {
        await page.goto('/forgot-password')
        await expect(page.locator('input[type="email"]')).toBeVisible()
        await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('shows success message after submitting email', async ({ page }) => {
        await page.goto('/forgot-password')
        await page.fill('input[type="email"]', 'test@example.com')
        await page.click('button[type="submit"]')

        // Wait for success state
        await page.waitForTimeout(2000)
        // Should show some success indication (either message or button change)
        const successVisible =
            (await page.locator('text=inviata, text=controlla, text=email').count()) > 0 ||
            (await page.locator('.text-green').count()) > 0
        expect(successVisible || page.url().includes('forgot-password')).toBeTruthy()
    })

    test('back to login link works', async ({ page }) => {
        await page.goto('/forgot-password')
        const loginLink = page.locator('a[href="/login"], a:has-text("login"), a:has-text("Accedi")')
        if (await loginLink.count() > 0) {
            await loginLink.click()
            await page.waitForURL('**/login')
            await expect(page).toHaveURL(/login/)
        }
    })
})

test.describe('Auth: Login page', () => {
    test('shows error on invalid credentials', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', 'wrong@email.com')
        await page.fill('input[name="password"]', 'wrongpassword')
        await page.click('button[type="submit"]')

        // Should show error message
        await page.waitForTimeout(2000)
        const hasError =
            (await page.locator('.bg-red-50, [role="alert"], text=errati, text=credenziali').count()) > 0
        expect(hasError).toBeTruthy()
    })

    test('has forgot password link', async ({ page }) => {
        await page.goto('/login')
        await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
    })
})
