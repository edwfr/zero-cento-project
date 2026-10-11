import { test, expect, type Page } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E Test: Trainer workout templates library
 * Create template -> start program from it -> usage count -> delete template.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts), at least one exercise and one trainee
 *   - Server running at http://localhost:3000
 */
const TEMPLATE_NAME = 'Template E2E'

async function loginAsTrainer(page: Page) {
    await page.goto('/login')
    await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
    await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
}

test.describe('Trainer: workout templates flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsTrainer(page)
    })

    test('create template, start program from it, delete template', async ({ page }) => {
        // 1. Open the library from the sidebar
        await page.getByRole('link', { name: 'Template', exact: true }).first().click()
        await page.waitForURL('**/trainer/templates')
        await expect(page.getByRole('heading', { name: 'Template', exact: true })).toBeVisible()

        // 2. Create a template: 3 workouts/week, one exercise row
        await page.goto('/trainer/templates/new')
        await page.fill('input[name="name"]', TEMPLATE_NAME)
        await page.fill('input[name="workoutsPerWeek"]', '3')

        const firstWorkout = page.getByTestId('template-workout-0')
        await firstWorkout.getByRole('button', { name: 'Aggiungi esercizio' }).click()
        await firstWorkout.getByRole('combobox').click()
        await page.getByRole('option').first().click()
        await firstWorkout.getByRole('spinbutton', { name: 'Serie' }).fill('3')
        await firstWorkout.getByRole('textbox', { name: 'Reps' }).fill('8')
        await firstWorkout.getByRole('combobox', { name: 'Recupero' }).selectOption('m2')
        await page.getByRole('button', { name: 'Salva in libreria' }).click()

        await page.waitForURL('**/trainer/templates')
        const templateRow = page.getByRole('row', { name: new RegExp(TEMPLATE_NAME) })
        await expect(templateRow).toBeVisible()
        const cells = templateRow.getByRole('cell')
        await expect(cells.nth(3)).toHaveText('0')
        await expect(cells.nth(4)).toHaveText(/Mai|Never/)

        // 3. New program from library
        await page.goto('/trainer/programs/new')
        await page.getByRole('button', { name: /Da libreria/ }).click()
        await page.getByRole('button', { name: new RegExp(TEMPLATE_NAME) }).click()
        await expect(page).toHaveURL(/templateId=/)
        const workoutsInput = page.locator('input[type="number"][max="7"]')
        await expect(workoutsInput).toHaveValue('3')
        await expect(workoutsInput).toHaveAttribute('readonly', '')

        // 4. Fill and submit
        await page.getByPlaceholder(/nome|name/i).first().fill('Programma da template E2E')
        const traineeSelect = page.locator('select').first()
        await traineeSelect.selectOption({ index: 1 })
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/trainer\/programs\/[^/]+\/edit/, { timeout: 15_000 })
        const programEditUrl = page.url()

        // Week 1, first workout: exercise row with sets 3 / reps 8 and empty weight
        const row = page
            .locator('tr')
            .filter({ has: page.locator('input[type="text"][aria-label]') })
            .first()
        await expect(row.locator('input[type="number"][max="20"]').first()).toHaveValue('3')
        await expect(row.locator('input[type="text"][aria-label]').first()).toHaveValue('8')
        const weightInputs = row.locator('input[type="text"]:not([aria-label]):not([role="combobox"])')
        for (let i = 0; i < (await weightInputs.count()); i++) {
            await expect(weightInputs.nth(i)).toHaveValue('')
        }

        // 5. Usage count is now 1
        await page.goto('/trainer/templates')
        await expect(
            page.getByRole('row', { name: new RegExp(TEMPLATE_NAME) }).getByRole('cell').nth(3)
        ).toHaveText('1')

        // 6. Delete the template; the program keeps its exercise row
        await page
            .getByRole('row', { name: new RegExp(TEMPLATE_NAME) })
            .getByRole('button', { name: 'Elimina' })
            .click()
        await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click()
        await expect(page.getByRole('row', { name: new RegExp(TEMPLATE_NAME) })).toHaveCount(0)

        await page.goto(programEditUrl)
        await expect(
            page.locator('tr').filter({ has: page.locator('input[type="text"][aria-label]') }).first()
                .locator('input[type="text"][aria-label]').first()
        ).toHaveValue('8')
    })
})
