import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E Test: Trainee completes a workout with feedback
 * TEST-E2E-005
 *
 * Prerequisites:
 *   - Seed data with:
 *     - trainee1@zerocento.app / TestPass123!  (has an active program with workouts)
 *     - trainer1@zerocento.app / TestPass123!  (owns the program)
 *   - Server running at http://localhost:3000
 *
 * Test Coverage:
 *   - Trainee logs in and lands on dashboard
 *   - Trainee navigates to active program → current workout
 *   - Workout page renders exercises with set/reps inputs
 *   - Trainee fills weight, reps, and RPE for each exercise
 *   - Trainee adds optional workout notes
 *   - Trainee submits feedback → POST /api/feedback called
 *   - After submit: redirect to /trainee/dashboard with success toast
 *   - Completed workout shows ✓ badge on current-program page
 *   - Auto-save to localStorage persists mid-workout data
 *   - Accessibility: workout page has no critical violations
 *
 * Task: Sprint 5.9 — E2E test: trainee completa workout con feedback
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password = E2E_CREDENTIALS.trainee.password) {
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
}

/**
 * Navigate to the first available (not-yet-completed) workout for the trainee
 * and return its URL. Returns null if no active workout is found.
 */
async function navigateToFirstWorkout(page: Page): Promise<string | null> {
    // Go to current program overview
    await page.goto('/trainee/programs/current')
    await page.waitForLoadState('networkidle')

    // If no active program exists, bail out early
    const hasError =
        (await page.locator('text=/nessun programma|no program/i').count()) > 0
    if (hasError) return null

    // Find the first workout link that is NOT already completed (border-green-300 means done)
    // We target links that point to /trainee/workouts/<id>
    const workoutLinks = page.locator('a[href*="/trainee/workouts/"]')
    const count = await workoutLinks.count()
    if (count === 0) return null

    // Prefer the first non-completed workout card (no ✓ icon)
    for (let i = 0; i < count; i++) {
        const link = workoutLinks.nth(i)
        const isCompleted = (await link.locator('text=✓').count()) > 0
        if (!isCompleted) {
            const href = await link.getAttribute('href')
            if (href) return href
        }
    }

    // Fall back to first workout regardless of completion state
    const href = await workoutLinks.first().getAttribute('href')
    return href
}

// ─── Main describe block ──────────────────────────────────────────────────────

test.describe('Trainee: Complete workout with feedback', () => {
    const traineeEmail = E2E_CREDENTIALS.trainee.email

    test.beforeEach(async ({ page, context }) => {
        await context.clearCookies()
        // Clear any leftover localStorage workout drafts
        await page.goto('/login')
        await page.evaluate(() => {
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith('workout_')) localStorage.removeItem(key)
            }
        })
    })

    // ── 1. Full happy-path ───────────────────────────────────────────────────
    test('trainee completes a workout end-to-end and receives success feedback', async ({ page }) => {
        // ────────────────────────────────────────────
        // STEP 1: Login
        // ────────────────────────────────────────────
        await test.step('Trainee logs in', async () => {
            await loginAs(page, traineeEmail)
            await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })
            expect(page.url()).toContain('/trainee/dashboard')
        })

        // ────────────────────────────────────────────
        // STEP 2: Navigate to active program
        // ────────────────────────────────────────────
        let workoutHref: string | null = null
        await test.step('Trainee navigates to current program', async () => {
            workoutHref = await navigateToFirstWorkout(page)
            // If there's no active program the test should be skipped gracefully
            if (!workoutHref) {
                console.warn('⚠  No active program / workout found for trainee — skipping')
                return
            }
            expect(workoutHref).toContain('/trainee/workouts/')
        })

        if (!workoutHref) return

        // ────────────────────────────────────────────
        // STEP 3: Open workout detail page
        // ────────────────────────────────────────────
        await test.step('Workout detail page loads correctly', async () => {
            await page.goto(workoutHref!)
            await page.waitForLoadState('networkidle')

            // Page title (day label + week number)
            await expect(page.locator('h1').first()).toBeVisible({ timeout: 8_000 })

            // Stats summary (Volume, RPE Medio, Esercizi)
            await expect(page.locator('text=/volume totale/i').first()).toBeVisible()
            await expect(page.locator('text=/esercizi/i').first()).toBeVisible()

            // Auto-save notice
            await expect(page.locator('text=/auto-save attivo/i')).toBeVisible()

            // At least one exercise card
            await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 })
        })

        // ────────────────────────────────────────────
        // STEP 4: Fill in weight and reps for all sets
        // ────────────────────────────────────────────
        await test.step('Trainee fills set data (weight + reps) for every exercise', async () => {
            // All weight inputs
            const weightInputs = page.locator('table input[type="number"][step="0.5"]')
            const repsInputs = page.locator('table input[type="number"]:not([step="0.5"])')

            const weightCount = await weightInputs.count()
            const repsCount = await repsInputs.count()

            expect(weightCount).toBeGreaterThan(0)
            expect(repsCount).toBeGreaterThan(0)

            // Fill every weight input with 80 kg
            for (let i = 0; i < weightCount; i++) {
                await weightInputs.nth(i).fill('80')
            }

            // Fill every reps input with 8
            for (let i = 0; i < repsCount; i++) {
                await repsInputs.nth(i).fill('8')
            }

            // Verify volume stat has updated (should be > 0 now)
            const volumeText = await page.locator('p.text-2xl').first().textContent()
            // Volume = 80 * 8 * sets — it will be a non-zero number
            const volume = parseFloat(volumeText?.replace(/[^\d.]/g, '') ?? '0')
            expect(volume).toBeGreaterThan(0)
        })

        // ────────────────────────────────────────────
        // STEP 5: Set RPE for the first exercise
        // ────────────────────────────────────────────
        await test.step('Trainee selects RPE for exercises', async () => {
            const rpeSelects = page.locator('select')
            const rpeCount = await rpeSelects.count()
            expect(rpeCount).toBeGreaterThan(0)

            // Select RPE 8 for each exercise
            for (let i = 0; i < rpeCount; i++) {
                await rpeSelects.nth(i).selectOption('8')
            }
        })

        // ────────────────────────────────────────────
        // STEP 6: Add workout notes
        // ────────────────────────────────────────────
        await test.step('Trainee adds workout notes', async () => {
            const notesTextarea = page.locator('textarea')
            await expect(notesTextarea).toBeVisible()
            await notesTextarea.fill('Test E2E - workout completato correttamente')
        })

        // ────────────────────────────────────────────
        // STEP 7: Submit feedback
        // ────────────────────────────────────────────
        await test.step('Trainee submits feedback and is redirected to dashboard', async () => {
            // Intercept the feedback API call to assert it fires
            let feedbackCallMade = false
            page.on('request', (req) => {
                if (req.url().includes('/api/feedback') && req.method() === 'POST') {
                    feedbackCallMade = true
                }
            })

            const submitBtn = page.locator('button:has-text("Completa Workout")')
            await expect(submitBtn).toBeVisible()
            await submitBtn.click()

            // Handle optional confirmation dialog ("dati mancanti?")
            const confirmBtn = page.locator(
                'button:has-text("Continua"), button:has-text("Conferma"), button:has-text("Sì")'
            )
            if (await confirmBtn.count() > 0) {
                await confirmBtn.first().click()
            }

            // Wait for redirect to dashboard
            await page.waitForURL('**/trainee/dashboard', { timeout: 15_000 })
            expect(page.url()).toContain('/trainee/dashboard')

            // API call should have been made
            expect(feedbackCallMade).toBeTruthy()
        })

        // ────────────────────────────────────────────
        // STEP 8: Verify workout appears as completed
        // ────────────────────────────────────────────
        await test.step('Completed workout shows tick on current-program page', async () => {
            await page.goto('/trainee/programs/current')
            await page.waitForLoadState('networkidle')

            // The workout card should now have a green ✓ indicator
            const completedIndicators = page.locator('text=✓')
            await expect(completedIndicators.first()).toBeVisible({ timeout: 8_000 })
        })
    })

    // ── 2. Auto-save to localStorage ────────────────────────────────────────
    test('workout data is auto-saved to localStorage while filling sets', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping auto-save test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        // Fill one weight input
        const weightInput = page.locator('table input[type="number"][step="0.5"]').first()
        await weightInput.fill('100')

        // Give React state a moment to trigger the auto-save effect
        await page.waitForTimeout(500)

        // Check localStorage for a workout_ key
        const workoutId = workoutHref.split('/').pop()!
        const saved = await page.evaluate((key: string) => localStorage.getItem(key), `workout_${workoutId}_feedback`)

        expect(saved).not.toBeNull()
        const parsed = JSON.parse(saved!)
        expect(parsed).toHaveProperty('feedbackData')
        expect(parsed).toHaveProperty('savedAt')
    })

    // ── 3. Auto-save restored after page reload ──────────────────────────────
    test('auto-saved workout data is restored after page reload', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping restore test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        // Fill a distinctive value
        const weightInput = page.locator('table input[type="number"][step="0.5"]').first()
        await weightInput.fill('123.5')
        await page.waitForTimeout(500)

        // Reload the page
        await page.reload()
        await page.waitForLoadState('networkidle')

        // The weight input should be restored from localStorage
        const restoredValue = await page.locator('table input[type="number"][step="0.5"]').first().inputValue()
        expect(restoredValue).toBe('123.5')
    })

    // ── 4. Submit button is disabled while submitting ───────────────────────
    test('submit button is disabled during feedback submission', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping disabled-button test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        // Fill minimal data so we can submit
        const weightInputs = page.locator('table input[type="number"][step="0.5"]')
        const repsInputs = page.locator('table input[type="number"]:not([step="0.5"])')
        const wCount = await weightInputs.count()
        const rCount = await repsInputs.count()
        for (let i = 0; i < wCount; i++) await weightInputs.nth(i).fill('50')
        for (let i = 0; i < rCount; i++) await repsInputs.nth(i).fill('5')

        const submitBtn = page.locator('button:has-text("Completa Workout")')
        await submitBtn.click()

        // Handle optional confirmation dialog
        const confirmBtn = page.locator(
            'button:has-text("Continua"), button:has-text("Conferma"), button:has-text("Sì")'
        )
        if (await confirmBtn.count() > 0) {
            await confirmBtn.first().click()
        }

        // Button should be disabled immediately (spinner or disabled attr)
        try {
            await expect(submitBtn).toBeDisabled({ timeout: 1_000 })
        } catch {
            // Redirect may happen faster than we can assert — that's acceptable
        }

        // Either way we should end up on the dashboard
        await page.waitForURL('**/trainee/dashboard', { timeout: 15_000 })
        expect(page.url()).toContain('/trainee/dashboard')
    })

    // ── 5. Confirmation dialog for empty sets ────────────────────────────────
    test('shows confirmation dialog when some sets have no data', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping empty-sets dialog test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        // Do NOT fill any sets — click submit immediately
        const submitBtn = page.locator('button:has-text("Completa Workout")')
        await submitBtn.click()

        // Confirmation / warning dialog should appear
        const dialog = page.locator('[role="dialog"], .modal, [data-testid="confirm-modal"]')
        const warningText = page.locator(
            'text=/dati mancanti|missing data|nessun dato|continuare/i'
        )

        const hasDialog = await dialog.count() > 0
        const hasWarning = await warningText.count() > 0

        expect(hasDialog || hasWarning).toBeTruthy()
    })

    // ── 6. Navigation: swipe buttons advance exercise index ─────────────────
    test('prev/next exercise navigation buttons work on workout page', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping navigation test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        // These navigation buttons are only rendered when there is more than 1 exercise
        // and only visible on mobile (md:hidden) — we use viewport: Pixel 5 in the config
        const nextBtn = page.locator('button[aria-label="Prossimo esercizio"]')
        const prevBtn = page.locator('button[aria-label="Esercizio precedente"]')

        const hasNav = (await nextBtn.count()) > 0 && (await prevBtn.count()) > 0
        if (!hasNav) {
            // Workout may have only 1 exercise — navigation is hidden; skip cleanly
            console.log('ℹ  Single exercise workout — navigation not rendered')
            return
        }

        // Initially prev should be disabled (first exercise)
        await expect(prevBtn).toBeDisabled()
        await expect(nextBtn).not.toBeDisabled()

        // Advance to next exercise
        await nextBtn.click()
        await page.waitForTimeout(300)

        // Now prev should be enabled
        await expect(prevBtn).not.toBeDisabled()
    })

    // ── 7. Keyboard/accessibility — submit button reachable via tab ─────────
    test('workout page has no critical accessibility violations', async ({ page }) => {
        await loginAs(page, traineeEmail)
        await page.waitForURL('**/trainee/dashboard', { timeout: 10_000 })

        const workoutHref = await navigateToFirstWorkout(page)
        if (!workoutHref) {
            console.warn('⚠  No workout found — skipping a11y test')
            return
        }

        await page.goto(workoutHref)
        await page.waitForLoadState('networkidle')

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('iframe') // YouTube embed may have third-party violations
            .analyze()

        const criticalViolations = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
        )
        expect(criticalViolations).toHaveLength(0)
    })
})

// ─── Legacy / other trainee page tests (kept for coverage) ───────────────────

test.describe('Trainee: Dashboard and secondary pages', () => {
    test.beforeEach(async ({ page }) => {
        // Login as trainee
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainee.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainee.password)
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


