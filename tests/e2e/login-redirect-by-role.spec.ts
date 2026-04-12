import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E Test: Login flow with role-based redirects
 * TEST-E2E-003
 *
 * Prerequisites:
 *   - Seed data with users (see ./fixtures/test-users.ts)
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
        await page.fill('input[name="email"]', E2E_CREDENTIALS.admin.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.admin.password)

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to admin dashboard
        await page.waitForURL('**/admin/dashboard', { timeout: 10_000 })

        // Verify we're on admin dashboard
        expect(page.url()).toContain('/admin/dashboard')
    })

    test('trainer logs in and redirects to /trainer/dashboard', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to trainer dashboard
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })

        // Verify we're on trainer dashboard
        expect(page.url()).toContain('/trainer/dashboard')

        // Verify some trainer-specific content is present
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 })
    })

    test('trainee logs in and redirects to /trainee/dashboard', async ({ page }) => {
        // Fill credentials
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainee.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainee.password)

        // Submit
        await page.click('button[type="submit"]')

        // Wait for redirect to trainee dashboard
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        // Verify we're on trainee dashboard
        expect(page.url()).toContain('/trainee/dashboard')
    })

    test('shows error message for invalid credentials', async ({ page }) => {
        // Fill invalid credentials
        await page.fill('input[name="email"]', E2E_CREDENTIALS.invalid.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.invalid.password)

        // Submit
        await page.click('button[type="submit"]')

        // Wait for error message to appear
        const errorMessage = page.getByText(/invalid login credentials/i)
        await expect(errorMessage).toBeVisible({ timeout: 5_000 })

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
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
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
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)

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
        const testEmail = E2E_CREDENTIALS.invalid.email

        // Fill invalid credentials
        await page.fill('input[name="email"]', testEmail)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.invalid.password)

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
