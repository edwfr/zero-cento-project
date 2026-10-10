import { test, expect, type Page } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: a trainer defines a phase in the profile, plans a macro period for a
 * trainee on the timeline, reshapes it by dragging, and cleans up.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Migration 20261011000000_add_macro_periods applied
 *   - Server running at http://localhost:3000
 */

const PHASE_NAME = `E2E fase ${Date.now()}`

const periodBars = (page: Page) => page.locator('.rct-item[data-kind="period"]')

async function openFirstTrainee(page: Page) {
    await page.goto('/trainer/trainees')
    await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
    await page.waitForURL(/\/trainer\/trainees\/[^/]+$/)
}

/** Leftovers of an interrupted run would overlap the period this test creates. */
async function deleteVisiblePeriods(page: Page) {
    while ((await periodBars(page).count()) > 0) {
        const before = await periodBars(page).count()
        await periodBars(page).first().click()
        await page.getByRole('dialog').getByRole('button', { name: /elimina periodo|delete period/i }).click()
        await page.getByRole('button', { name: /elimina periodo|delete period/i }).last().click()
        await expect(periodBars(page)).toHaveCount(before - 1)
    }
}

test.describe('Trainer: macro-period planning', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('defines a phase, plans a period, drags it, then cleans up', async ({ page }) => {
        // 1. A phase of the trainer's own, with a meaning and a colour
        await page.goto('/profile')
        await page.getByRole('button', { name: /aggiungi fase|add phase/i }).click()
        await page.locator('#phase-new-name').fill(PHASE_NAME)
        await page.locator('#phase-new-description').fill('Fase creata dal test')
        await page.getByRole('button', { name: /crea fase|create phase/i }).click()
        await expect(page.getByRole('listitem', { name: PHASE_NAME })).toBeVisible()

        // 2. The plan is the first thing shown for a trainee
        await openFirstTrainee(page)
        await expect(page.getByRole('button', { name: /^(pianificazione|planning)$/i })).toHaveAttribute('aria-pressed', 'true')
        await expect(page.locator('.rct-scroll')).toBeVisible()
        await deleteVisiblePeriods(page)

        // 3. Create a period from the dialog (default: four weeks from the current one)
        await page.getByRole('button', { name: /nuovo periodo|new period/i }).click()
        const dialog = page.getByRole('dialog')
        await dialog.locator('#macro-period-phase').selectOption({ label: PHASE_NAME })
        await dialog.getByRole('button', { name: /^(salva|save)$/i }).click()
        await expect(dialog).toBeHidden()

        const bar = periodBars(page).filter({ hasText: PHASE_NAME })
        await expect(bar).toBeVisible()
        await expect(page.getByRole('list', { name: /legenda|legend/i })).toContainText(PHASE_NAME)
        await expect(page.getByRole('list', { name: /legenda|legend/i })).toContainText('Fase creata dal test')

        // 4. Drag the bar one week to the right: saved without a dialog
        const scroll = (await page.locator('.rct-scroll').boundingBox())!
        const week = scroll.width / 12
        const box = (await bar.boundingBox())!
        const patched = page.waitForResponse(
            (response) => response.url().includes('/api/macro-periods/') && response.request().method() === 'PATCH'
        )
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + week / 2, box.y + box.height / 2, { steps: 5 })
        await page.mouse.move(box.x + box.width / 2 + week, box.y + box.height / 2, { steps: 5 })
        await page.mouse.up()
        expect((await patched).status()).toBe(200)
        const moved = (await bar.boundingBox())!
        expect(Math.round(moved.x - box.x)).toBeGreaterThan(week * 0.8)
        expect(Math.round(moved.width)).toBe(Math.round(box.width))

        // 5. Drag across free weeks on the phases row: the dialog opens with the drawn range
        const freeX = moved.x + moved.width + week * 0.5
        const rowY = scroll.y + 24
        await page.mouse.move(freeX, rowY)
        await page.mouse.down()
        await page.mouse.move(freeX + week, rowY, { steps: 5 })
        await page.mouse.up()
        await expect(dialog).toBeVisible()
        await expect(page.locator('.rct-item[data-kind="draft"]')).toBeVisible()
        await dialog.getByRole('button', { name: /annulla|cancel/i }).click()
        await expect(page.locator('.rct-item[data-kind="draft"]')).toHaveCount(0)

        // 6. Weeks / Month switch
        await page.getByRole('button', { name: /^(mese|month)$/i }).click()
        await expect(page.getByRole('button', { name: /^(mese|month)$/i })).toHaveAttribute('aria-pressed', 'true')
        await expect(bar).toBeVisible()
        await page.getByRole('button', { name: /^(settimane|weeks)$/i }).click()

        // 7. Clean up: the period, then the phase (deletable again once unused)
        await deleteVisiblePeriods(page)
        await page.goto('/profile')
        const phaseRow = page.getByRole('listitem', { name: PHASE_NAME })
        await phaseRow.getByRole('button', { name: /^(elimina|delete)$/i }).click()
        await page.getByRole('button', { name: /elimina fase|delete phase/i }).click()
        await expect(phaseRow).toHaveCount(0)
    })
})
