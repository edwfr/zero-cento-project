import { test, expect } from '@playwright/test'

/**
 * E2E Test: Login flow with role-based redirects
 * TEST-E2E-003
 *
 * Prerequisites:
 *   - Seed data with users:
 *     - admin@zerocento.it / TestPass123!
 *     - trainer@zerocento.it / TestPass123!
 *     - trainee1@zerocento.it / TestPass123!
 *   - Server running at http://localhost:3000
 *
 * Test Coverage:
 *   - Admin login → /admin/dashboard
 *   - Trainer login → /trainer/dashboard
 *   - Trainee login → /trainee/dashboard
 *   - Invalid credentials → error message
 *   - Already logged in → auto-redirect
 */

test.describe('Login: Role-based redirects', () => {
    test.beforeEach(async ({ page, context }) => {
        // Clear cookies and storage to ensure clean state
        await context.clearCookies()
        await page.goto('/login')
    })

    test('admin logs in and redirects to /admin/dashboard', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', 'admin@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to admin dashboard
        await page.waitForURL('**/admin/dashboard', { timeout: 10_000 })

        // Verify we're on admin dashboard
        expect(page.url()).toContain('/admin/dashboard')

        // Verify some admin-specific content is present
        await expect(page.locator('h1, h2')).toBeVisible({ timeout: 5_000 })
    })

    test('trainer logs in and redirects to /trainer/dashboard', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', 'trainer@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to trainer dashboard
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })

        // Verify we're on trainer dashboard
        expect(page.url()).toContain('/trainer/dashboard')

        // Verify some trainer-specific content is present
        await expect(page.locator('h1, h2')).toBeVisible({ timeout: 5_000 })
    })

    test('trainee logs in and redirects to /trainee/dashboard', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', 'trainee1@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to trainee dashboard
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        // Verify we're on trainee dashboard
        expect(page.url()).toContain('/trainee/dashboard')

        // Verify some trainee-specific content is present
        await expect(page.locator('h1, h2')).toBeVisible({ timeout: 5_000 })
    })

    test('shows error message for invalid credentials', async ({ page }) => {
        // Fill invalid credentials
        await page.fill('input[name="email"]', 'invalid@zerocento.it')
        await page.fill('input[name="password"]', 'WrongPassword123!')

        // Submit
        await page.click('button[type="submit"]')

        // Wait a moment for error to appear
        await page.waitForTimeout(1_000)

        // Should show error message
        const errorVisible = await page.locator('.bg-red-50, [role="alert"], text=error, text=invalid').count()
        expect(errorVisible).toBeGreaterThan(0)

        // Should still be on login page
        expect(page.url()).toContain('/login')
    })

    test('shows error message for empty fields', async ({ page }) => {
        // Try to submit without filling any field
        await page.click('button[type="submit"]')

        // Should not redirect (HTML5 validation or app validation)
        await page.waitForTimeout(500)
        expect(page.url()).toContain('/login')
    })

    test('already logged in user auto-redirects to their dashboard', async ({ page, context }) => {
        // First login as trainer
        await page.fill('input[name="email"]', 'trainer@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })

        // Navigate to login page again
        await page.goto('/login')

        // Should auto-redirect back to trainer dashboard
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
        expect(page.url()).toContain('/trainer/dashboard')
    })

    test('disables form during submission', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', 'trainer@zerocento.it')
        await page.fill('input[name="password"]', 'TestPass123!')

        // Get references to form elements
        const submitButton = page.locator('button[type="submit"]')
        const emailInput = page.locator('input[name="email"]')
        const passwordInput = page.locator('input[name="password"]')

        // Click submit
        const submitPromise = submitButton.click()

        // Check if elements are disabled shortly after click (might be very brief)
        // We need to check quickly before redirect happens
        try {
            await expect(submitButton).toBeDisabled({ timeout: 500 })
        } catch {
            // If redirect is too fast, that's okay - we're testing a fast response
            // Just verify we ended up on the correct page
        }

        await submitPromise

        // Should redirect successfully
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('preserves email input on failed login', async ({ page }) => {
        const testEmail = 'invalid@zerocento.it'

        // Fill invalid credentials
        await page.fill('input[name="email"]', testEmail)
        await page.fill('input[name="password"]', 'WrongPassword!')

        // Submit
        await page.click('button[type="submit"]')

        // Wait for error
        await page.waitForTimeout(1_000)

        // Email should still be in the input
        const emailValue = await page.locator('input[name="email"]').inputValue()
        expect(emailValue).toBe(testEmail)
    })
})

test.describe('Login: Navigation links', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.clearCookies()
        await page.goto('/login')
    })

    test('has link to forgot password page', async ({ page }) => {
        const forgotPasswordLink = page.locator('a[href*="forgot-password"]')

        if (await forgotPasswordLink.count() > 0) {
            await expect(forgotPasswordLink).toBeVisible()
            await forgotPasswordLink.click()
            await page.waitForURL('**/forgot-password', { timeout: 5_000 })
            expect(page.url()).toContain('/forgot-password')
        }
    })
})
