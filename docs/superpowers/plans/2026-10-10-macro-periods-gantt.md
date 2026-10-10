# Macro-Period Planning (Trainer Gantt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer plan each trainee's season as colour-coded macro periods on an editable lane timeline (drag to create, move and resize), using phase types the trainer defines in their own profile.

**Architecture:** Two additive tables (`MacroPhaseType` per trainer, `MacroPeriod` per trainee). All date rules (whole weeks, no overlap, snapping, draft clamping) live in one pure module, `src/lib/macro-periods.ts`, shared by the API and the client and working on `YYYY-MM-DD` strings so nothing depends on a timezone. The timeline is `react-calendar-timeline` wrapped in one component; drag-to-create is our own pointer-event hook layered on top of it. The planning tab becomes the default tab of the trainee detail page.

**Tech Stack:** Next.js 15 App Router, React 18.3, Prisma (PostgreSQL), Zod v3, react-i18next, Tailwind, `react-calendar-timeline@0.30.0-beta.19` (+ `dayjs`, `interactjs@1.10.27`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-macro-periods-gantt-design.md` — read it before starting any task.

## Stato avanzamento (10 ottobre 2026)

Tutte le task sono implementate e verificate: type-check, lint, suite unit/integration (2090 test) e build di produzione verdi.

- [x] Task 1 — spike libreria: 7 prove Playwright + build passate (cancello superato).
- [x] Task 2–9 — implementate, test verdi.
- [x] Task 10 — scenario E2E scritto; **non eseguito** (database non raggiungibile dall'ambiente di sviluppo).

Aperto: applicare la migration `20261011000000_add_macro_periods`, eseguire lo scenario E2E, provare a mano il trascinamento touch.

## Global Constraints

- Before touching code, invoke the project skill that matches the task: `zero-cento-backend` (API, Prisma, lib), `zero-cento-frontend` (components, pages), `zero-cento-testing` (every test).
- A period is whole weeks: `startDate` is a Monday, `endDate` is a Sunday (inclusive), `endDate > startDate`. Shortest period: one week.
- Dates travel and are reasoned about as `YYYY-MM-DD` strings (`IsoDay`). Never build a period date with `new Date(string)` + local getters outside `src/lib/macro-periods.ts`.
- No overlap: for one `(traineeId, trainerId)` two periods never share a week. Enforced on the client before a request and on the server inside the write transaction.
- Phase types belong to a trainer. Every read and write of phases and periods is filtered by `trainerId = session.user.id`. Trainee and admin roles get no access to these endpoints.
- Limits: phase name 1–40 chars (trimmed, unique per trainer, case-insensitive), description ≤ 200, colour `^#[0-9a-fA-F]{6}$`, period note ≤ 500.
- A phase with periods cannot be deleted, only archived (`isActive = false`). An archived phase cannot be assigned to a new or re-phased period; a period already on it can still be moved and resized.
- API responses only through `apiSuccess` / `apiError`; every `catch` ends with `handleApiError`. `ApiErrorCode` is a closed union: conflicts use `'CONFLICT'` and are distinguished by the i18n `key`. Never report 4xx to Sentry.
- All UI copy through react-i18next, in both `public/locales/it/` and `public/locales/en/`. **These JSON files start with a UTF-8 BOM: edit them with the Edit tool, never rewrite them with a script.**
- Click-triggered async uses `<Button isLoading loadingText={t('common:common.saving')}>`; never a raw `<button disabled>` for an async action.
- Tailwind for styling. Inline `style` is allowed only for a value that is data (a phase colour, as `MovementPatternColorsSection` already does) and for the positioning styles the timeline library hands to its item and header renderers.
- The unit-test `t()` mock returns the key: component tests assert on i18n keys, not on Italian text.
- The suite runs with `TZ=UTC`. Tests never depend on the machine clock: pass dates in, or use `vi.useFakeTimers()` + `vi.setSystemTime(...)`.
- After each task add an entry at the top of `## [Unreleased]` in `implementation-docs/CHANGELOG.md`, in the existing format (`### [<giorno> Ottobre 2026] — <titolo>`, `**File modificati:**`, `**Note:**`, written in Italian), and include it in the task's commit.
- Coverage floors in `vitest.config.ts` are glob-based (`src/lib/**`, `src/schemas/**`, `src/app/api/**`): new files are measured automatically, do not edit the config.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec (decided while planning)

- The library has no `week` header unit (`SelectUnits` is `second…year`). The week header row is drawn with the library's `CustomHeader` over day intervals, rendering only Mondays at seven times the day width.
- The library's `dragSnap` is epoch-aligned, so it cannot snap to Mondays. `dragSnap` is set to one day and the Monday snap is done in `moveResizeValidator`.
- Zoom is locked (`minZoom === maxZoom === visible span`): the Weeks/Month switch is the only way to change scale.
- The library arms drag and resize only on a *selected* item. Every period bar is therefore kept permanently selected through the controlled `selected` prop, so it can be dragged without a first click. A tap on a period arrives as `onItemClick`; a tap on a program bar (never selected) arrives as `onItemSelect`.
- Two extra pure helpers, `movePeriod` and `resizePeriod`, hold the "keep at least one week" rule so it is unit-tested without the library.
- `MacroPeriod.phaseType` uses `onDelete: NoAction` (not `Restrict`): `RESTRICT` is checked immediately and would make deleting a trainer fail, because the cascade reaches the phase before the periods.
- If a trainer deletes every phase, the next list call recreates the three placeholders (the spec's "zero phase types" rule, applied literally).

## Review Focus

1. **Drop in the middle of a week** — a bar released on a Wednesday or Thursday must land on a whole week (nearest Monday), never produce a 400 from the API. Pinned in Task 2 (`snapToWeekStart` boundaries, `movePeriod`) and Task 8 (validator test).
2. **Resize past the opposite edge** — dragging the left edge beyond the right one (or the reverse) must leave a one-week period, not a negative or empty range. Pinned in Task 2 (`resizePeriod`).
3. **Phase archived or deleted in another tab** — the planning tab still lists it; saving a new period on it returns 409/404. The dialog must stay open with the translated message, and nothing must be added to the timeline. Pinned in Task 9.
4. **Every phase archived (or none active)** — the period dialog has nothing to choose. Save stays disabled and a hint points to the profile; no request is sent. Pinned in Task 7.
5. **Colour that is not a 6-digit hex** — a legacy or hand-edited row with `#FFF`, `red` or an empty string must still render a readable bar. Pinned in Task 2 (`readableTextColor` fallback) and Task 3 (schema rejects it on the way in).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `package.json`, `package-lock.json` | `react-calendar-timeline@0.30.0-beta.19`, `dayjs`, `interactjs@1.10.27` | 1 |
| `src/lib/macro-periods.ts` | Pure date rules, colour helpers, DTO types | 2 |
| `tests/unit/lib/macro-periods.test.ts` | Tests for the above | 2 |
| `prisma/schema.prisma`, `prisma/migrations/20261011000000_add_macro_periods/migration.sql` | Two tables | 3 |
| `src/schemas/macro-period.ts`, `tests/unit/schemas/macro-period.test.ts` | Zod schemas | 3 |
| `src/lib/macro-period-queries.ts` | Prisma `select` objects and row → DTO mappers | 4 |
| `src/app/api/macro-phase-types/route.ts`, `src/app/api/macro-phase-types/[id]/route.ts` | Phase CRUD | 4 |
| `tests/integration/macro-phase-types.test.ts` | | 4 |
| `src/app/api/trainer/trainees/[id]/macro-periods/route.ts`, `src/app/api/macro-periods/[id]/route.ts` | Period CRUD | 5 |
| `tests/integration/macro-periods.test.ts` | | 5 |
| `src/components/MacroPhaseTypesSection.tsx`, `tests/unit/macro-phase-types-section.test.tsx` | Profile section | 6 |
| `src/app/profile/page.tsx` | Mount the section | 6 |
| `src/components/MacroPeriodFormModal.tsx`, `tests/unit/macro-period-form-modal.test.tsx` | Period dialog | 7 |
| `src/components/useDraftPeriodDrag.ts`, `tests/unit/use-draft-period-drag.test.tsx` | Drag-to-create | 8 |
| `src/components/MacroPeriodTimeline.tsx`, `tests/unit/macro-period-timeline.test.tsx` | Library wrapper | 8 |
| `src/app/trainer/trainees/[id]/_planning-tab.tsx`, `tests/unit/trainer-trainee-planning-tab.test.tsx` | Tab: data, dialog, legend, switch | 9 |
| `src/app/trainer/trainees/[id]/_content.tsx` | New default tab | 9 |
| `tests/e2e/trainer-macro-periods.spec.ts` | End-to-end flow | 10 |
| `public/locales/{it,en}/{trainer,errors,validation,profile}.json` | Copy | 3, 4, 6, 7, 9 |

---

### Task 1: Verify the timeline library (gate)

This task produces an **answer**, not product code. Everything it creates except the dependency install is deleted at the end. **If any check marked BLOCKING fails, stop and report to the user — do not start Task 2.**

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create then delete: `src/app/components-showcase/timeline-spike/page.tsx`, `src/app/components-showcase/timeline-spike/_spike.tsx`, `tests/e2e/zz-timeline-spike.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the three dependencies installed, and a written verdict (in the task report) on each check below. Later tasks assume every check passed as described.

- [ ] **Step 1: Install the pinned dependencies**

```bash
npm install --save-exact react-calendar-timeline@0.30.0-beta.19 interactjs@1.10.27
npm install dayjs@^1.11.10
```

Expected: no peer-dependency error (the library accepts `react ^18 || ^19`).

- [ ] **Step 2: Create the spike page**

`src/app/components-showcase/timeline-spike/page.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'

const Spike = dynamic(() => import('./_spike'), { ssr: false })

export default function TimelineSpikePage() {
    return <Spike />
}
```

`src/app/components-showcase/timeline-spike/_spike.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Timeline, {
    CustomHeader,
    DateHeader,
    SidebarHeader,
    TimelineHeaders,
    TimelineMarkers,
    TodayMarker,
} from 'react-calendar-timeline'
import 'react-calendar-timeline/style.css'

const DAY = 86_400_000
const WEEK = 7 * DAY
const LINE_HEIGHT = 48

const mondayOf = (ms: number) => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.getTime()
}
const nearestMonday = (ms: number) => {
    const m = mondayOf(ms)
    return ms - m < 3.5 * DAY ? m : m + WEEK
}
const iso = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BASE = mondayOf(Date.now())

type Item = {
    id: string
    group: string
    title: string
    start_time: number
    end_time: number
    canMove?: boolean
    canResize?: false | 'both'
}

const INITIAL: Item[] = [
    { id: 'a', group: 'phases', title: 'A', start_time: BASE, end_time: BASE + 3 * WEEK, canResize: 'both' },
    { id: 'b', group: 'phases', title: 'B', start_time: BASE + 5 * WEEK, end_time: BASE + 7 * WEEK, canResize: 'both' },
    { id: 'p', group: 'programs', title: 'P', start_time: BASE + WEEK, end_time: BASE + 6 * WEEK, canMove: false, canResize: false },
]

const GROUPS = [
    { id: 'phases', title: 'Fasi' },
    { id: 'programs', title: 'Schede' },
]

export default function Spike() {
    const [items, setItems] = useState<Item[]>(INITIAL)
    const [range, setRange] = useState({ start: BASE - WEEK, end: BASE + 11 * WEEK })
    const [log, setLog] = useState<string[]>([])
    const wrapperRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const rangeRef = useRef(range)
    rangeRef.current = range

    const push = (line: string) => setLog((current) => [...current, line])

    // Drag-to-create probe: capture-phase pointerdown on the wrapper, pan suppressed on row 0 only
    useEffect(() => {
        const wrapper = wrapperRef.current
        if (!wrapper) return

        const timeAt = (clientX: number) => {
            const rect = scrollRef.current!.getBoundingClientRect()
            const ratio = (clientX - rect.left) / rect.width
            return rangeRef.current.start + ratio * (rangeRef.current.end - rangeRef.current.start)
        }

        const onDown = (event: PointerEvent) => {
            const scrollEl = scrollRef.current
            const target = event.target as HTMLElement
            if (!scrollEl || !scrollEl.contains(target) || target.closest('.rct-item')) return
            const y = event.clientY - scrollEl.getBoundingClientRect().top
            if (y < 0 || y >= LINE_HEIGHT) return

            event.stopPropagation()
            const anchor = mondayOf(timeAt(event.clientX))
            const draw = (toX: number) => {
                const end = mondayOf(timeAt(toX)) + WEEK
                setItems((current) => [
                    ...current.filter((item) => item.id !== 'draft'),
                    { id: 'draft', group: 'phases', title: 'draft', start_time: anchor, end_time: Math.max(end, anchor + WEEK), canMove: false, canResize: false },
                ])
            }
            draw(event.clientX)

            const onMove = (move: PointerEvent) => draw(move.clientX)
            const onUp = (up: PointerEvent) => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                push(`draft ${iso(anchor)} ${iso(mondayOf(timeAt(up.clientX)) + WEEK - DAY)}`)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
        }

        wrapper.addEventListener('pointerdown', onDown, true)
        return () => wrapper.removeEventListener('pointerdown', onDown, true)
    }, [])

    return (
        <div className="p-6">
            <p data-testid="range">{`${iso(range.start)} ${iso(range.end)}`}</p>
            <button type="button" onClick={() => setRange((r) => ({ start: r.start + 4 * WEEK, end: r.end + 4 * WEEK }))}>
                next
            </button>
            <div ref={wrapperRef}>
                <Timeline
                    groups={GROUPS}
                    items={items}
                    visibleTimeStart={range.start}
                    visibleTimeEnd={range.end}
                    onTimeChange={(start, end) => setRange({ start, end })}
                    minZoom={12 * WEEK}
                    maxZoom={12 * WEEK}
                    dragSnap={DAY}
                    lineHeight={LINE_HEIGHT}
                    itemHeightRatio={0.7}
                    stackItems={false}
                    canChangeGroup={false}
                    canResize="both"
                    // The library only arms drag/resize on a selected item: keep the editable ones always selected
                    selected={['a', 'b']}
                    sidebarWidth={110}
                    scrollRef={(el) => {
                        scrollRef.current = el
                    }}
                    moveResizeValidator={(_action, _item, time) => nearestMonday(time)}
                    onItemMove={(id, time) => {
                        push(`move ${id} ${iso(time)}`)
                        setItems((current) =>
                            current.map((item) =>
                                item.id === id ? { ...item, start_time: time, end_time: time + (item.end_time - item.start_time) } : item
                            )
                        )
                    }}
                    onItemResize={(id, time, edge) => {
                        push(`resize ${id} ${edge} ${iso(time)}`)
                        setItems((current) =>
                            current.map((item) =>
                                item.id === id ? { ...item, [edge === 'left' ? 'start_time' : 'end_time']: time } : item
                            )
                        )
                    }}
                    onItemClick={(id) => push(`click ${id}`)}
                    onItemSelect={(id) => push(`select ${id}`)}
                    onCanvasClick={(groupId, time) => push(`canvas ${groupId} ${iso(time)}`)}
                >
                    <TimelineHeaders>
                        <SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} />}</SidebarHeader>
                        <DateHeader unit="primaryHeader" />
                        <CustomHeader unit="day" height={28}>
                            {({ headerContext: { intervals }, getRootProps, getIntervalProps }) => (
                                <div {...getRootProps()}>
                                    {intervals
                                        .filter((interval) => interval.startTime.day() === 1)
                                        .map((interval) => {
                                            const props = getIntervalProps({ interval })
                                            return (
                                                <div
                                                    {...props}
                                                    key={props.key}
                                                    data-testid="week-cell"
                                                    style={{ ...props.style, width: Number(props.style.width) * 7 }}
                                                >
                                                    {interval.startTime.format('D/M')}
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </CustomHeader>
                    </TimelineHeaders>
                    <TimelineMarkers>
                        <TodayMarker />
                    </TimelineMarkers>
                </Timeline>
            </div>
            <pre data-testid="log">{log.join('\n')}</pre>
        </div>
    )
}
```

If this file does not type-check because a name or prop differs in the installed version, read `node_modules/react-calendar-timeline/dist/index.d.ts` and `dist/lib/Timeline.d.ts`, fix the spike, and **record every difference in the task report** — Task 8 is written against the names used here.

- [ ] **Step 3: Write the probe script**

`tests/e2e/zz-timeline-spike.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

const drag = async (page: Page, fromX: number, fromY: number, toX: number) => {
    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move((fromX + toX) / 2, fromY, { steps: 5 })
    await page.mouse.move(toX, fromY, { steps: 5 })
    await page.mouse.up()
}

test.describe('timeline library spike', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
        await page.goto('/components-showcase/timeline-spike')
        await expect(page.locator('.rct-item').first()).toBeVisible()
    })

    const geometry = async (page: Page) => {
        const scroll = (await page.locator('.rct-scroll').boundingBox())!
        return { scroll, week: scroll.width / 12 }
    }
    const log = (page: Page) => page.getByTestId('log')

    test('1 BLOCKING move snaps to a Monday', async ({ page }) => {
        const { week } = await geometry(page)
        const a = (await page.locator('.rct-item', { hasText: 'A' }).boundingBox())!
        // 1.4 weeks to the right: must snap to exactly one week
        await drag(page, a.x + a.width / 2, a.y + a.height / 2, a.x + a.width / 2 + week * 1.4)
        await expect(log(page)).toContainText(/move a \d{4}-\d{2}-\d{2}/)
        const moved = (await log(page).textContent())!.match(/move a (\d{4}-\d{2}-\d{2})/)![1]
        expect(new Date(`${moved}T12:00:00`).getDay()).toBe(1)
    })

    test('2 BLOCKING both edges resize', async ({ page }) => {
        const { week } = await geometry(page)
        const b = (await page.locator('.rct-item', { hasText: 'B' }).boundingBox())!
        await drag(page, b.x + b.width - 2, b.y + b.height / 2, b.x + b.width - 2 + week)
        await expect(log(page)).toContainText('resize b right')
        const b2 = (await page.locator('.rct-item', { hasText: 'B' }).boundingBox())!
        await drag(page, b2.x + 2, b2.y + b2.height / 2, b2.x + 2 + week)
        await expect(log(page)).toContainText('resize b left')
    })

    test('3 BLOCKING a read-only item does not move', async ({ page }) => {
        const { week } = await geometry(page)
        const p = (await page.locator('.rct-item', { hasText: 'P' }).boundingBox())!
        await drag(page, p.x + p.width / 2, p.y + p.height / 2, p.x + p.width / 2 + week * 2)
        await expect(log(page)).not.toContainText('move p')
    })

    test('4 BLOCKING drag on empty row 0 draws a draft and does not pan', async ({ page }) => {
        const { scroll, week } = await geometry(page)
        const before = await page.getByTestId('range').textContent()
        // weeks 4-5 (index from the left edge: 1 padding week + 3 weeks of A) are free
        const y = scroll.y + 24
        await drag(page, scroll.x + week * 4.5, y, scroll.x + week * 5.5)
        await expect(log(page)).toContainText(/draft \d{4}-\d{2}-\d{2} \d{4}-\d{2}-\d{2}/)
        await expect(page.locator('.rct-item', { hasText: 'draft' })).toBeVisible()
        await expect(page.getByTestId('range')).toHaveText(before ?? '')
    })

    test('5 drag on row 1 still pans', async ({ page }) => {
        const { scroll, week } = await geometry(page)
        const before = await page.getByTestId('range').textContent()
        await drag(page, scroll.x + week * 9.5, scroll.y + 48 + 24, scroll.x + week * 6.5)
        await expect(page.getByTestId('range')).not.toHaveText(before ?? '')
    })

    test('6 controlled range and week header', async ({ page }) => {
        const before = await page.getByTestId('range').textContent()
        await page.getByRole('button', { name: 'next' }).click()
        await expect(page.getByTestId('range')).not.toHaveText(before ?? '')
        expect(await page.getByTestId('week-cell').count()).toBeGreaterThanOrEqual(12)
    })

    test('7 click on an item and on empty canvas are reported', async ({ page }) => {
        const { scroll, week } = await geometry(page)
        // B is always selected → a tap is reported as a click; P is not → reported as a select
        await page.locator('.rct-item', { hasText: 'B' }).click()
        await expect(log(page)).toContainText('click b')
        await page.locator('.rct-item', { hasText: 'P' }).click()
        await expect(log(page)).toContainText('select p')
        await page.mouse.click(scroll.x + week * 10.5, scroll.y + 48 + 24)
        await expect(log(page)).toContainText('canvas programs')
    })
})
```

- [ ] **Step 4: Run the probe**

Run (dev server and seed data required): `npx playwright test tests/e2e/zz-timeline-spike.spec.ts --project=chromium`

If no project is named `chromium`, drop the flag. Expected: all seven pass. Also run `npm run build` once: expected no "window is not defined" or CSS-import error from the library (BLOCKING).

If the dev server or seed database is not available, say so in the report and stop: this gate cannot be skipped.

- [ ] **Step 5: Record the verdict**

In the task report, one line per check: `1 move snap`, `2 resize both edges`, `3 read-only item`, `4 drag-to-create + pan suppressed`, `5 pan elsewhere`, `6 controlled range + week header`, `7 clicks`, `8 production build` — each `PASS`, `FAIL`, or `PASS with change: <what had to change>`. Checks 1 and 2 drag items that were never clicked: they pass only because of the `selected` prop (the library arms drag and resize on selected items only). If they fail, try once with a click on the item before the drag and report the result — that would mean "always selected" does not work and Task 8 needs another way to arm the bars.

Touch drag cannot be probed here. Report it as "not verified automatically; to be checked by hand on a phone in Task 10".

**Decision:**
- Checks 1–4 and 8 all PASS (with or without recorded changes) → continue to Task 2.
- Check 1, 2, 3 or 8 FAIL → stop. Tell the user the library does not meet the spec and that the documented fallback is `@svar-ui/react-gantt` with a one-row-per-period layout.
- Only check 4 FAIL → stop. Tell the user drag-to-create is not feasible on this library; it is a stated requirement, so they must choose between another library and dropping it.
- Check 5, 6 or 7 FAIL → continue, and describe the degraded behaviour in the report so Task 8 can adapt (for example: navigation buttons only, no drag-to-pan).

- [ ] **Step 6: Remove the spike and commit**

```bash
rm -r src/app/components-showcase/timeline-spike tests/e2e/zz-timeline-spike.spec.ts
git add package.json package-lock.json implementation-docs/CHANGELOG.md
git commit -m "chore(deps): add react-calendar-timeline for macro-period planning"
```

---

### Task 2: Pure date and colour rules

**Files:**
- Create: `src/lib/macro-periods.ts`
- Test: `tests/unit/lib/macro-periods.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `src/lib/macro-periods.ts`):
  - Types: `IsoDay = string`; `DayRange { startDate: IsoDay; endDate: IsoDay }`; `PeriodRange extends DayRange { id: string }`; `MacroPhaseTypeDto { id; name; description: string | null; color; sortOrder: number; isActive: boolean; usageCount: number }`; `MacroPeriodDto { id; startDate: IsoDay; endDate: IsoDay; note: string | null; phaseType: { id; name; color; isActive: boolean } }`; `PlanProgramDto { id; title; status: string; startDate: IsoDay; durationWeeks: number }`.
  - Day maths: `isIsoDay(value: string): boolean`, `addDays(day, n): IsoDay`, `weekStartOf(day): IsoDay`, `weekEndOf(day): IsoDay`, `snapToWeekStart(day): IsoDay`, `snapToWeekEnd(day): IsoDay`, `isValidPeriodRange(start, end): boolean`.
  - Rules: `findOverlap<T extends PeriodRange>(candidate: DayRange, periods: T[], ignoreId?: string): T | null`, `clampRangeToFree(anchorDay, pointerDay, periods: PeriodRange[]): DayRange | null`, `movePeriod(period: DayRange, newStartDay: IsoDay): DayRange`, `resizePeriod(period: DayRange, edge: 'left' | 'right', day: IsoDay): DayRange`, `programToRange(startDate: IsoDay, durationWeeks: number): DayRange`.
  - Conversions: `dbDateToIsoDay(date: Date): IsoDay`, `isoDayToDbDate(day): Date`, `dayToLocalMs(day): number`, `localMsToDay(ms: number): IsoDay`, `xToMs(x, width, visibleStart, visibleEnd): number`.
  - Timeline scale: `TimelineView = 'weeks' | 'month'`, `WEEK_MS: number`, `VIEW_SPAN_MS: Record<TimelineView, number>` (12 and 52 weeks). They live here, not in the timeline component, so the tab can use them without pulling the library into its bundle.
  - Colour: `PHASE_COLOR_PALETTE: readonly string[]` (12), `nextUnusedColor(used: string[]): string`, `readableTextColor(hex: string): '#ffffff' | '#111827'`, `DEFAULT_PHASE_NAMES: readonly string[]` (3).

- [ ] **Step 1: Write the failing tests**

`tests/unit/lib/macro-periods.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    DEFAULT_PHASE_NAMES,
    PHASE_COLOR_PALETTE,
    VIEW_SPAN_MS,
    WEEK_MS,
    addDays,
    clampRangeToFree,
    dayToLocalMs,
    dbDateToIsoDay,
    findOverlap,
    isIsoDay,
    isValidPeriodRange,
    isoDayToDbDate,
    localMsToDay,
    movePeriod,
    nextUnusedColor,
    programToRange,
    readableTextColor,
    resizePeriod,
    snapToWeekEnd,
    snapToWeekStart,
    weekEndOf,
    weekStartOf,
    xToMs,
} from '@/lib/macro-periods'

// 2026-10-05 is a Monday, 2026-10-11 a Sunday.
const MON = '2026-10-05'
const SUN = '2026-10-11'

describe('isIsoDay', () => {
    it('accepts a real calendar day', () => {
        expect(isIsoDay('2026-10-05')).toBe(true)
        expect(isIsoDay('2028-02-29')).toBe(true)
    })

    it.each(['2026-02-30', '2026-13-01', '2026-1-5', '05/10/2026', '', '2026-10-05T00:00:00Z'])(
        'rejects %s',
        (value) => {
            expect(isIsoDay(value)).toBe(false)
        }
    )
})

describe('addDays', () => {
    it('crosses month and year boundaries', () => {
        expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    })

    it('is not shifted by a DST change', () => {
        // Europe/Rome leaves DST on 2026-10-25: day arithmetic must stay calendar-based
        expect(addDays('2026-10-19', 7)).toBe('2026-10-26')
    })
})

describe('weekStartOf / weekEndOf', () => {
    it('returns the Monday and Sunday of the containing week', () => {
        for (const day of ['2026-10-05', '2026-10-07', '2026-10-11']) {
            expect(weekStartOf(day)).toBe(MON)
            expect(weekEndOf(day)).toBe(SUN)
        }
    })

    it('handles a week that straddles a year', () => {
        expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
        expect(weekEndOf('2026-12-28')).toBe('2027-01-03')
    })
})

describe('snapToWeekStart', () => {
    it.each([
        ['2026-10-05', '2026-10-05'], // Monday stays
        ['2026-10-06', '2026-10-05'], // Tuesday → back
        ['2026-10-08', '2026-10-05'], // Thursday → back
        ['2026-10-09', '2026-10-12'], // Friday → forward
        ['2026-10-11', '2026-10-12'], // Sunday → forward
    ])('snaps %s to the nearest Monday %s', (day, expected) => {
        expect(snapToWeekStart(day)).toBe(expected)
    })
})

describe('snapToWeekEnd', () => {
    it.each([
        ['2026-10-11', '2026-10-11'], // Sunday stays
        ['2026-10-12', '2026-10-11'], // Monday → back
        ['2026-10-14', '2026-10-11'], // Wednesday → back
        ['2026-10-15', '2026-10-18'], // Thursday → forward
        ['2026-10-17', '2026-10-18'], // Saturday → forward
    ])('snaps %s to the nearest Sunday %s', (day, expected) => {
        expect(snapToWeekEnd(day)).toBe(expected)
    })
})

describe('isValidPeriodRange', () => {
    it('accepts Monday → Sunday, one week or more', () => {
        expect(isValidPeriodRange(MON, SUN)).toBe(true)
        expect(isValidPeriodRange(MON, '2026-11-01')).toBe(true)
    })

    it.each([
        ['2026-10-06', SUN], // start not Monday
        [MON, '2026-10-10'], // end not Sunday
        ['2026-10-12', SUN], // end before start
        [MON, MON], // same day
        ['nope', SUN],
    ])('rejects %s → %s', (start, end) => {
        expect(isValidPeriodRange(start, end)).toBe(false)
    })
})

const periods = [
    { id: 'p1', startDate: '2026-10-05', endDate: '2026-10-18' }, // weeks 1-2
    { id: 'p2', startDate: '2026-11-02', endDate: '2026-11-08' }, // week 5
]

describe('findOverlap', () => {
    it('returns the period sharing at least one day', () => {
        expect(findOverlap({ startDate: '2026-10-12', endDate: '2026-10-25' }, periods)?.id).toBe('p1')
    })

    it('treats adjacent weeks as free', () => {
        expect(findOverlap({ startDate: '2026-10-19', endDate: '2026-11-01' }, periods)).toBeNull()
    })

    it('ignores the period being edited', () => {
        expect(findOverlap({ startDate: '2026-10-05', endDate: '2026-10-25' }, periods, 'p1')).toBeNull()
        expect(findOverlap({ startDate: '2026-10-05', endDate: '2026-11-08' }, periods, 'p1')?.id).toBe('p2')
    })

    it('returns null for an empty plan', () => {
        expect(findOverlap({ startDate: MON, endDate: SUN }, [])).toBeNull()
    })
})

describe('clampRangeToFree', () => {
    it('returns the anchor week for a press without movement', () => {
        expect(clampRangeToFree('2026-10-21', '2026-10-21', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-10-25',
        })
    })

    it('grows to the right up to the pointer week', () => {
        expect(clampRangeToFree('2026-10-21', '2026-10-28', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('stops at the next period when dragging right', () => {
        expect(clampRangeToFree('2026-10-21', '2026-12-01', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('grows to the left and stops at the previous period', () => {
        expect(clampRangeToFree('2026-10-28', '2026-09-01', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('grows freely to the left when nothing is in the way', () => {
        expect(clampRangeToFree('2026-09-23', '2026-09-08', periods)).toEqual({
            startDate: '2026-09-07',
            endDate: '2026-09-27',
        })
    })

    it('returns null when the anchor week is occupied', () => {
        expect(clampRangeToFree('2026-10-07', '2026-10-30', periods)).toBeNull()
    })
})

describe('movePeriod', () => {
    it('keeps the length and snaps the start to the nearest Monday', () => {
        expect(movePeriod({ startDate: MON, endDate: '2026-10-18' }, '2026-10-21')).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
        expect(movePeriod({ startDate: MON, endDate: SUN }, '2026-10-09')).toEqual({
            startDate: '2026-10-12',
            endDate: '2026-10-18',
        })
    })
})

describe('resizePeriod', () => {
    const period = { startDate: '2026-10-05', endDate: '2026-10-25' } // 3 weeks

    it('moves the left edge to the nearest Monday', () => {
        expect(resizePeriod(period, 'left', '2026-10-13')).toEqual({ startDate: '2026-10-12', endDate: '2026-10-25' })
    })

    it('moves the right edge; the day is the exclusive end the library reports', () => {
        // library reports Monday 2026-11-02 00:00 as the new end → last day is Sunday 2026-11-01
        expect(resizePeriod(period, 'right', '2026-11-02')).toEqual({ startDate: '2026-10-05', endDate: '2026-11-01' })
    })

    it('keeps one week when the left edge is dragged past the right edge', () => {
        expect(resizePeriod(period, 'left', '2026-12-01')).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' })
    })

    it('keeps one week when the right edge is dragged past the left edge', () => {
        expect(resizePeriod(period, 'right', '2026-09-01')).toEqual({ startDate: '2026-10-05', endDate: '2026-10-11' })
    })
})

describe('programToRange', () => {
    it('spans durationWeeks from the start date, whatever weekday it is', () => {
        expect(programToRange('2026-10-07', 4)).toEqual({ startDate: '2026-10-07', endDate: '2026-11-03' })
    })

    it('renders a zero or negative duration as a single day', () => {
        expect(programToRange('2026-10-07', 0)).toEqual({ startDate: '2026-10-07', endDate: '2026-10-07' })
        expect(programToRange('2026-10-07', -3)).toEqual({ startDate: '2026-10-07', endDate: '2026-10-07' })
    })
})

describe('conversions', () => {
    it('round-trips a database date', () => {
        expect(dbDateToIsoDay(new Date('2026-10-05T00:00:00.000Z'))).toBe(MON)
        expect(isoDayToDbDate(MON).toISOString()).toBe('2026-10-05T00:00:00.000Z')
    })

    it('round-trips a local timestamp', () => {
        expect(localMsToDay(dayToLocalMs(MON))).toBe(MON)
        expect(localMsToDay(dayToLocalMs(MON) + 23 * 3_600_000)).toBe(MON)
    })

    it('maps an x position onto the visible range', () => {
        expect(xToMs(0, 1000, 100, 200)).toBe(100)
        expect(xToMs(500, 1000, 100, 200)).toBe(150)
        expect(xToMs(1000, 1000, 100, 200)).toBe(200)
    })

    it('clamps an x outside the canvas and survives a zero width', () => {
        expect(xToMs(-50, 1000, 100, 200)).toBe(100)
        expect(xToMs(5000, 1000, 100, 200)).toBe(200)
        expect(xToMs(10, 0, 100, 200)).toBe(100)
    })
})

describe('timeline scale', () => {
    it('shows 12 weeks in the weeks view and 52 in the month view', () => {
        expect(WEEK_MS).toBe(7 * 86_400_000)
        expect(VIEW_SPAN_MS).toEqual({ weeks: 12 * WEEK_MS, month: 52 * WEEK_MS })
    })
})

describe('colours', () => {
    it('has 12 distinct valid palette colours and 3 default names', () => {
        expect(PHASE_COLOR_PALETTE).toHaveLength(12)
        expect(new Set(PHASE_COLOR_PALETTE).size).toBe(12)
        for (const color of PHASE_COLOR_PALETTE) expect(color).toMatch(/^#[0-9a-f]{6}$/)
        expect(DEFAULT_PHASE_NAMES).toEqual(['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3'])
    })

    it('proposes the first palette colour not in use, case-insensitively', () => {
        expect(nextUnusedColor([])).toBe(PHASE_COLOR_PALETTE[0])
        expect(nextUnusedColor([PHASE_COLOR_PALETTE[0].toUpperCase(), PHASE_COLOR_PALETTE[1]])).toBe(
            PHASE_COLOR_PALETTE[2]
        )
    })

    it('cycles the palette when every colour is taken', () => {
        expect(nextUnusedColor([...PHASE_COLOR_PALETTE])).toBe(PHASE_COLOR_PALETTE[0])
        expect(nextUnusedColor([...PHASE_COLOR_PALETTE, '#000000'])).toBe(PHASE_COLOR_PALETTE[1])
    })

    it('picks white on dark and dark on light', () => {
        expect(readableTextColor('#1e3a8a')).toBe('#ffffff')
        expect(readableTextColor('#000000')).toBe('#ffffff')
        expect(readableTextColor('#fde047')).toBe('#111827')
        expect(readableTextColor('#FFFFFF')).toBe('#111827')
    })

    it.each(['#FFF', 'red', '', '#12345g'])('falls back to dark text for %s', (value) => {
        expect(readableTextColor(value)).toBe('#111827')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/lib/macro-periods.test.ts`
Expected: FAIL — cannot resolve `@/lib/macro-periods`.

- [ ] **Step 3: Write the implementation**

`src/lib/macro-periods.ts`:

```ts
/**
 * Macro-period planning rules, shared by the API and the client.
 *
 * Every date here is a calendar day written `YYYY-MM-DD`. Day arithmetic runs in
 * UTC on purpose: a calendar day has no timezone, and doing it in local time
 * would shift a period by one day across a DST change.
 */

export type IsoDay = string

export interface DayRange {
    startDate: IsoDay
    endDate: IsoDay
}

export interface PeriodRange extends DayRange {
    id: string
}

export interface MacroPhaseTypeDto {
    id: string
    name: string
    description: string | null
    color: string
    sortOrder: number
    isActive: boolean
    usageCount: number
}

export interface MacroPeriodDto extends PeriodRange {
    note: string | null
    phaseType: { id: string; name: string; color: string; isActive: boolean }
}

export interface PlanProgramDto {
    id: string
    title: string
    status: string
    startDate: IsoDay
    durationWeeks: number
}

const DAY_MS = 86_400_000

export type TimelineView = 'weeks' | 'month'

export const WEEK_MS = 7 * DAY_MS

/** Visible span of each view of the planning timeline. */
export const VIEW_SPAN_MS: Record<TimelineView, number> = {
    weeks: 12 * WEEK_MS,
    month: 52 * WEEK_MS,
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const toUtcMs = (day: IsoDay): number => Date.parse(`${day}T00:00:00.000Z`)
const fromUtcMs = (ms: number): IsoDay => new Date(ms).toISOString().slice(0, 10)

/** True for a real calendar day in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isIsoDay(value: string): boolean {
    if (!ISO_DAY_PATTERN.test(value)) return false
    const ms = toUtcMs(value)
    return !Number.isNaN(ms) && fromUtcMs(ms) === value
}

export function addDays(day: IsoDay, amount: number): IsoDay {
    return fromUtcMs(toUtcMs(day) + amount * DAY_MS)
}

/** 0 = Monday … 6 = Sunday */
function weekdayIndex(day: IsoDay): number {
    return (new Date(toUtcMs(day)).getUTCDay() + 6) % 7
}

/** Monday of the week containing `day`. */
export function weekStartOf(day: IsoDay): IsoDay {
    return addDays(day, -weekdayIndex(day))
}

/** Sunday of the week containing `day`. */
export function weekEndOf(day: IsoDay): IsoDay {
    return addDays(weekStartOf(day), 6)
}

/** Nearest Monday. Monday–Thursday go back, Friday–Sunday go forward. */
export function snapToWeekStart(day: IsoDay): IsoDay {
    const index = weekdayIndex(day)
    return addDays(day, index <= 3 ? -index : 7 - index)
}

/** Nearest Sunday. */
export function snapToWeekEnd(day: IsoDay): IsoDay {
    return addDays(snapToWeekStart(addDays(day, 1)), -1)
}

export function isValidPeriodRange(startDate: string, endDate: string): boolean {
    if (!isIsoDay(startDate) || !isIsoDay(endDate)) return false
    return weekdayIndex(startDate) === 0 && weekdayIndex(endDate) === 6 && endDate > startDate
}

/** The period sharing at least one day with `candidate`, or null. */
export function findOverlap<T extends PeriodRange>(candidate: DayRange, periods: T[], ignoreId?: string): T | null {
    return (
        periods.find(
            (period) =>
                period.id !== ignoreId &&
                period.startDate <= candidate.endDate &&
                candidate.startDate <= period.endDate
        ) ?? null
    )
}

/**
 * Range drawn by dragging on empty weeks: from the anchor week towards the
 * pointer, stopping at the first occupied week. Null when the anchor week
 * itself is taken.
 */
export function clampRangeToFree(anchorDay: IsoDay, pointerDay: IsoDay, periods: PeriodRange[]): DayRange | null {
    const anchorStart = weekStartOf(anchorDay)
    const anchorEnd = addDays(anchorStart, 6)
    if (findOverlap({ startDate: anchorStart, endDate: anchorEnd }, periods)) return null

    if (pointerDay > anchorEnd) {
        let endDate = weekEndOf(pointerDay)
        for (const period of periods) {
            if (period.startDate > anchorEnd && period.startDate <= endDate) {
                endDate = addDays(period.startDate, -1)
            }
        }
        return { startDate: anchorStart, endDate }
    }

    if (pointerDay < anchorStart) {
        let startDate = weekStartOf(pointerDay)
        for (const period of periods) {
            if (period.endDate < anchorStart && period.endDate >= startDate) {
                startDate = addDays(period.endDate, 1)
            }
        }
        return { startDate, endDate: anchorEnd }
    }

    return { startDate: anchorStart, endDate: anchorEnd }
}

/** Same length, new start snapped to the nearest Monday. */
export function movePeriod(period: DayRange, newStartDay: IsoDay): DayRange {
    const lengthDays = Math.round((toUtcMs(period.endDate) - toUtcMs(period.startDate)) / DAY_MS)
    const startDate = snapToWeekStart(newStartDay)
    return { startDate, endDate: addDays(startDate, lengthDays) }
}

/**
 * Resize one edge. For the right edge `day` is the exclusive end the timeline
 * reports (the Monday after the last week). A period never gets shorter than one week.
 */
export function resizePeriod(period: DayRange, edge: 'left' | 'right', day: IsoDay): DayRange {
    if (edge === 'left') {
        const latestStart = weekStartOf(period.endDate)
        const startDate = snapToWeekStart(day)
        return { startDate: startDate > latestStart ? latestStart : startDate, endDate: period.endDate }
    }

    const earliestEnd = addDays(period.startDate, 6)
    const endDate = addDays(snapToWeekStart(day), -1)
    return { startDate: period.startDate, endDate: endDate < earliestEnd ? earliestEnd : endDate }
}

/** Date range covered by a program, for the read-only row. */
export function programToRange(startDate: IsoDay, durationWeeks: number): DayRange {
    const days = Math.max(durationWeeks, 0) * 7
    return { startDate, endDate: days === 0 ? startDate : addDays(startDate, days - 1) }
}

/** A `@db.Date` column read through Prisma is midnight UTC of that day. */
export function dbDateToIsoDay(date: Date): IsoDay {
    return date.toISOString().slice(0, 10)
}

export function isoDayToDbDate(day: IsoDay): Date {
    return new Date(toUtcMs(day))
}

/** Local midnight of a day — the unit the timeline library works in. */
export function dayToLocalMs(day: IsoDay): number {
    const [year, month, date] = day.split('-').map(Number)
    return new Date(year, month - 1, date).getTime()
}

export function localMsToDay(ms: number): IsoDay {
    const date = new Date(ms)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const dayOfMonth = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${dayOfMonth}`
}

/** Pointer x (relative to the visible canvas) → timestamp inside the visible range. */
export function xToMs(x: number, width: number, visibleStart: number, visibleEnd: number): number {
    if (width <= 0) return visibleStart
    const ratio = Math.min(Math.max(x / width, 0), 1)
    return visibleStart + ratio * (visibleEnd - visibleStart)
}

export const PHASE_COLOR_PALETTE: readonly string[] = [
    '#2563eb', // blue
    '#dc2626', // red
    '#16a34a', // green
    '#f59e0b', // amber
    '#7c3aed', // violet
    '#db2777', // pink
    '#0891b2', // cyan
    '#ea580c', // orange
    '#4d7c0f', // olive
    '#0f766e', // teal
    '#9333ea', // purple
    '#475569', // slate
]

export const DEFAULT_PHASE_NAMES: readonly string[] = ['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3']

/** First palette colour not in use; cycles once the palette is exhausted. */
export function nextUnusedColor(usedColors: string[]): string {
    const used = new Set(usedColors.map((color) => color.toLowerCase()))
    const free = PHASE_COLOR_PALETTE.find((color) => !used.has(color))
    return free ?? PHASE_COLOR_PALETTE[usedColors.length % PHASE_COLOR_PALETTE.length]
}

/** Text colour with enough contrast on `hex`. Anything that is not a 6-digit hex gets dark text. */
export function readableTextColor(hex: string): '#ffffff' | '#111827' {
    if (!HEX_COLOR_PATTERN.test(hex)) return '#111827'

    const [red, green, blue] = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    return luminance > 0.179 ? '#111827' : '#ffffff'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/lib/macro-periods.test.ts`
Expected: PASS, all tests. If `readableTextColor('#fde047')` or `'#1e3a8a'` disagrees, the formula was mistyped — do not change the expectation.

- [ ] **Step 5: Type-check, changelog, commit**

Run: `npm run type-check` — expected: no errors.

```bash
git add src/lib/macro-periods.ts tests/unit/lib/macro-periods.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(planning): pure week, overlap and colour rules for macro periods"
```

---

### Task 3: Database tables and validation schemas

**Files:**
- Modify: `prisma/schema.prisma` (`User` relations block, and two new models appended after `MovementPatternColor`)
- Create: `prisma/migrations/20261011000000_add_macro_periods/migration.sql`
- Create: `src/schemas/macro-period.ts`
- Modify: `public/locales/it/validation.json`, `public/locales/en/validation.json`
- Test: `tests/unit/schemas/macro-period.test.ts`

**Interfaces:**
- Consumes: `isIsoDay`, `isValidPeriodRange` from `@/lib/macro-periods` (Task 2).
- Produces:
  - Prisma models `MacroPhaseType` (`prisma.macroPhaseType`) and `MacroPeriod` (`prisma.macroPeriod`), relation `MacroPhaseType.periods`.
  - `createMacroPhaseTypeSchema` → `{ name: string; description?: string | null; color: string }`
  - `updateMacroPhaseTypeSchema` → any of `name`, `description`, `color`, `sortOrder: number`, `isActive: boolean`; at least one.
  - `createMacroPeriodSchema` → `{ phaseTypeId: string; startDate: IsoDay; endDate: IsoDay; note?: string | null }`, range validated.
  - `updateMacroPeriodSchema` → any of `phaseTypeId`, `startDate`, `endDate`, `note`; at least one. **Does not** validate the range (the route does, after merging with the stored row).

- [ ] **Step 1: Write the failing schema tests**

`tests/unit/schemas/macro-period.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    createMacroPeriodSchema,
    createMacroPhaseTypeSchema,
    updateMacroPeriodSchema,
    updateMacroPhaseTypeSchema,
} from '@/schemas/macro-period'

const PHASE_ID = '22222222-2222-2222-2222-222222222222'

describe('createMacroPhaseTypeSchema', () => {
    it('accepts a name and a colour, and trims the name', () => {
        const result = createMacroPhaseTypeSchema.safeParse({ name: '  Forza  ', color: '#2563eb' })
        expect(result.success).toBe(true)
        expect(result.success && result.data.name).toBe('Forza')
    })

    it('accepts a description up to 200 characters and a null description', () => {
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'A', color: '#2563eb', description: 'x'.repeat(200) }).success).toBe(true)
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'A', color: '#2563eb', description: null }).success).toBe(true)
    })

    it.each([
        ['empty name', { name: '   ', color: '#2563eb' }],
        ['name of 41 characters', { name: 'x'.repeat(41), color: '#2563eb' }],
        ['description of 201 characters', { name: 'A', color: '#2563eb', description: 'x'.repeat(201) }],
        ['3-digit colour', { name: 'A', color: '#FFF' }],
        ['named colour', { name: 'A', color: 'red' }],
        ['missing colour', { name: 'A' }],
    ])('rejects %s', (_label, input) => {
        expect(createMacroPhaseTypeSchema.safeParse(input).success).toBe(false)
    })

    it('accepts a name of exactly 40 characters', () => {
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'x'.repeat(40), color: '#2563eb' }).success).toBe(true)
    })
})

describe('updateMacroPhaseTypeSchema', () => {
    it.each([{ name: 'Nuovo' }, { color: '#dc2626' }, { sortOrder: 0 }, { isActive: false }, { description: null }])(
        'accepts a single field %o',
        (input) => {
            expect(updateMacroPhaseTypeSchema.safeParse(input).success).toBe(true)
        }
    )

    it.each([
        ['empty body', {}],
        ['negative sortOrder', { sortOrder: -1 }],
        ['fractional sortOrder', { sortOrder: 1.5 }],
        ['isActive as a string', { isActive: 'false' }],
        ['bad colour', { color: 'blue' }],
    ])('rejects %s', (_label, input) => {
        expect(updateMacroPhaseTypeSchema.safeParse(input).success).toBe(false)
    })
})

describe('createMacroPeriodSchema', () => {
    const valid = { phaseTypeId: PHASE_ID, startDate: '2026-10-05', endDate: '2026-10-18' }

    it('accepts a Monday → Sunday range', () => {
        expect(createMacroPeriodSchema.safeParse(valid).success).toBe(true)
        expect(createMacroPeriodSchema.safeParse({ ...valid, note: 'x'.repeat(500) }).success).toBe(true)
    })

    it.each([
        ['start not on Monday', { ...valid, startDate: '2026-10-06' }],
        ['end not on Sunday', { ...valid, endDate: '2026-10-17' }],
        ['end before start', { ...valid, startDate: '2026-10-19' }],
        ['impossible date', { ...valid, startDate: '2026-02-30' }],
        ['date with time', { ...valid, startDate: '2026-10-05T00:00:00.000Z' }],
        ['phase id not a uuid', { ...valid, phaseTypeId: 'abc' }],
        ['note of 501 characters', { ...valid, note: 'x'.repeat(501) }],
        ['missing end', { phaseTypeId: PHASE_ID, startDate: '2026-10-05' }],
    ])('rejects %s', (_label, input) => {
        expect(createMacroPeriodSchema.safeParse(input).success).toBe(false)
    })

    it('reports the range problem with the macroPeriodInvalidRange key', () => {
        const result = createMacroPeriodSchema.safeParse({ ...valid, endDate: '2026-10-17' })
        expect(result.success).toBe(false)
        expect(!result.success && result.error.errors[0].message).toBe('validation.macroPeriodInvalidRange')
    })
})

describe('updateMacroPeriodSchema', () => {
    it.each([{ startDate: '2026-10-12' }, { endDate: '2026-10-25' }, { note: null }, { phaseTypeId: PHASE_ID }])(
        'accepts a single field %o',
        (input) => {
            expect(updateMacroPeriodSchema.safeParse(input).success).toBe(true)
        }
    )

    it('does not check the weekday of a lone date (the route merges first)', () => {
        expect(updateMacroPeriodSchema.safeParse({ startDate: '2026-10-07' }).success).toBe(true)
    })

    it.each([
        ['empty body', {}],
        ['impossible date', { endDate: '2026-02-30' }],
        ['phase id not a uuid', { phaseTypeId: 'abc' }],
    ])('rejects %s', (_label, input) => {
        expect(updateMacroPeriodSchema.safeParse(input).success).toBe(false)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/schemas/macro-period.test.ts`
Expected: FAIL — cannot resolve `@/schemas/macro-period`.

- [ ] **Step 3: Write the schemas**

`src/schemas/macro-period.ts`:

```ts
import { z } from 'zod'
import { isIsoDay, isValidPeriodRange } from '@/lib/macro-periods'

/**
 * Macro-period planning validation.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const isoDaySchema = z.string().refine(isIsoDay, 'validation.invalidDate')

const phaseNameSchema = z
    .string()
    .trim()
    .min(1, 'validation.macroPhaseNameRequired')
    .max(40, 'validation.macroPhaseNameTooLong')

const phaseDescriptionSchema = z.string().trim().max(200, 'validation.macroPhaseDescriptionTooLong').nullable()

const phaseColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.invalidColor')

const periodNoteSchema = z.string().trim().max(500, 'validation.macroPeriodNoteTooLong').nullable()

const hasAtLeastOneField = (value: Record<string, unknown>) => Object.keys(value).length > 0

export const createMacroPhaseTypeSchema = z.object({
    name: phaseNameSchema,
    description: phaseDescriptionSchema.optional(),
    color: phaseColorSchema,
})

export const updateMacroPhaseTypeSchema = z
    .object({
        name: phaseNameSchema.optional(),
        description: phaseDescriptionSchema.optional(),
        color: phaseColorSchema.optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
    })
    .refine(hasAtLeastOneField, 'validation.noFieldsToUpdate')

export const createMacroPeriodSchema = z
    .object({
        phaseTypeId: z.string().uuid('validation.invalidPhaseType'),
        startDate: isoDaySchema,
        endDate: isoDaySchema,
        note: periodNoteSchema.optional(),
    })
    .refine((value) => isValidPeriodRange(value.startDate, value.endDate), {
        message: 'validation.macroPeriodInvalidRange',
        path: ['endDate'],
    })

/** The range is validated in the route, after merging with the stored period. */
export const updateMacroPeriodSchema = z
    .object({
        phaseTypeId: z.string().uuid('validation.invalidPhaseType').optional(),
        startDate: isoDaySchema.optional(),
        endDate: isoDaySchema.optional(),
        note: periodNoteSchema.optional(),
    })
    .refine(hasAtLeastOneField, 'validation.noFieldsToUpdate')

export type CreateMacroPhaseTypeInput = z.infer<typeof createMacroPhaseTypeSchema>
export type UpdateMacroPhaseTypeInput = z.infer<typeof updateMacroPhaseTypeSchema>
export type CreateMacroPeriodInput = z.infer<typeof createMacroPeriodSchema>
export type UpdateMacroPeriodInput = z.infer<typeof updateMacroPeriodSchema>
```

Zod runs object-level refinements only when every field parsed, so an impossible date yields `validation.invalidDate` and a well-formed but misaligned one yields `validation.macroPeriodInvalidRange`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/schemas/macro-period.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the validation copy**

In `public/locales/it/validation.json`, inside the `validation` object, right after the `"measurementOutOfRange"` entry, add (use the Edit tool; skip any key that already exists — `invalidDate` does):

```json
        "macroPhaseNameRequired": "Il nome della fase è obbligatorio",
        "macroPhaseNameTooLong": "Il nome della fase può avere al massimo 40 caratteri",
        "macroPhaseDescriptionTooLong": "La descrizione può avere al massimo 200 caratteri",
        "invalidColor": "Colore non valido",
        "invalidPhaseType": "Fase non valida",
        "macroPeriodNoteTooLong": "La nota può avere al massimo 500 caratteri",
        "macroPeriodInvalidRange": "Il periodo deve iniziare di lunedì, finire di domenica e durare almeno una settimana",
        "noFieldsToUpdate": "Nessuna modifica da salvare",
```

Same place in `public/locales/en/validation.json`:

```json
        "macroPhaseNameRequired": "The phase name is required",
        "macroPhaseNameTooLong": "The phase name can be at most 40 characters",
        "macroPhaseDescriptionTooLong": "The description can be at most 200 characters",
        "invalidColor": "Invalid colour",
        "invalidPhaseType": "Invalid phase",
        "macroPeriodNoteTooLong": "The note can be at most 500 characters",
        "macroPeriodInvalidRange": "A period must start on a Monday, end on a Sunday and last at least one week",
        "noFieldsToUpdate": "Nothing to save",
```

Run: `node -e "for (const l of ['it','en']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/validation.json','utf8').replace(/^﻿/,''))"`
Expected: no output (both files are valid JSON).

- [ ] **Step 6: Add the Prisma models**

In `prisma/schema.prisma`, in `model User`, after the line `movementPatternColors    MovementPatternColor[]       @relation("TrainerPatternColors")`, add:

```prisma
  macroPhaseTypes          MacroPhaseType[]             @relation("TrainerMacroPhaseTypes")
  macroPeriodsAsTrainer    MacroPeriod[]                @relation("TrainerMacroPeriods")
  macroPeriodsAsTrainee    MacroPeriod[]                @relation("TraineeMacroPeriods")
```

After the closing brace of `model MovementPatternColor`, add:

```prisma
model MacroPhaseType {
  id          String   @id @default(uuid())
  trainerId   String
  name        String
  description String?
  color       String   // Hex color (es. "#2563eb")
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  // Relations
  trainer User          @relation("TrainerMacroPhaseTypes", fields: [trainerId], references: [id], onDelete: Cascade)
  periods MacroPeriod[] @relation("PhaseTypePeriods")

  @@unique([trainerId, name])
  @@index([trainerId, isActive])
  @@map("macro_phase_types")
}

model MacroPeriod {
  id          String   @id @default(uuid())
  traineeId   String
  trainerId   String
  phaseTypeId String
  startDate   DateTime @db.Date // Sempre un lunedì
  endDate     DateTime @db.Date // Sempre una domenica, inclusa
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  trainee   User           @relation("TraineeMacroPeriods", fields: [traineeId], references: [id], onDelete: Cascade)
  trainer   User           @relation("TrainerMacroPeriods", fields: [trainerId], references: [id], onDelete: Cascade)
  // NoAction (non Restrict): Restrict è immediato e bloccherebbe l'eliminazione a cascata di un trainer
  phaseType MacroPhaseType @relation("PhaseTypePeriods", fields: [phaseTypeId], references: [id], onDelete: NoAction)

  @@index([traineeId, startDate])
  @@index([trainerId])
  @@map("macro_periods")
}
```

- [ ] **Step 7: Write the migration SQL**

Create `prisma/migrations/20261011000000_add_macro_periods/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "macro_phase_types" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macro_phase_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_periods" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "phaseTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macro_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "macro_phase_types_trainerId_name_key" ON "macro_phase_types"("trainerId", "name");

-- CreateIndex
CREATE INDEX "macro_phase_types_trainerId_isActive_idx" ON "macro_phase_types"("trainerId", "isActive");

-- CreateIndex
CREATE INDEX "macro_periods_traineeId_startDate_idx" ON "macro_periods"("traineeId", "startDate");

-- CreateIndex
CREATE INDEX "macro_periods_trainerId_idx" ON "macro_periods"("trainerId");

-- AddForeignKey
ALTER TABLE "macro_phase_types" ADD CONSTRAINT "macro_phase_types_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_phaseTypeId_fkey" FOREIGN KEY ("phaseTypeId") REFERENCES "macro_phase_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
```

- [ ] **Step 8: Generate the client and check the migration**

Run: `npx prisma validate && npm run prisma:generate`
Expected: "The schema at prisma/schema.prisma is valid" and a generated client. Then `npm run type-check` — expected: no errors.

If a development database is reachable (`DIRECT_URL` set), also run `npx prisma migrate dev`. Expected: `20261011000000_add_macro_periods` is applied and Prisma reports the schema in sync. If Prisma proposes to create an *additional* migration, the hand-written SQL differs from the schema: fix the SQL file, do not accept the extra migration. If no database is reachable, say so in the task report — do not skip silently.

- [ ] **Step 9: Changelog and commit**

The changelog entry must carry this release note: **applicare la migration `20261011000000_add_macro_periods` prima del deploy del codice** (additiva, compatibile con il codice precedente).

```bash
git add prisma/schema.prisma prisma/migrations/20261011000000_add_macro_periods src/schemas/macro-period.ts tests/unit/schemas/macro-period.test.ts public/locales/it/validation.json public/locales/en/validation.json implementation-docs/CHANGELOG.md
git commit -m "feat(planning): macro phase and period tables with validation schemas"
```

---

### Task 4: Phase types API

**Files:**
- Create: `src/lib/macro-period-queries.ts`
- Create: `src/app/api/macro-phase-types/route.ts`
- Create: `src/app/api/macro-phase-types/[id]/route.ts`
- Modify: `public/locales/it/errors.json`, `public/locales/en/errors.json`
- Test: `tests/integration/macro-phase-types.test.ts`

**Interfaces:**
- Consumes: `createMacroPhaseTypeSchema`, `updateMacroPhaseTypeSchema` (Task 3); `DEFAULT_PHASE_NAMES`, `PHASE_COLOR_PALETTE`, `dbDateToIsoDay`, DTO types (Task 2).
- Produces:
  - `GET /api/macro-phase-types` → `{ items: MacroPhaseTypeDto[] }`
  - `POST /api/macro-phase-types` body `{ name, description?, color }` → `201 { phaseType: MacroPhaseTypeDto }`
  - `PATCH /api/macro-phase-types/[id]` body any of `{ name, description, color, sortOrder, isActive }` → `{ phaseType: MacroPhaseTypeDto }`
  - `DELETE /api/macro-phase-types/[id]` → `{ id: string }`
  - From `src/lib/macro-period-queries.ts`: `PHASE_TYPE_SELECT`, `toPhaseTypeDto(row)`, `PERIOD_SELECT`, `toPeriodDto(row)`, `PLAN_PROGRAM_SELECT`, `toPlanProgramDto(row)`, `findPhaseNameClash(trainerId: string, name: string, ignoreId?: string): Promise<{ id: string } | null>`.
  - Error keys: `macroPhase.notFound`, `macroPhase.nameExists`, `macroPhase.inUse`, `macroPhase.archived`, `macroPeriod.notFound`, `macroPeriod.overlap`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/macro-phase-types.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/macro-phase-types/route'
import { PATCH, DELETE } from '@/app/api/macro-phase-types/[id]/route'
import { requireRole } from '@/lib/auth'
import { PHASE_COLOR_PALETTE } from '@/lib/macro-periods'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asForbidden, asUnauthenticated } from '../helpers/auth-mock'

const TRAINER_ID = 'trainer-uuid-1'
const PHASE_ID = '22222222-2222-2222-2222-222222222222'

const phaseRow = (overrides: Record<string, unknown> = {}) => ({
    id: PHASE_ID,
    name: 'Forza',
    description: 'Carichi alti',
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    _count: { periods: 0 },
    ...overrides,
})

const withId = (id: string) => ({ params: Promise.resolve({ id }) })

const request = (method: string, body?: unknown, url = 'http://localhost:3000/api/macro-phase-types') =>
    new NextRequest(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/macro-phase-types', () => {
    it('lists the trainer phases with their usage count', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany.mockResolvedValue([phaseRow({ _count: { periods: 3 } })] as never)

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(requireRole).toHaveBeenCalledWith('trainer')
        expect(body.data.items).toEqual([
            { id: PHASE_ID, name: 'Forza', description: 'Carichi alti', color: '#2563eb', sortOrder: 0, isActive: true, usageCount: 3 },
        ])
        expect(prismaMock.macroPhaseType.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { trainerId: TRAINER_ID } })
        )
        expect(prismaMock.macroPhaseType.createMany).not.toHaveBeenCalled()
    })

    it('creates the three placeholders when the trainer has no phases', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce([
                phaseRow({ id: 'a', name: 'Tipo fase 1' }),
                phaseRow({ id: 'b', name: 'Tipo fase 2', sortOrder: 1 }),
                phaseRow({ id: 'c', name: 'Tipo fase 3', sortOrder: 2 }),
            ] as never)
        prismaMock.macroPhaseType.createMany.mockResolvedValue({ count: 3 } as never)

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items.map((item: { name: string }) => item.name)).toEqual(['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3'])
        expect(prismaMock.macroPhaseType.createMany).toHaveBeenCalledWith({
            data: [
                { trainerId: TRAINER_ID, name: 'Tipo fase 1', color: PHASE_COLOR_PALETTE[0], sortOrder: 0 },
                { trainerId: TRAINER_ID, name: 'Tipo fase 2', color: PHASE_COLOR_PALETTE[1], sortOrder: 1 },
                { trainerId: TRAINER_ID, name: 'Tipo fase 3', color: PHASE_COLOR_PALETTE[2], sortOrder: 2 },
            ],
            skipDuplicates: true,
        })
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await GET()).status).toBe(401)

        asForbidden()
        expect((await GET()).status).toBe(403)
        expect(prismaMock.macroPhaseType.findMany).not.toHaveBeenCalled()
    })

    it('answers 500 when the database fails', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany.mockRejectedValue(new Error('db down'))

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })
})

describe('POST /api/macro-phase-types', () => {
    it('creates a phase at the end of the list', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)
        prismaMock.macroPhaseType.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } } as never)
        prismaMock.macroPhaseType.create.mockResolvedValue(phaseRow({ sortOrder: 5 }) as never)

        const res = await POST(request('POST', { name: ' Forza ', description: 'Carichi alti', color: '#2563eb' }))
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.phaseType).toMatchObject({ id: PHASE_ID, name: 'Forza', sortOrder: 5, usageCount: 0 })
        expect(prismaMock.macroPhaseType.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { trainerId: TRAINER_ID, name: 'Forza', description: 'Carichi alti', color: '#2563eb', sortOrder: 5 },
            })
        )
    })

    it('starts at sortOrder 0 for the first phase and stores a missing description as null', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)
        prismaMock.macroPhaseType.aggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
        prismaMock.macroPhaseType.create.mockResolvedValue(phaseRow({ description: null }) as never)

        await POST(request('POST', { name: 'Forza', color: '#2563eb' }))

        expect(prismaMock.macroPhaseType.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { trainerId: TRAINER_ID, name: 'Forza', description: null, color: '#2563eb', sortOrder: 0 },
            })
        )
    })

    it('rejects a name already used by this trainer, ignoring case', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: 'other' } as never)

        const res = await POST(request('POST', { name: 'forza', color: '#2563eb' }))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatchObject({ code: 'CONFLICT', key: 'macroPhase.nameExists' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { trainerId: TRAINER_ID, name: { equals: 'forza', mode: 'insensitive' } },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.create).not.toHaveBeenCalled()
    })

    it('rejects an invalid body with 400', async () => {
        asTrainer()

        const res = await POST(request('POST', { name: '', color: 'red' }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.macroPhaseType.create).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await POST(request('POST', { name: 'A', color: '#2563eb' }))).status).toBe(401)

        asForbidden()
        expect((await POST(request('POST', { name: 'A', color: '#2563eb' }))).status).toBe(403)
    })
})

describe('PATCH /api/macro-phase-types/[id]', () => {
    it('updates the given fields of an owned phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValueOnce({ id: PHASE_ID } as never).mockResolvedValueOnce(null)
        prismaMock.macroPhaseType.update.mockResolvedValue(phaseRow({ name: 'Ipertrofia', color: '#dc2626' }) as never)

        const res = await PATCH(request('PATCH', { name: 'Ipertrofia', color: '#dc2626' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.phaseType).toMatchObject({ name: 'Ipertrofia', color: '#dc2626' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PHASE_ID }, data: { name: 'Ipertrofia', color: '#dc2626' } })
        )
    })

    it('archives a phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID } as never)
        prismaMock.macroPhaseType.update.mockResolvedValue(phaseRow({ isActive: false }) as never)

        const res = await PATCH(request('PATCH', { isActive: false }), withId(PHASE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PHASE_ID }, data: { isActive: false } })
        )
        // no name in the body → no name-clash lookup
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledTimes(1)
    })

    it('rejects a rename onto another phase name', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst
            .mockResolvedValueOnce({ id: PHASE_ID } as never)
            .mockResolvedValueOnce({ id: 'other' } as never)

        const res = await PATCH(request('PATCH', { name: 'Scarico' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('macroPhase.nameExists')
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenNthCalledWith(2, {
            where: { trainerId: TRAINER_ID, name: { equals: 'Scarico', mode: 'insensitive' }, id: { not: PHASE_ID } },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.update).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('macroPhase.notFound')
        expect(prismaMock.macroPhaseType.update).not.toHaveBeenCalled()
    })

    it('rejects an empty body with 400', async () => {
        asTrainer()

        const res = await PATCH(request('PATCH', {}), withId(PHASE_ID))

        expect(res.status).toBe(400)
        expect(prismaMock.macroPhaseType.findFirst).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))).status).toBe(401)

        asForbidden()
        expect((await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))).status).toBe(403)
    })
})

describe('DELETE /api/macro-phase-types/[id]', () => {
    it('deletes a phase that no period uses', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, _count: { periods: 0 } } as never)
        prismaMock.macroPhaseType.delete.mockResolvedValue(phaseRow() as never)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual({ id: PHASE_ID })
        expect(prismaMock.macroPhaseType.delete).toHaveBeenCalledWith({ where: { id: PHASE_ID } })
    })

    it('refuses to delete a phase in use', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, _count: { periods: 2 } } as never)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatchObject({ code: 'CONFLICT', key: 'macroPhase.inUse' })
        expect(prismaMock.macroPhaseType.delete).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))

        expect(res.status).toBe(404)
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, _count: { select: { periods: true } } },
        })
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await DELETE(request('DELETE'), withId(PHASE_ID))).status).toBe(401)

        asForbidden()
        expect((await DELETE(request('DELETE'), withId(PHASE_ID))).status).toBe(403)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integration/macro-phase-types.test.ts`
Expected: FAIL — cannot resolve `@/app/api/macro-phase-types/route`.

- [ ] **Step 3: Write the shared query helpers**

`src/lib/macro-period-queries.ts`:

```ts
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
    dbDateToIsoDay,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
} from './macro-periods'

export const PHASE_TYPE_SELECT = {
    id: true,
    name: true,
    description: true,
    color: true,
    sortOrder: true,
    isActive: true,
    _count: { select: { periods: true } },
} satisfies Prisma.MacroPhaseTypeSelect

type PhaseTypeRow = Prisma.MacroPhaseTypeGetPayload<{ select: typeof PHASE_TYPE_SELECT }>

export function toPhaseTypeDto({ _count, ...phase }: PhaseTypeRow): MacroPhaseTypeDto {
    return { ...phase, usageCount: _count.periods }
}

export const PERIOD_SELECT = {
    id: true,
    startDate: true,
    endDate: true,
    note: true,
    phaseType: { select: { id: true, name: true, color: true, isActive: true } },
} satisfies Prisma.MacroPeriodSelect

type PeriodRow = Prisma.MacroPeriodGetPayload<{ select: typeof PERIOD_SELECT }>

export function toPeriodDto(period: PeriodRow): MacroPeriodDto {
    return {
        id: period.id,
        startDate: dbDateToIsoDay(period.startDate),
        endDate: dbDateToIsoDay(period.endDate),
        note: period.note,
        phaseType: period.phaseType,
    }
}

export const PLAN_PROGRAM_SELECT = {
    id: true,
    title: true,
    status: true,
    startDate: true,
    durationWeeks: true,
} satisfies Prisma.TrainingProgramSelect

type PlanProgramRow = Prisma.TrainingProgramGetPayload<{ select: typeof PLAN_PROGRAM_SELECT }>

/** Null for a program without a start date: it has no place on a timeline. */
export function toPlanProgramDto(program: PlanProgramRow): PlanProgramDto | null {
    if (!program.startDate) return null
    return {
        id: program.id,
        title: program.title,
        status: program.status,
        startDate: dbDateToIsoDay(program.startDate),
        durationWeeks: program.durationWeeks,
    }
}

/** Phase names are unique per trainer whatever the letter case. */
export function findPhaseNameClash(trainerId: string, name: string, ignoreId?: string) {
    return prisma.macroPhaseType.findFirst({
        where: {
            trainerId,
            name: { equals: name, mode: 'insensitive' },
            ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
        select: { id: true },
    })
}
```

- [ ] **Step 4: Write the collection route**

`src/app/api/macro-phase-types/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { DEFAULT_PHASE_NAMES, PHASE_COLOR_PALETTE } from '@/lib/macro-periods'
import { PHASE_TYPE_SELECT, findPhaseNameClash, toPhaseTypeDto } from '@/lib/macro-period-queries'
import { createMacroPhaseTypeSchema } from '@/schemas/macro-period'

const listPhaseTypes = (trainerId: string) =>
    prisma.macroPhaseType.findMany({
        where: { trainerId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: PHASE_TYPE_SELECT,
    })

/**
 * GET /api/macro-phase-types
 * Every phase of the authenticated trainer, archived ones included.
 * A trainer without phases gets three placeholders to rename.
 */
export async function GET() {
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        let phaseTypes = await listPhaseTypes(trainerId)

        if (phaseTypes.length === 0) {
            // skipDuplicates: two concurrent first calls must not fail on the unique (trainerId, name)
            await prisma.macroPhaseType.createMany({
                data: DEFAULT_PHASE_NAMES.map((name, index) => ({
                    trainerId,
                    name,
                    color: PHASE_COLOR_PALETTE[index],
                    sortOrder: index,
                })),
                skipDuplicates: true,
            })
            phaseTypes = await listPhaseTypes(trainerId)
        }

        return apiSuccess({ items: phaseTypes.map(toPhaseTypeDto) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching macro phase types',
            message: 'Failed to fetch macro phase types',
            key: 'internal.default',
        })
    }
}

/**
 * POST /api/macro-phase-types
 * Body: { name, description?, color }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = createMacroPhaseTypeSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const { name, description, color } = validation.data

        if (await findPhaseNameClash(trainerId, name)) {
            return apiError('CONFLICT', 'A phase with this name already exists', 409, undefined, 'macroPhase.nameExists')
        }

        const last = await prisma.macroPhaseType.aggregate({ where: { trainerId }, _max: { sortOrder: true } })
        const sortOrder = last._max.sortOrder === null ? 0 : last._max.sortOrder + 1

        const phaseType = await prisma.macroPhaseType.create({
            data: { trainerId, name, description: description ?? null, color, sortOrder },
            select: PHASE_TYPE_SELECT,
        })

        logger.info({ trainerId, phaseTypeId: phaseType.id }, 'Macro phase type created')

        return apiSuccess({ phaseType: toPhaseTypeDto(phaseType) }, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating macro phase type',
            message: 'Failed to create macro phase type',
            key: 'internal.default',
        })
    }
}
```

- [ ] **Step 5: Write the item route**

`src/app/api/macro-phase-types/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { PHASE_TYPE_SELECT, findPhaseNameClash, toPhaseTypeDto } from '@/lib/macro-period-queries'
import { updateMacroPhaseTypeSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')

/**
 * PATCH /api/macro-phase-types/[id]
 * Body: any of { name, description, color, sortOrder, isActive }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = updateMacroPhaseTypeSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        // One query: a phase of another trainer is indistinguishable from a missing one
        const existing = await prisma.macroPhaseType.findFirst({ where: { id, trainerId }, select: { id: true } })
        if (!existing) return notFound()

        const { name } = validation.data
        if (name !== undefined && (await findPhaseNameClash(trainerId, name, id))) {
            return apiError('CONFLICT', 'A phase with this name already exists', 409, undefined, 'macroPhase.nameExists')
        }

        const phaseType = await prisma.macroPhaseType.update({
            where: { id },
            data: validation.data,
            select: PHASE_TYPE_SELECT,
        })

        logger.info({ trainerId, phaseTypeId: id }, 'Macro phase type updated')

        return apiSuccess({ phaseType: toPhaseTypeDto(phaseType) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating macro phase type',
            message: 'Failed to update macro phase type',
            key: 'internal.default',
            context: { phaseTypeId: id },
        })
    }
}

/**
 * DELETE /api/macro-phase-types/[id]
 * Only a phase no period uses can be deleted; a used one is archived instead.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const existing = await prisma.macroPhaseType.findFirst({
            where: { id, trainerId },
            select: { id: true, _count: { select: { periods: true } } },
        })
        if (!existing) return notFound()

        if (existing._count.periods > 0) {
            return apiError('CONFLICT', 'Macro phase type is used by one or more periods', 409, undefined, 'macroPhase.inUse')
        }

        await prisma.macroPhaseType.delete({ where: { id } })

        logger.info({ trainerId, phaseTypeId: id }, 'Macro phase type deleted')

        return apiSuccess({ id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting macro phase type',
            message: 'Failed to delete macro phase type',
            key: 'internal.default',
            context: { phaseTypeId: id },
        })
    }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run tests/integration/macro-phase-types.test.ts`
Expected: PASS.

- [ ] **Step 7: Add the error copy**

In `public/locales/it/errors.json`, add two top-level objects right after the `"movementPattern": { … }` object (Edit tool):

```json
    "macroPhase": {
        "notFound": "Fase non trovata",
        "nameExists": "Esiste già una fase con questo nome",
        "inUse": "Impossibile eliminare la fase: è usata in uno o più periodi. Puoi archiviarla.",
        "archived": "Questa fase è archiviata: riattivala dal profilo o scegline un'altra"
    },
    "macroPeriod": {
        "notFound": "Periodo non trovato",
        "overlap": "Il periodo si sovrappone a un altro già pianificato"
    },
```

Same place in `public/locales/en/errors.json`:

```json
    "macroPhase": {
        "notFound": "Phase not found",
        "nameExists": "A phase with this name already exists",
        "inUse": "This phase cannot be deleted: one or more periods use it. You can archive it.",
        "archived": "This phase is archived: reactivate it from your profile or choose another one"
    },
    "macroPeriod": {
        "notFound": "Period not found",
        "overlap": "The period overlaps another planned period"
    },
```

Run: `node -e "for (const l of ['it','en']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/errors.json','utf8').replace(/^﻿/,''))"`
Expected: no output.

- [ ] **Step 8: Full checks, changelog, commit**

Run: `npm run type-check && npm run lint` — expected: no errors.

```bash
git add src/lib/macro-period-queries.ts src/app/api/macro-phase-types tests/integration/macro-phase-types.test.ts public/locales/it/errors.json public/locales/en/errors.json implementation-docs/CHANGELOG.md
git commit -m "feat(planning): trainer-defined macro phase types API"
```

---

### Task 5: Macro periods API

**Files:**
- Create: `src/app/api/trainer/trainees/[id]/macro-periods/route.ts`
- Create: `src/app/api/macro-periods/[id]/route.ts`
- Test: `tests/integration/macro-periods.test.ts`

**Interfaces:**
- Consumes: `createMacroPeriodSchema`, `updateMacroPeriodSchema` (Task 3); `PERIOD_SELECT`, `toPeriodDto`, `PLAN_PROGRAM_SELECT`, `toPlanProgramDto` (Task 4); `isValidPeriodRange`, `isoDayToDbDate`, `dbDateToIsoDay` (Task 2).
- Produces:
  - `GET /api/trainer/trainees/[id]/macro-periods` → `{ periods: MacroPeriodDto[]; programs: PlanProgramDto[] }`
  - `POST /api/trainer/trainees/[id]/macro-periods` body `{ phaseTypeId, startDate, endDate, note? }` → `201 { period: MacroPeriodDto }`
  - `PATCH /api/macro-periods/[id]` body any of `{ phaseTypeId, startDate, endDate, note }` → `{ period: MacroPeriodDto }`
  - `DELETE /api/macro-periods/[id]` → `{ id: string }`

- [ ] **Step 1: Write the failing tests**

`tests/integration/macro-periods.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/trainer/trainees/[id]/macro-periods/route'
import { PATCH, DELETE } from '@/app/api/macro-periods/[id]/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asForbidden, asUnauthenticated } from '../helpers/auth-mock'

const TRAINER_ID = 'trainer-uuid-1'
const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const PHASE_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_PHASE_ID = '33333333-3333-3333-3333-333333333333'
const PERIOD_ID = '44444444-4444-4444-4444-444444444444'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const periodRow = (overrides: Record<string, unknown> = {}) => ({
    id: PERIOD_ID,
    startDate: day('2026-10-05'),
    endDate: day('2026-10-18'),
    note: null,
    phaseType: { id: PHASE_ID, name: 'Forza', color: '#2563eb', isActive: true },
    ...overrides,
})

const storedPeriod = {
    id: PERIOD_ID,
    traineeId: TRAINEE_ID,
    phaseTypeId: PHASE_ID,
    startDate: day('2026-10-05'),
    endDate: day('2026-10-18'),
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) })

const request = (method: string, body?: unknown) =>
    new NextRequest('http://localhost:3000/api/x', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/trainer/trainees/[id]/macro-periods', () => {
    it('returns the periods of this trainer and the dated programs', async () => {
        asTrainer()
        prismaMock.macroPeriod.findMany.mockResolvedValue([periodRow()] as never)
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            { id: 'prog-1', title: 'Scheda A', status: 'active', startDate: day('2026-10-07'), durationWeeks: 4 },
        ] as never)

        const res = await GET(request('GET'), withId(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(body.data.periods).toEqual([
            {
                id: PERIOD_ID,
                startDate: '2026-10-05',
                endDate: '2026-10-18',
                note: null,
                phaseType: { id: PHASE_ID, name: 'Forza', color: '#2563eb', isActive: true },
            },
        ])
        expect(body.data.programs).toEqual([
            { id: 'prog-1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 },
        ])
        expect(prismaMock.macroPeriod.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID, trainerId: TRAINER_ID }, orderBy: { startDate: 'asc' } })
        )
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID, trainerId: TRAINER_ID, startDate: { not: null } } })
        )
    })

    it('answers 403 for a trainee of another trainer, without reading anything', async () => {
        asForeignTrainer()

        const res = await GET(request('GET'), withId(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.findMany).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await GET(request('GET'), withId(TRAINEE_ID))).status).toBe(401)

        asForbidden()
        expect((await GET(request('GET'), withId(TRAINEE_ID))).status).toBe(403)
    })
})

describe('POST /api/trainer/trainees/[id]/macro-periods', () => {
    const body = { phaseTypeId: PHASE_ID, startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' }

    it('creates a period on free weeks', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)
        prismaMock.macroPeriod.create.mockResolvedValue(periodRow({ note: 'Blocco 1' }) as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(201)
        expect(json.data.period).toMatchObject({ id: PERIOD_ID, startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, isActive: true },
        })
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenCalledWith({
            where: {
                traineeId: TRAINEE_ID,
                trainerId: TRAINER_ID,
                startDate: { lte: day('2026-10-18') },
                endDate: { gte: day('2026-10-05') },
            },
            select: { id: true },
        })
        expect(prismaMock.macroPeriod.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    traineeId: TRAINEE_ID,
                    trainerId: TRAINER_ID,
                    phaseTypeId: PHASE_ID,
                    startDate: day('2026-10-05'),
                    endDate: day('2026-10-18'),
                    note: 'Blocco 1',
                },
            })
        )
    })

    it('answers 409 when the weeks are already taken', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.findFirst.mockResolvedValue({ id: 'other' } as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error).toMatchObject({ code: 'CONFLICT', key: 'macroPeriod.overlap' })
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 409 for an archived phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: false } as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPhase.archived')
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('macroPhase.notFound')
    })

    it.each([
        ['a start that is not a Monday', { ...body, startDate: '2026-10-06' }],
        ['an end that is not a Sunday', { ...body, endDate: '2026-10-17' }],
        ['a missing phase', { startDate: '2026-10-05', endDate: '2026-10-18' }],
    ])('rejects %s with 400', async (_label, invalid) => {
        asTrainer()

        const res = await POST(request('POST', invalid), withId(TRAINEE_ID))

        expect(res.status).toBe(400)
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 403 for a trainee of another trainer', async () => {
        asForeignTrainer()

        const res = await POST(request('POST', body), withId(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 401 without a session', async () => {
        asUnauthenticated()
        expect((await POST(request('POST', body), withId(TRAINEE_ID))).status).toBe(401)
    })
})

describe('PATCH /api/macro-periods/[id]', () => {
    it('moves a period, checking overlap against the others only', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(
            periodRow({ startDate: day('2026-10-12'), endDate: day('2026-10-25') }) as never
        )

        const res = await PATCH(request('PATCH', { startDate: '2026-10-12', endDate: '2026-10-25' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.period).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-25' })
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: PERIOD_ID, trainerId: TRAINER_ID },
            select: { id: true, traineeId: true, phaseTypeId: true, startDate: true, endDate: true },
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                traineeId: TRAINEE_ID,
                trainerId: TRAINER_ID,
                id: { not: PERIOD_ID },
                startDate: { lte: day('2026-10-25') },
                endDate: { gte: day('2026-10-12') },
            },
            select: { id: true },
        })
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: PERIOD_ID },
                data: { startDate: day('2026-10-12'), endDate: day('2026-10-25') },
            })
        )
    })

    it('resizes one edge by merging with the stored dates', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow({ endDate: day('2026-11-01') }) as never)

        const res = await PATCH(request('PATCH', { endDate: '2026-11-01' }), withId(PERIOD_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { endDate: day('2026-11-01') } })
        )
    })

    it('rejects a merged range that is not whole weeks', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)

        // 2026-10-04 is a Sunday before the stored Monday start → end <= start
        const res = await PATCH(request('PATCH', { endDate: '2026-10-04' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.macroPeriodInvalidRange')
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('answers 409 when the new range overlaps another period', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst
            .mockResolvedValueOnce(storedPeriod as never)
            .mockResolvedValueOnce({ id: 'other' } as never)

        const res = await PATCH(request('PATCH', { endDate: '2026-11-01' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPeriod.overlap')
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('changes the phase when the new one is active and owned', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: OTHER_PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow() as never)

        const res = await PATCH(request('PATCH', { phaseTypeId: OTHER_PHASE_ID }), withId(PERIOD_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: OTHER_PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, isActive: true },
        })
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { phaseTypeId: OTHER_PHASE_ID } })
        )
    })

    it('refuses to change the phase to an archived one', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: OTHER_PHASE_ID, isActive: false } as never)

        const res = await PATCH(request('PATCH', { phaseTypeId: OTHER_PHASE_ID }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPhase.archived')
    })

    it('lets a period on an archived phase be moved without re-checking the phase', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow() as never)

        // same phase id sent back by the dialog: not a phase change
        const res = await PATCH(
            request('PATCH', { phaseTypeId: PHASE_ID, startDate: '2026-10-12', endDate: '2026-10-25' }),
            withId(PERIOD_ID)
        )

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.findFirst).not.toHaveBeenCalled()
    })

    it('answers 404 for a period of another trainer', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)

        const res = await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('macroPeriod.notFound')
    })

    it('answers 403 when the trainee no longer belongs to the trainer', async () => {
        asForeignTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)

        const res = await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('rejects an empty body with 400, and answers 401 without a session', async () => {
        asTrainer()
        expect((await PATCH(request('PATCH', {}), withId(PERIOD_ID))).status).toBe(400)

        asUnauthenticated()
        expect((await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))).status).toBe(401)
    })
})

describe('DELETE /api/macro-periods/[id]', () => {
    it('deletes an owned period', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        prismaMock.macroPeriod.delete.mockResolvedValue(storedPeriod as never)

        const res = await DELETE(request('DELETE'), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ id: PERIOD_ID })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(prismaMock.macroPeriod.delete).toHaveBeenCalledWith({ where: { id: PERIOD_ID } })
    })

    it('answers 404 for a period of another trainer', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)

        const res = await DELETE(request('DELETE'), withId(PERIOD_ID))

        expect(res.status).toBe(404)
        expect(prismaMock.macroPeriod.delete).not.toHaveBeenCalled()
    })

    it('answers 403 when the trainee no longer belongs to the trainer, 401 without a session', async () => {
        asForeignTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        expect((await DELETE(request('DELETE'), withId(PERIOD_ID))).status).toBe(403)
        expect(prismaMock.macroPeriod.delete).not.toHaveBeenCalled()

        asUnauthenticated()
        expect((await DELETE(request('DELETE'), withId(PERIOD_ID))).status).toBe(401)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integration/macro-periods.test.ts`
Expected: FAIL — cannot resolve the two route modules.

- [ ] **Step 3: Write the trainee collection route**

`src/app/api/trainer/trainees/[id]/macro-periods/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireTrainerOwnership } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { isoDayToDbDate, type PlanProgramDto } from '@/lib/macro-periods'
import { PERIOD_SELECT, PLAN_PROGRAM_SELECT, toPeriodDto, toPlanProgramDto } from '@/lib/macro-period-queries'
import { createMacroPeriodSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/trainer/trainees/[id]/macro-periods
 * The trainee's plan as built by the calling trainer, plus the trainee's dated
 * programs for the read-only row of the timeline.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { id: traineeId } = await params
    try {
        const session = await requireTrainerOwnership(traineeId)
        const trainerId = session.user.id

        const [periods, programs] = await Promise.all([
            prisma.macroPeriod.findMany({
                where: { traineeId, trainerId },
                orderBy: { startDate: 'asc' },
                select: PERIOD_SELECT,
            }),
            prisma.trainingProgram.findMany({
                where: { traineeId, trainerId, startDate: { not: null } },
                orderBy: { startDate: 'asc' },
                select: PLAN_PROGRAM_SELECT,
            }),
        ])

        return apiSuccess({
            periods: periods.map(toPeriodDto),
            programs: programs.map(toPlanProgramDto).filter((program): program is PlanProgramDto => program !== null),
        })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching macro periods',
            message: 'Failed to fetch macro periods',
            key: 'internal.default',
            context: { traineeId },
        })
    }
}

/**
 * POST /api/trainer/trainees/[id]/macro-periods
 * Body: { phaseTypeId, startDate, endDate, note? } — whole weeks, no overlap.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
    const { id: traineeId } = await params
    try {
        const session = await requireTrainerOwnership(traineeId)
        const trainerId = session.user.id

        const validation = createMacroPeriodSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const { phaseTypeId, note } = validation.data
        const startDate = isoDayToDbDate(validation.data.startDate)
        const endDate = isoDayToDbDate(validation.data.endDate)

        const phaseType = await prisma.macroPhaseType.findFirst({
            where: { id: phaseTypeId, trainerId },
            select: { id: true, isActive: true },
        })
        if (!phaseType) {
            return apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')
        }
        if (!phaseType.isActive) {
            return apiError('CONFLICT', 'Macro phase type is archived', 409, undefined, 'macroPhase.archived')
        }

        // The overlap read belongs to the atomic unit: check and insert together
        const period = await prisma.$transaction(async (tx) => {
            const clash = await tx.macroPeriod.findFirst({
                where: { traineeId, trainerId, startDate: { lte: endDate }, endDate: { gte: startDate } },
                select: { id: true },
            })
            if (clash) return null

            return tx.macroPeriod.create({
                data: { traineeId, trainerId, phaseTypeId, startDate, endDate, note: note ?? null },
                select: PERIOD_SELECT,
            })
        })

        if (!period) {
            return apiError('CONFLICT', 'The period overlaps another period', 409, undefined, 'macroPeriod.overlap')
        }

        logger.info({ trainerId, traineeId, periodId: period.id }, 'Macro period created')

        return apiSuccess({ period: toPeriodDto(period) }, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating macro period',
            message: 'Failed to create macro period',
            key: 'internal.default',
            context: { traineeId },
        })
    }
}
```

- [ ] **Step 4: Write the item route**

`src/app/api/macro-periods/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { dbDateToIsoDay, isValidPeriodRange, isoDayToDbDate } from '@/lib/macro-periods'
import { PERIOD_SELECT, toPeriodDto } from '@/lib/macro-period-queries'
import { updateMacroPeriodSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => apiError('NOT_FOUND', 'Macro period not found', 404, undefined, 'macroPeriod.notFound')

/** A period of another trainer is indistinguishable from a missing one. */
const findOwnedPeriod = (id: string, trainerId: string) =>
    prisma.macroPeriod.findFirst({
        where: { id, trainerId },
        select: { id: true, traineeId: true, phaseTypeId: true, startDate: true, endDate: true },
    })

/**
 * PATCH /api/macro-periods/[id]
 * Body: any of { phaseTypeId, startDate, endDate, note }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = updateMacroPeriodSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const input = validation.data

        const existing = await findOwnedPeriod(id, trainerId)
        if (!existing) return notFound()

        // The trainee may have been reassigned since the period was created
        await requireTrainerOwnership(existing.traineeId)

        const startDay = input.startDate ?? dbDateToIsoDay(existing.startDate)
        const endDay = input.endDate ?? dbDateToIsoDay(existing.endDate)
        const datesChanged = input.startDate !== undefined || input.endDate !== undefined

        if (datesChanged && !isValidPeriodRange(startDay, endDay)) {
            return apiError('VALIDATION_ERROR', 'Invalid period range', 400, undefined, 'validation.macroPeriodInvalidRange')
        }

        // An unchanged phase is not re-checked: a period on an archived phase can still be moved
        if (input.phaseTypeId !== undefined && input.phaseTypeId !== existing.phaseTypeId) {
            const phaseType = await prisma.macroPhaseType.findFirst({
                where: { id: input.phaseTypeId, trainerId },
                select: { id: true, isActive: true },
            })
            if (!phaseType) {
                return apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')
            }
            if (!phaseType.isActive) {
                return apiError('CONFLICT', 'Macro phase type is archived', 409, undefined, 'macroPhase.archived')
            }
        }

        const data: Prisma.MacroPeriodUncheckedUpdateInput = {}
        if (input.phaseTypeId !== undefined) data.phaseTypeId = input.phaseTypeId
        if (input.startDate !== undefined) data.startDate = isoDayToDbDate(input.startDate)
        if (input.endDate !== undefined) data.endDate = isoDayToDbDate(input.endDate)
        if (input.note !== undefined) data.note = input.note

        const period = await prisma.$transaction(async (tx) => {
            if (datesChanged) {
                const clash = await tx.macroPeriod.findFirst({
                    where: {
                        traineeId: existing.traineeId,
                        trainerId,
                        id: { not: id },
                        startDate: { lte: isoDayToDbDate(endDay) },
                        endDate: { gte: isoDayToDbDate(startDay) },
                    },
                    select: { id: true },
                })
                if (clash) return null
            }

            return tx.macroPeriod.update({ where: { id }, data, select: PERIOD_SELECT })
        })

        if (!period) {
            return apiError('CONFLICT', 'The period overlaps another period', 409, undefined, 'macroPeriod.overlap')
        }

        logger.info({ trainerId, periodId: id }, 'Macro period updated')

        return apiSuccess({ period: toPeriodDto(period) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating macro period',
            message: 'Failed to update macro period',
            key: 'internal.default',
            context: { periodId: id },
        })
    }
}

/**
 * DELETE /api/macro-periods/[id]
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const existing = await findOwnedPeriod(id, trainerId)
        if (!existing) return notFound()

        await requireTrainerOwnership(existing.traineeId)

        await prisma.macroPeriod.delete({ where: { id } })

        logger.info({ trainerId, periodId: id }, 'Macro period deleted')

        return apiSuccess({ id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting macro period',
            message: 'Failed to delete macro period',
            key: 'internal.default',
            context: { periodId: id },
        })
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/integration/macro-periods.test.ts tests/integration/macro-phase-types.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks, changelog, commit**

Run: `npm run type-check && npm run lint` — expected: no errors.

```bash
git add "src/app/api/trainer/trainees/[id]/macro-periods" src/app/api/macro-periods tests/integration/macro-periods.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(planning): macro periods API with whole-week and no-overlap rules"
```

---

### Task 6: Profile section — manage phases and colours

**Files:**
- Create: `src/components/MacroPhaseTypesSection.tsx`
- Modify: `src/components/index.ts` (barrel export)
- Modify: `src/app/profile/page.tsx` (new block after the movement-pattern colours block)
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`, `public/locales/it/profile.json`, `public/locales/en/profile.json`
- Test: `tests/unit/macro-phase-types-section.test.tsx`

**Interfaces:**
- Consumes: the four phase endpoints (Task 4); `PHASE_COLOR_PALETTE`, `nextUnusedColor`, `MacroPhaseTypeDto` (Task 2).
- Produces: `MacroPhaseTypesSection` (default export, no props). i18n keys under `trainer:macroPhases.*` and `profile:profile.macroPhases`.

- [ ] **Step 1: Add the copy**

In `public/locales/it/trainer.json`, add a top-level object right before `"measurements": {` (Edit tool):

```json
    "macroPhases": {
        "description": "Definisci le fasi che usi per pianificare i macro periodi dei tuoi atleti. Nome, significato e colore compaiono nella legenda della pianificazione.",
        "add": "Aggiungi fase",
        "create": "Crea fase",
        "edit": "Modifica",
        "delete": "Elimina",
        "archive": "Archivia",
        "reactivate": "Riattiva",
        "archived": "Archiviata",
        "moveUp": "Sposta su",
        "moveDown": "Sposta giù",
        "name": "Nome",
        "descriptionLabel": "Significato",
        "descriptionPlaceholder": "Cosa indica questa fase (opzionale)",
        "color": "Colore",
        "customColor": "Colore personalizzato",
        "empty": "Nessuna fase definita",
        "loadError": "Impossibile caricare le fasi",
        "saveError": "Impossibile salvare la fase",
        "deleteConfirmTitle": "Eliminare la fase?",
        "deleteConfirmMessage": "La fase non è usata in nessun periodo e verrà eliminata definitivamente.",
        "deleteConfirm": "Elimina fase"
    },
```

Same place in `public/locales/en/trainer.json`:

```json
    "macroPhases": {
        "description": "Define the phases you use to plan your athletes' macro periods. Name, meaning and colour appear in the planning legend.",
        "add": "Add phase",
        "create": "Create phase",
        "edit": "Edit",
        "delete": "Delete",
        "archive": "Archive",
        "reactivate": "Reactivate",
        "archived": "Archived",
        "moveUp": "Move up",
        "moveDown": "Move down",
        "name": "Name",
        "descriptionLabel": "Meaning",
        "descriptionPlaceholder": "What this phase stands for (optional)",
        "color": "Colour",
        "customColor": "Custom colour",
        "empty": "No phases defined",
        "loadError": "Could not load the phases",
        "saveError": "Could not save the phase",
        "deleteConfirmTitle": "Delete this phase?",
        "deleteConfirmMessage": "No period uses this phase. It will be deleted permanently.",
        "deleteConfirm": "Delete phase"
    },
```

In `public/locales/it/profile.json`, after the `"movementPatternColors"` line add `"macroPhases": "Fasi di pianificazione",`. In `public/locales/en/profile.json`, same place: `"macroPhases": "Planning phases",`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/macro-phase-types-section.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const showToast = vi.hoisted(() => vi.fn())

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
}))

import MacroPhaseTypesSection from '@/components/MacroPhaseTypesSection'
import { PHASE_COLOR_PALETTE, type MacroPhaseTypeDto } from '@/lib/macro-periods'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'p1',
    name: 'Forza',
    description: null,
    color: PHASE_COLOR_PALETTE[0],
    sortOrder: 0,
    isActive: true,
    usageCount: 0,
    ...overrides,
})

const PHASES: MacroPhaseTypeDto[] = [
    phase({ id: 'p1', name: 'Forza', description: 'Carichi alti', sortOrder: 0, usageCount: 2 }),
    phase({ id: 'p2', name: 'Scarico', color: PHASE_COLOR_PALETTE[1], sortOrder: 3 }),
    phase({ id: 'p3', name: 'Vecchia', color: '#000000', sortOrder: 5, isActive: false, usageCount: 1 }),
]

type Call = { url: string; method: string; body: unknown }

/** GET returns the list; every write is recorded and answered by `onWrite` (default: success). */
function mockApi(onWrite: (call: Call) => { status: number; json: unknown } = () => ({ status: 200, json: { data: {} } })) {
    const calls: Call[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET') {
            return { ok: true, status: 200, json: async () => ({ data: { items: PHASES } }) } as Response
        }
        const call = { url: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : undefined }
        calls.push(call)
        const { status, json } = onWrite(call)
        return { ok: status < 400, status, json: async () => json } as Response
    })
    return calls
}

const row = async (name: string) => screen.findByRole('listitem', { name })

describe('MacroPhaseTypesSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('lists the phases with meaning and archived state', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        expect(within(await row('Forza')).getByText('Carichi alti')).toBeInTheDocument()
        expect(within(await row('Vecchia')).getByText('macroPhases.archived')).toBeInTheDocument()
        expect(within(await row('Scarico')).queryByText('macroPhases.archived')).not.toBeInTheDocument()
    })

    it('offers delete only for an unused phase and archive only for a used one', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        const used = within(await row('Forza'))
        expect(used.getByRole('button', { name: 'macroPhases.archive' })).toBeInTheDocument()
        expect(used.queryByRole('button', { name: 'macroPhases.delete' })).not.toBeInTheDocument()

        const unused = within(await row('Scarico'))
        expect(unused.getByRole('button', { name: 'macroPhases.delete' })).toBeInTheDocument()
        expect(unused.queryByRole('button', { name: 'macroPhases.archive' })).not.toBeInTheDocument()

        expect(within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.reactivate' })).toBeInTheDocument()
    })

    it('creates a phase with the first palette colour not in use', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: '  Ipertrofia ' } })
        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.create' }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-phase-types',
            method: 'POST',
            body: { name: 'Ipertrofia', description: null, color: PHASE_COLOR_PALETTE[2] },
        })
    })

    it('keeps the create button disabled while the name is empty', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))

        expect(screen.getByRole('button', { name: 'macroPhases.create' })).toBeDisabled()
    })

    it('saves an edited name, meaning and colour', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Scarico')).getByRole('button', { name: 'macroPhases.edit' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: 'Deload' } })
        fireEvent.change(screen.getByLabelText('macroPhases.descriptionLabel'), { target: { value: 'Recupero' } })
        fireEvent.click(screen.getByRole('button', { name: PHASE_COLOR_PALETTE[4] }))
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-phase-types/p2',
            method: 'PATCH',
            body: { name: 'Deload', description: 'Recupero', color: PHASE_COLOR_PALETTE[4] },
        })
    })

    it('archives a used phase and reactivates an archived one', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Forza')).getByRole('button', { name: 'macroPhases.archive' }))
        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({ url: '/api/macro-phase-types/p1', method: 'PATCH', body: { isActive: false } })

        // buttons are disabled while the first write and its reload are in flight
        const reactivate = within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.reactivate' })
        await waitFor(() => expect(reactivate).toBeEnabled())
        fireEvent.click(reactivate)
        await waitFor(() => expect(calls).toHaveLength(2))
        expect(calls[1]).toEqual({ url: '/api/macro-phase-types/p3', method: 'PATCH', body: { isActive: true } })
    })

    it('reorders by swapping the sort order of two neighbours', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Forza')).getByRole('button', { name: 'macroPhases.moveDown' }))

        await waitFor(() => expect(calls).toHaveLength(2))
        expect(calls).toEqual([
            { url: '/api/macro-phase-types/p1', method: 'PATCH', body: { sortOrder: 3 } },
            { url: '/api/macro-phase-types/p2', method: 'PATCH', body: { sortOrder: 0 } },
        ])
    })

    it('disables moving the first phase up and the last one down', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        expect(within(await row('Forza')).getByRole('button', { name: 'macroPhases.moveUp' })).toBeDisabled()
        expect(within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.moveDown' })).toBeDisabled()
    })

    it('deletes an unused phase after confirmation', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Scarico')).getByRole('button', { name: 'macroPhases.delete' }))
        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.deleteConfirm' }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({ url: '/api/macro-phase-types/p2', method: 'DELETE', body: undefined })
    })

    it('shows the translated API error and keeps the form open', async () => {
        mockApi(() => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPhase.nameExists' } } }))
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: 'Forza' } })
        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.create' }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('errors:macroPhase.nameExists', 'error'))
        expect(screen.getByRole('button', { name: 'macroPhases.create' })).toBeInTheDocument()
    })

    it('shows an error with a retry when the list cannot be loaded', async () => {
        global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: {} }) }) as Response)
        render(<MacroPhaseTypesSection />)

        expect(await screen.findByText('macroPhases.loadError')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'common:common.retry' })).toBeInTheDocument()
    })
})
```

`getByLabelText(/macroPhases\.name/)` is a regex because `FormLabel required` appends an asterisk to the label text.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/macro-phase-types-section.test.tsx`
Expected: FAIL — cannot resolve `@/components/MacroPhaseTypesSection`.

- [ ] **Step 4: Write the component**

`src/components/MacroPhaseTypesSection.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import { FormLabel } from '@/components/FormLabel'
import { Input } from '@/components/Input'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { PHASE_COLOR_PALETTE, nextUnusedColor, type MacroPhaseTypeDto } from '@/lib/macro-periods'

interface PhaseDraft {
    name: string
    description: string
    color: string
}

interface PhaseFormProps {
    idPrefix: string
    draft: PhaseDraft
    submitLabel: string
    isSaving: boolean
    onChange: (draft: PhaseDraft) => void
    onSubmit: () => void
    onCancel: () => void
}

function PhaseForm({ idPrefix, draft, submitLabel, isSaving, onChange, onSubmit, onCancel }: PhaseFormProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <FormLabel htmlFor={`${idPrefix}-name`} required>
                        {t('macroPhases.name')}
                    </FormLabel>
                    <Input
                        id={`${idPrefix}-name`}
                        value={draft.name}
                        maxLength={40}
                        onChange={(event) => onChange({ ...draft, name: event.target.value })}
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <FormLabel htmlFor={`${idPrefix}-description`}>{t('macroPhases.descriptionLabel')}</FormLabel>
                    <Input
                        id={`${idPrefix}-description`}
                        value={draft.description}
                        maxLength={200}
                        placeholder={t('macroPhases.descriptionPlaceholder')}
                        onChange={(event) => onChange({ ...draft, description: event.target.value })}
                        disabled={isSaving}
                    />
                </div>
            </div>

            <div>
                <p className="mb-1 text-sm font-medium text-gray-700">{t('macroPhases.color')}</p>
                <div className="flex flex-wrap items-center gap-2">
                    {PHASE_COLOR_PALETTE.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={color}
                            aria-pressed={draft.color.toLowerCase() === color}
                            onClick={() => onChange({ ...draft, color })}
                            className={`h-7 w-7 rounded border-2 transition-colors ${
                                draft.color.toLowerCase() === color ? 'border-gray-900' : 'border-gray-300 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <input
                        type="color"
                        aria-label={t('macroPhases.customColor')}
                        value={draft.color}
                        onChange={(event) => onChange({ ...draft, color: event.target.value })}
                        disabled={isSaving}
                        className="h-8 w-10 cursor-pointer rounded border-2 border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    type="button"
                    size="sm"
                    onClick={onSubmit}
                    disabled={draft.name.trim() === ''}
                    isLoading={isSaving}
                    loadingText={t('common:common.saving')}
                >
                    {submitLabel}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
                    {t('common:common.cancel')}
                </Button>
            </div>
        </div>
    )
}

const toBody = (draft: PhaseDraft) => ({
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    color: draft.color,
})

/**
 * Trainer profile: the phases used to plan macro periods. Names, meanings and
 * colours are the trainer's own — nothing here is hardcoded.
 */
export default function MacroPhaseTypesSection() {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()

    const [phases, setPhases] = useState<MacroPhaseTypeDto[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [newDraft, setNewDraft] = useState<PhaseDraft | null>(null)
    const [editing, setEditing] = useState<{ id: string; draft: PhaseDraft } | null>(null)
    const [pendingDelete, setPendingDelete] = useState<MacroPhaseTypeDto | null>(null)

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/macro-phase-types')
            const json = await res.json()
            if (!res.ok) throw new Error('load failed')
            setPhases(json.data.items)
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const send = async (url: string, method: string, body?: unknown) => {
        const res = await fetch(url, {
            method,
            ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(getApiErrorMessage(json, t('macroPhases.saveError'), t))
    }

    /** Runs a write, reloads the list on success, toasts the translated error otherwise. */
    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key)
        try {
            await action()
            await load()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('macroPhases.saveError'), 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleCreate = () => {
        if (!newDraft) return
        void run('create', async () => {
            await send('/api/macro-phase-types', 'POST', toBody(newDraft))
            setNewDraft(null)
        })
    }

    const handleSaveEdit = () => {
        if (!editing) return
        void run(`save:${editing.id}`, async () => {
            await send(`/api/macro-phase-types/${editing.id}`, 'PATCH', toBody(editing.draft))
            setEditing(null)
        })
    }

    const handleToggleActive = (phase: MacroPhaseTypeDto) =>
        void run(`toggle:${phase.id}`, () =>
            send(`/api/macro-phase-types/${phase.id}`, 'PATCH', { isActive: !phase.isActive })
        )

    const handleMove = (index: number, direction: -1 | 1) => {
        const moved = phases[index]
        const neighbour = phases[index + direction]
        if (!neighbour) return
        void run(`move:${moved.id}`, async () => {
            await send(`/api/macro-phase-types/${moved.id}`, 'PATCH', { sortOrder: neighbour.sortOrder })
            await send(`/api/macro-phase-types/${neighbour.id}`, 'PATCH', { sortOrder: moved.sortOrder })
        })
    }

    const handleDelete = () => {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        void run(`delete:${target.id}`, () => send(`/api/macro-phase-types/${target.id}`, 'DELETE'))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary"></div>
            </div>
        )
    }

    if (loadFailed) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-state-error">{t('macroPhases.loadError')}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    {t('common:common.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div>
            <p className="mb-4 text-sm text-gray-600">{t('macroPhases.description')}</p>

            {phases.length === 0 && <p className="mb-4 text-sm text-gray-500">{t('macroPhases.empty')}</p>}

            <ul className="mb-4 space-y-3">
                {phases.map((phase, index) => (
                    <li key={phase.id} aria-label={phase.name} className="rounded-lg bg-gray-50 p-3">
                        {editing?.id === phase.id ? (
                            <PhaseForm
                                idPrefix={`phase-${phase.id}`}
                                draft={editing.draft}
                                submitLabel={t('common:common.save')}
                                isSaving={busy === `save:${phase.id}`}
                                onChange={(draft) => setEditing({ id: phase.id, draft })}
                                onSubmit={handleSaveEdit}
                                onCancel={() => setEditing(null)}
                            />
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="h-8 w-8 flex-shrink-0 rounded-md border-2 border-gray-300"
                                        style={{ backgroundColor: phase.color }}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                            {phase.name}
                                            {!phase.isActive && (
                                                <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-600">
                                                    {t('macroPhases.archived')}
                                                </span>
                                            )}
                                        </p>
                                        {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        aria-label={t('macroPhases.moveUp')}
                                        disabled={index === 0 || busy !== null}
                                        onClick={() => handleMove(index, -1)}
                                    >
                                        <ChevronUp size={16} />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        aria-label={t('macroPhases.moveDown')}
                                        disabled={index === phases.length - 1 || busy !== null}
                                        onClick={() => handleMove(index, 1)}
                                    >
                                        <ChevronDown size={16} />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={busy !== null}
                                        onClick={() =>
                                            setEditing({
                                                id: phase.id,
                                                draft: { name: phase.name, description: phase.description ?? '', color: phase.color },
                                            })
                                        }
                                    >
                                        {t('macroPhases.edit')}
                                    </Button>
                                    {(phase.usageCount > 0 || !phase.isActive) && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            isLoading={busy === `toggle:${phase.id}`}
                                            loadingText={t('common:common.saving')}
                                            disabled={busy !== null}
                                            onClick={() => handleToggleActive(phase)}
                                        >
                                            {phase.isActive ? t('macroPhases.archive') : t('macroPhases.reactivate')}
                                        </Button>
                                    )}
                                    {phase.usageCount === 0 && (
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            isLoading={busy === `delete:${phase.id}`}
                                            loadingText={t('common:common.saving')}
                                            disabled={busy !== null}
                                            onClick={() => setPendingDelete(phase)}
                                        >
                                            {t('macroPhases.delete')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {newDraft ? (
                <PhaseForm
                    idPrefix="phase-new"
                    draft={newDraft}
                    submitLabel={t('macroPhases.create')}
                    isSaving={busy === 'create'}
                    onChange={setNewDraft}
                    onSubmit={handleCreate}
                    onCancel={() => setNewDraft(null)}
                />
            ) : (
                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={busy !== null}
                    onClick={() =>
                        setNewDraft({ name: '', description: '', color: nextUnusedColor(phases.map((phase) => phase.color)) })
                    }
                >
                    {t('macroPhases.add')}
                </Button>
            )}

            <ConfirmationModal
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                title={t('macroPhases.deleteConfirmTitle')}
                message={t('macroPhases.deleteConfirmMessage')}
                confirmText={t('macroPhases.deleteConfirm')}
                variant="danger"
            />
        </div>
    )
}
```

In the "archive then reactivate" test the list is not reloaded with new data (the mock always returns `PHASES`), which is why both rows keep their original buttons.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/macro-phase-types-section.test.tsx`
Expected: PASS. If `getByRole('button', { name: 'common:common.save' })` matches nothing, check what name the `Button` exposes while not loading — do not weaken the assertion to `getByText`.

- [ ] **Step 6: Export and mount**

In `src/components/index.ts`, next to the other default re-exports of form/section components, add:

```ts
export { default as MacroPhaseTypesSection } from './MacroPhaseTypesSection'
```

In `src/app/profile/page.tsx`, add the import next to `MovementPatternColorsSection`:

```tsx
import MacroPhaseTypesSection from '@/components/MacroPhaseTypesSection'
```

and, right after the closing `)}` of the "Movement Pattern Colors - Only for Trainers" block:

```tsx
                        {/* Macro phases - Only for Trainers */}
                        {session.user.role === 'trainer' && (
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    {tp('profile.macroPhases')}
                                </h2>
                                <MacroPhaseTypesSection />
                            </div>
                        )}
```

- [ ] **Step 7: Full checks, changelog, commit**

Run: `npm run type-check && npm run lint && npx vitest run tests/unit/macro-phase-types-section.test.tsx` — expected: no errors, tests pass. Validate the four edited locale files with the `JSON.parse` one-liner from Task 3 Step 5 (change the file name).

```bash
git add src/components/MacroPhaseTypesSection.tsx src/components/index.ts src/app/profile/page.tsx tests/unit/macro-phase-types-section.test.tsx public/locales implementation-docs/CHANGELOG.md
git commit -m "feat(profile): trainer-defined macro phases with colours"
```

---

### Task 7: Period dialog

**Files:**
- Create: `src/components/MacroPeriodFormModal.tsx`
- Modify: `src/components/index.ts`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Test: `tests/unit/macro-period-form-modal.test.tsx`

**Interfaces:**
- Consumes: `weekStartOf`, `weekEndOf`, `addDays`, `isIsoDay`, `isValidPeriodRange`, `localMsToDay`, `IsoDay`, `MacroPhaseTypeDto` (Task 2).
- Produces:
  - `MacroPeriodFormValues { phaseTypeId: string; startDate: IsoDay; endDate: IsoDay; note: string | null }`
  - `MacroPeriodFormModal` (default export) with props `{ mode: 'create' | 'edit'; initial: Partial<MacroPeriodFormValues>; phaseTypes: MacroPhaseTypeDto[]; isSaving: boolean; error: string | null; onClose: () => void; onSubmit: (values: MacroPeriodFormValues) => void; onDelete?: () => void }`
  - i18n keys under `trainer:planning.*` (the whole block is added here; Task 9 uses the rest of it).

- [ ] **Step 1: Add the copy**

In `public/locales/it/trainer.json`, add a top-level object right before `"macroPhases": {`:

```json
    "planning": {
        "tab": "Pianificazione",
        "title": "Macro periodi",
        "subtitle": "Pianificazione a lungo termine, visibile solo a te",
        "newPeriod": "Nuovo periodo",
        "createTitle": "Nuovo periodo",
        "editTitle": "Modifica periodo",
        "phase": "Fase",
        "startWeek": "Prima settimana",
        "endWeek": "Ultima settimana",
        "weekSnapHint": "I periodi coprono settimane intere: la data viene portata al lunedì (inizio) o alla domenica (fine).",
        "invalidRange": "La fine deve essere dopo l'inizio",
        "note": "Nota",
        "notePlaceholder": "Obiettivo o dettagli del periodo (opzionale)",
        "noActivePhases": "Non hai fasi attive da assegnare.",
        "managePhases": "Gestisci fasi",
        "deletePeriod": "Elimina periodo",
        "deleteConfirmTitle": "Eliminare il periodo?",
        "deleteConfirmMessage": "Il periodo verrà rimosso dalla pianificazione.",
        "viewWeeks": "Settimane",
        "viewMonth": "Mese",
        "previous": "Indietro",
        "next": "Avanti",
        "today": "Oggi",
        "rowPhases": "Fasi",
        "rowPrograms": "Schede",
        "draft": "Nuovo periodo",
        "legend": "Legenda",
        "archivedPhase": "archiviata",
        "empty": "Nessun periodo pianificato. Trascina sulle settimane della riga Fasi oppure usa \"Nuovo periodo\".",
        "dragHint": "Trascina sulle settimane libere per creare un periodo; trascina una barra o i suoi bordi per spostarla o ridimensionarla.",
        "overlapToast": "Lo spostamento si sovrappone a un altro periodo",
        "loadError": "Impossibile caricare la pianificazione",
        "saveError": "Impossibile salvare il periodo",
        "deleteError": "Impossibile eliminare il periodo"
    },
```

Same place in `public/locales/en/trainer.json`:

```json
    "planning": {
        "tab": "Planning",
        "title": "Macro periods",
        "subtitle": "Long-term planning, visible only to you",
        "newPeriod": "New period",
        "createTitle": "New period",
        "editTitle": "Edit period",
        "phase": "Phase",
        "startWeek": "First week",
        "endWeek": "Last week",
        "weekSnapHint": "Periods cover whole weeks: the date is moved to the Monday (start) or the Sunday (end).",
        "invalidRange": "The end must be after the start",
        "note": "Note",
        "notePlaceholder": "Goal or details of the period (optional)",
        "noActivePhases": "You have no active phases to assign.",
        "managePhases": "Manage phases",
        "deletePeriod": "Delete period",
        "deleteConfirmTitle": "Delete this period?",
        "deleteConfirmMessage": "The period will be removed from the plan.",
        "viewWeeks": "Weeks",
        "viewMonth": "Month",
        "previous": "Back",
        "next": "Forward",
        "today": "Today",
        "rowPhases": "Phases",
        "rowPrograms": "Programs",
        "draft": "New period",
        "legend": "Legend",
        "archivedPhase": "archived",
        "empty": "No periods planned yet. Drag across the weeks of the Phases row, or use \"New period\".",
        "dragHint": "Drag across free weeks to create a period; drag a bar or its edges to move or resize it.",
        "overlapToast": "That move overlaps another period",
        "loadError": "Could not load the plan",
        "saveError": "Could not save the period",
        "deleteError": "Could not delete the period"
    },
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/macro-period-form-modal.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import MacroPeriodFormModal, { type MacroPeriodFormModalProps } from '@/components/MacroPeriodFormModal'
import type { MacroPhaseTypeDto } from '@/lib/macro-periods'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'p1',
    name: 'Forza',
    description: null,
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    usageCount: 0,
    ...overrides,
})

const PHASES = [
    phase({ id: 'p1', name: 'Forza' }),
    phase({ id: 'p2', name: 'Scarico', sortOrder: 1 }),
    phase({ id: 'p3', name: 'Vecchia', sortOrder: 2, isActive: false }),
]

const onSubmit = vi.fn()
const onClose = vi.fn()
const onDelete = vi.fn()

const renderModal = (props: Partial<MacroPeriodFormModalProps> = {}) =>
    render(
        <MacroPeriodFormModal
            mode="create"
            initial={{}}
            phaseTypes={PHASES}
            isSaving={false}
            error={null}
            onClose={onClose}
            onSubmit={onSubmit}
            {...props}
        />
    )

const save = () => screen.getByRole('button', { name: 'common:common.save' })

describe('MacroPeriodFormModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-07T10:00:00.000Z')) // a Wednesday
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('defaults to four weeks from the current week and the first active phase', () => {
        renderModal()
        fireEvent.click(save())

        expect(onSubmit).toHaveBeenCalledWith({
            phaseTypeId: 'p1',
            startDate: '2026-10-05',
            endDate: '2026-11-01',
            note: null,
        })
    })

    it('opens prefilled with the drawn range', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        expect(screen.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-11-02')
        expect(screen.getByLabelText(/planning\.endWeek/)).toHaveValue('2026-11-22')
    })

    it('snaps a typed start to its Monday and a typed end to its Sunday', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.startWeek/), { target: { value: '2026-11-11' } })
        fireEvent.change(screen.getByLabelText(/planning\.endWeek/), { target: { value: '2026-11-25' } })

        expect(screen.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-11-09')
        expect(screen.getByLabelText(/planning\.endWeek/)).toHaveValue('2026-11-29')
    })

    it('submits the chosen phase and a trimmed note', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.phase/), { target: { value: 'p2' } })
        fireEvent.change(screen.getByLabelText('planning.note'), { target: { value: '  Blocco 1  ' } })
        fireEvent.click(save())

        expect(onSubmit).toHaveBeenCalledWith({
            phaseTypeId: 'p2',
            startDate: '2026-11-02',
            endDate: '2026-11-22',
            note: 'Blocco 1',
        })
    })

    it('blocks saving when the end is not after the start', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.endWeek/), { target: { value: '2026-10-20' } })

        expect(save()).toBeDisabled()
        expect(screen.getByText('planning.invalidRange')).toBeInTheDocument()
    })

    it('offers only active phases when creating', () => {
        renderModal()

        const options = screen.getAllByRole('option').map((option) => option.textContent)
        expect(options).toEqual(['Forza', 'Scarico'])
    })

    it('keeps the archived phase of the period being edited selectable', () => {
        renderModal({
            mode: 'edit',
            initial: { phaseTypeId: 'p3', startDate: '2026-11-02', endDate: '2026-11-22', note: 'x' },
            onDelete,
        })

        expect(screen.getByLabelText(/planning\.phase/)).toHaveValue('p3')
        expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('has nothing to choose when every phase is archived: save disabled, link to the profile', () => {
        renderModal({ phaseTypes: [phase({ id: 'p3', isActive: false })] })

        expect(save()).toBeDisabled()
        expect(screen.getByText('planning.noActivePhases')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'planning.managePhases' })).toHaveAttribute('href', '/profile')
        fireEvent.click(save())
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows delete only when editing', () => {
        renderModal()
        expect(screen.queryByRole('button', { name: 'planning.deletePeriod' })).not.toBeInTheDocument()
    })

    it('calls onDelete from the edit dialog', () => {
        renderModal({
            mode: 'edit',
            initial: { phaseTypeId: 'p1', startDate: '2026-11-02', endDate: '2026-11-22', note: null },
            onDelete,
        })

        fireEvent.click(screen.getByRole('button', { name: 'planning.deletePeriod' }))

        expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('shows the error passed by the parent', () => {
        renderModal({ error: 'errors:macroPeriod.overlap' })

        expect(screen.getByRole('alert')).toHaveTextContent('errors:macroPeriod.overlap')
    })

    it('closes on cancel', () => {
        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/macro-period-form-modal.test.tsx`
Expected: FAIL — cannot resolve `@/components/MacroPeriodFormModal`.

- [ ] **Step 4: Write the component**

`src/components/MacroPeriodFormModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { FormLabel } from '@/components/FormLabel'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import {
    addDays,
    isIsoDay,
    isValidPeriodRange,
    localMsToDay,
    weekEndOf,
    weekStartOf,
    type IsoDay,
    type MacroPhaseTypeDto,
} from '@/lib/macro-periods'

export interface MacroPeriodFormValues {
    phaseTypeId: string
    startDate: IsoDay
    endDate: IsoDay
    note: string | null
}

export interface MacroPeriodFormModalProps {
    mode: 'create' | 'edit'
    initial: Partial<MacroPeriodFormValues>
    phaseTypes: MacroPhaseTypeDto[]
    isSaving: boolean
    error: string | null
    onClose: () => void
    onSubmit: (values: MacroPeriodFormValues) => void
    onDelete?: () => void
}

/**
 * Create or edit a macro period. Everything that can be done by dragging on the
 * timeline can also be done here — this is the keyboard and touch path.
 */
export default function MacroPeriodFormModal({
    mode,
    initial,
    phaseTypes,
    isSaving,
    error,
    onClose,
    onSubmit,
    onDelete,
}: MacroPeriodFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    // Archived phases are not assignable, except the one this period already has
    const selectablePhases = phaseTypes.filter((phase) => phase.isActive || phase.id === initial.phaseTypeId)

    const [phaseTypeId, setPhaseTypeId] = useState(() => initial.phaseTypeId ?? selectablePhases[0]?.id ?? '')
    const [startDate, setStartDate] = useState<IsoDay>(() => initial.startDate ?? weekStartOf(localMsToDay(Date.now())))
    const [endDate, setEndDate] = useState<IsoDay>(
        () => initial.endDate ?? addDays(initial.startDate ?? weekStartOf(localMsToDay(Date.now())), 27)
    )
    const [note, setNote] = useState(initial.note ?? '')

    const rangeIsValid = isValidPeriodRange(startDate, endDate)
    const canSubmit = phaseTypeId !== '' && rangeIsValid && !isSaving

    const handleSubmit = () => {
        if (!canSubmit) return
        onSubmit({ phaseTypeId, startDate, endDate, note: note.trim() === '' ? null : note.trim() })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="macro-period-modal-title"
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="macro-period-modal-title" className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('planning.editTitle') : t('planning.createTitle')}
                </h2>

                {error && (
                    <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <FormLabel htmlFor="macro-period-phase" required>
                        {t('planning.phase')}
                    </FormLabel>
                    {selectablePhases.length === 0 ? (
                        <p className="text-sm text-gray-600">
                            {t('planning.noActivePhases')}{' '}
                            <Link href="/profile" className="font-semibold text-brand-primary hover:underline">
                                {t('planning.managePhases')}
                            </Link>
                        </p>
                    ) : (
                        <select
                            id="macro-period-phase"
                            value={phaseTypeId}
                            onChange={(event) => setPhaseTypeId(event.target.value)}
                            disabled={isSaving}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
                        >
                            {selectablePhases.map((phase) => (
                                <option key={phase.id} value={phase.id}>
                                    {phase.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <FormLabel htmlFor="macro-period-start" required>
                            {t('planning.startWeek')}
                        </FormLabel>
                        <Input
                            id="macro-period-start"
                            type="date"
                            value={startDate}
                            onChange={(event) => {
                                if (isIsoDay(event.target.value)) setStartDate(weekStartOf(event.target.value))
                            }}
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="macro-period-end" required>
                            {t('planning.endWeek')}
                        </FormLabel>
                        <Input
                            id="macro-period-end"
                            type="date"
                            value={endDate}
                            onChange={(event) => {
                                if (isIsoDay(event.target.value)) setEndDate(weekEndOf(event.target.value))
                            }}
                            state={rangeIsValid ? 'default' : 'error'}
                            helperText={rangeIsValid ? undefined : t('planning.invalidRange')}
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <p className="mb-4 text-xs text-gray-500">{t('planning.weekSnapHint')}</p>

                <div className="mb-6">
                    <FormLabel htmlFor="macro-period-note">{t('planning.note')}</FormLabel>
                    <Textarea
                        id="macro-period-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={t('planning.notePlaceholder')}
                        maxLength={500}
                        rows={3}
                        disabled={isSaving}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {mode === 'edit' && onDelete && (
                            <Button type="button" variant="danger" onClick={onDelete} disabled={isSaving}>
                                {t('planning.deletePeriod')}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                            {t('common:common.cancel')}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            isLoading={isSaving}
                            loadingText={t('common:common.saving')}
                        >
                            {t('common:common.save')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/macro-period-form-modal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Export, checks, changelog, commit**

In `src/components/index.ts` add:

```ts
export { default as MacroPeriodFormModal } from './MacroPeriodFormModal'
export type { MacroPeriodFormModalProps, MacroPeriodFormValues } from './MacroPeriodFormModal'
```

Run: `npm run type-check && npm run lint` — expected: no errors. Validate both `trainer.json` files with the `JSON.parse` one-liner.

```bash
git add src/components/MacroPeriodFormModal.tsx src/components/index.ts tests/unit/macro-period-form-modal.test.tsx public/locales/it/trainer.json public/locales/en/trainer.json implementation-docs/CHANGELOG.md
git commit -m "feat(planning): macro period dialog"
```

---

### Task 8: Timeline component and drag-to-create

Read the Task 1 report first. This task is written against the library behaviour verified there; where the report says "PASS with change", apply that change here.

**Files:**
- Create: `src/components/useDraftPeriodDrag.ts`
- Create: `src/components/MacroPeriodTimeline.tsx`
- Test: `tests/unit/use-draft-period-drag.test.tsx`
- Test: `tests/unit/macro-period-timeline.test.tsx`

`MacroPeriodTimeline` is **not** added to `src/components/index.ts`: the barrel is imported by many pages and would drag the timeline library into their bundles. It is only ever loaded through `next/dynamic` (Task 9).

**Interfaces:**
- Consumes: `clampRangeToFree`, `findOverlap`, `movePeriod`, `resizePeriod`, `programToRange`, `snapToWeekStart`, `addDays`, `dayToLocalMs`, `localMsToDay`, `xToMs`, `readableTextColor`, `VIEW_SPAN_MS`, types (Task 2).
- Produces:
  - `useDraftPeriodDrag(options: DraftPeriodDragOptions): { consumeCanvasClick: () => boolean }` with `DraftPeriodDragOptions { containerRef: RefObject<HTMLElement | null>; getScrollElement: () => HTMLElement | null; getVisibleRange: () => { start: number; end: number }; rowHeight: number; periods: PeriodRange[]; enabled: boolean; onDraftChange: (range: DayRange | null) => void; onCommit: (range: DayRange) => void }`
  - `MacroPeriodTimeline` (default export) with `MacroPeriodTimelineProps { periods: MacroPeriodDto[]; programs: PlanProgramDto[]; view: TimelineView; visibleStart: number; visibleEnd: number; draft: DayRange | null; labels: { phases: string; programs: string; draft: string }; onVisibleRangeChange: (start: number, end: number) => void; onDraftChange: (range: DayRange | null) => void; onDraftCommit: (range: DayRange) => void; onPeriodChange: (id: string, range: DayRange) => void; onPeriodConflict: () => void; onPeriodClick: (id: string) => void; onProgramClick: (id: string) => void }`
  - Contract of the callbacks: `onPeriodChange` is called only with a whole-week range that overlaps nothing and differs from the current one; `onPeriodConflict` when a move or resize would overlap; `onDraftCommit` when a drawn (or tapped) range is ready for the dialog — the parent keeps `draft` set until the dialog closes.

- [ ] **Step 1: Write the failing hook tests**

`tests/unit/use-draft-period-drag.test.tsx`:

```tsx
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { useDraftPeriodDrag } from '@/components/useDraftPeriodDrag'
import { WEEK_MS, dayToLocalMs, type PeriodRange } from '@/lib/macro-periods'

const onDraftChange = vi.fn()
const onCommit = vi.fn()

// Visible range: 12 weeks from Monday 2026-10-05, drawn 1200px wide starting at x=100 → 100px per week.
const VISIBLE_START = dayToLocalMs('2026-10-05')
const RANGE = { start: VISIBLE_START, end: VISIBLE_START + 12 * WEEK_MS }
const ROW_HEIGHT = 48

// Week 4 (2026-11-02 → 2026-11-08) is taken.
const PERIODS: PeriodRange[] = [{ id: 'p2', startDate: '2026-11-02', endDate: '2026-11-08' }]

function Harness({ enabled = true, periods = PERIODS }: { enabled?: boolean; periods?: PeriodRange[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const { consumeCanvasClick } = useDraftPeriodDrag({
        containerRef,
        getScrollElement: () => scrollRef.current,
        getVisibleRange: () => RANGE,
        rowHeight: ROW_HEIGHT,
        periods,
        enabled,
        onDraftChange,
        onCommit,
    })

    return (
        <div ref={containerRef}>
            <div data-testid="header" />
            <div ref={scrollRef} data-testid="scroll">
                <div className="rct-item" data-testid="item" />
            </div>
            <output data-testid="consume">{String(consumeCanvasClick())}</output>
            <button type="button" onClick={() => onCommit({ startDate: String(consumeCanvasClick()), endDate: '' })}>
                probe
            </button>
        </div>
    )
}

/** jsdom has no layout: give the scroll element the geometry the hook reads. */
function mount(props: Parameters<typeof Harness>[0] = {}) {
    render(<Harness {...props} />)
    const scroll = screen.getByTestId('scroll')
    scroll.getBoundingClientRect = () =>
        ({ left: 100, top: 50, width: 1200, height: 96, right: 1300, bottom: 146, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect
    return scroll
}

/** Pointer events as plain MouseEvents: jsdom's PointerEvent support varies, the hook only reads these fields. */
function pointer(type: string, target: EventTarget, init: MouseEventInit & { pointerType?: string } = {}) {
    const { pointerType, ...mouseInit } = init
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...mouseInit })
    if (pointerType) Object.defineProperty(event, 'pointerType', { value: pointerType })
    act(() => {
        target.dispatchEvent(event)
    })
    return event
}

const xOfWeek = (index: number) => 100 + index * 100 + 50 // middle of week `index`
const ROW_0_Y = 50 + 20
const ROW_1_Y = 50 + ROW_HEIGHT + 20

describe('useDraftPeriodDrag', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts a one-week draft on a press over a free week of row 0', () => {
        const scroll = mount()

        const event = pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        expect(onDraftChange).toHaveBeenCalledWith({ startDate: '2026-10-12', endDate: '2026-10-18' })
        // keeps the library from starting a pan
        expect(event.cancelBubble).toBe(true)
    })

    it('grows with the pointer and stops at the next period', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        pointer('pointermove', window, { clientX: xOfWeek(2) })
        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-12', endDate: '2026-10-25' })

        pointer('pointermove', window, { clientX: xOfWeek(8) })
        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-12', endDate: '2026-11-01' })
    })

    it('grows to the left of the anchor too', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(2), clientY: ROW_0_Y })

        pointer('pointermove', window, { clientX: xOfWeek(0) })

        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-05', endDate: '2026-10-25' })
    })

    it('commits the drawn range on release and swallows the click that follows', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })
        pointer('pointermove', window, { clientX: xOfWeek(2) })

        pointer('pointerup', window, { clientX: xOfWeek(2) })

        expect(onCommit).toHaveBeenCalledWith({ startDate: '2026-10-12', endDate: '2026-10-25' })

        // the browser fires `click` right after `pointerup`: the canvas-click handler must ignore it
        onCommit.mockClear()
        act(() => screen.getByRole('button', { name: 'probe' }).click())
        expect(onCommit).toHaveBeenCalledWith({ startDate: 'true', endDate: '' })

        act(() => {
            vi.runAllTimers()
        })
        onCommit.mockClear()
        act(() => screen.getByRole('button', { name: 'probe' }).click())
        expect(onCommit).toHaveBeenCalledWith({ startDate: 'false', endDate: '' })
    })

    it('commits a one-week range for a press without movement', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(6), clientY: ROW_0_Y })

        pointer('pointerup', window, { clientX: xOfWeek(6) })

        expect(onCommit).toHaveBeenCalledWith({ startDate: '2026-11-16', endDate: '2026-11-22' })
    })

    it('discards the draft on Escape and does not commit on release', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        })
        expect(onDraftChange).toHaveBeenLastCalledWith(null)

        pointer('pointermove', window, { clientX: xOfWeek(2) })
        pointer('pointerup', window, { clientX: xOfWeek(2) })

        expect(onCommit).not.toHaveBeenCalled()
        expect(onDraftChange).toHaveBeenLastCalledWith(null)
    })

    it('stops listening after a release', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })
        pointer('pointerup', window, { clientX: xOfWeek(1) })
        onDraftChange.mockClear()

        pointer('pointermove', window, { clientX: xOfWeek(3) })

        expect(onDraftChange).not.toHaveBeenCalled()
    })

    it.each([
        ['a press on an existing bar', () => screen.getByTestId('item'), { clientX: xOfWeek(1), clientY: ROW_0_Y }],
        ['a press on the programs row', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_1_Y }],
        ['a press outside the canvas', () => screen.getByTestId('header'), { clientX: xOfWeek(1), clientY: ROW_0_Y }],
        ['a press on an occupied week', () => screen.getByTestId('scroll'), { clientX: xOfWeek(4), clientY: ROW_0_Y }],
        ['a right-button press', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_0_Y, button: 2 }],
        ['a touch press', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_0_Y, pointerType: 'touch' }],
    ])('ignores %s and lets the event through', (_label, target, init) => {
        mount()

        const event = pointer('pointerdown', target(), init)

        expect(onDraftChange).not.toHaveBeenCalled()
        expect(event.cancelBubble).toBe(false)
    })

    it('does nothing while disabled', () => {
        const scroll = mount({ enabled: false })

        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        expect(onDraftChange).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/use-draft-period-drag.test.tsx`
Expected: FAIL — cannot resolve `@/components/useDraftPeriodDrag`.

- [ ] **Step 3: Write the hook**

`src/components/useDraftPeriodDrag.ts`:

```ts
'use client'

import { useEffect, useRef, type RefObject } from 'react'
import {
    clampRangeToFree,
    localMsToDay,
    xToMs,
    type DayRange,
    type IsoDay,
    type PeriodRange,
} from '@/lib/macro-periods'

export interface DraftPeriodDragOptions {
    /** Element wrapping the timeline: the press is intercepted here, before the library sees it */
    containerRef: RefObject<HTMLElement | null>
    /** The library's scroll element: its box is the visible canvas */
    getScrollElement: () => HTMLElement | null
    getVisibleRange: () => { start: number; end: number }
    /** Height of the first row (the phases row); presses below it are left to the library */
    rowHeight: number
    periods: PeriodRange[]
    enabled: boolean
    onDraftChange: (range: DayRange | null) => void
    onCommit: (range: DayRange) => void
}

interface DragSession {
    anchor: IsoDay
    range: DayRange
    cancelled: boolean
}

/**
 * Draw a new period by dragging across free weeks of the phases row.
 *
 * The timeline library has no such gesture and pans on a canvas drag, so the press
 * is caught in the capture phase and stopped there — on the phases row only, so
 * panning keeps working everywhere else. Touch is left alone: a finger drag scrolls.
 */
export function useDraftPeriodDrag(options: DraftPeriodDragOptions): { consumeCanvasClick: () => boolean } {
    const latest = useRef(options)
    latest.current = options

    // True between a release and the `click` the browser fires right after it
    const swallowClick = useRef(false)

    const { containerRef } = options

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let session: DragSession | null = null

        const dayAt = (clientX: number, scrollElement: HTMLElement): IsoDay => {
            const rect = scrollElement.getBoundingClientRect()
            const { start, end } = latest.current.getVisibleRange()
            return localMsToDay(xToMs(clientX - rect.left, rect.width, start, end))
        }

        const stopListening = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
            window.removeEventListener('keydown', onKeyDown)
        }

        const cancel = () => {
            if (!session || session.cancelled) return
            session.cancelled = true
            latest.current.onDraftChange(null)
        }

        function onMove(event: PointerEvent) {
            const scrollElement = latest.current.getScrollElement()
            if (!session || session.cancelled || !scrollElement) return

            const next = clampRangeToFree(session.anchor, dayAt(event.clientX, scrollElement), latest.current.periods)
            if (!next) return
            session.range = next
            latest.current.onDraftChange(next)
        }

        function onUp() {
            if (!session) return
            const { range, cancelled } = session
            session = null
            stopListening()

            swallowClick.current = true
            setTimeout(() => {
                swallowClick.current = false
            }, 0)

            if (!cancelled) latest.current.onCommit(range)
        }

        function onCancel() {
            cancel()
            session = null
            stopListening()
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') cancel()
        }

        function onDown(event: PointerEvent) {
            const { enabled, getScrollElement, rowHeight, periods, onDraftChange } = latest.current
            if (!enabled || session || event.pointerType === 'touch' || event.button !== 0) return

            const scrollElement = getScrollElement()
            const target = event.target
            if (!scrollElement || !(target instanceof Element) || !scrollElement.contains(target)) return
            if (target.closest('.rct-item')) return

            const y = event.clientY - scrollElement.getBoundingClientRect().top
            if (y < 0 || y >= rowHeight) return

            const anchor = dayAt(event.clientX, scrollElement)
            const range = clampRangeToFree(anchor, anchor, periods)
            if (!range) return

            event.stopPropagation()
            session = { anchor, range, cancelled: false }
            onDraftChange(range)

            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onCancel)
            window.addEventListener('keydown', onKeyDown)
        }

        container.addEventListener('pointerdown', onDown, true)
        return () => {
            container.removeEventListener('pointerdown', onDown, true)
            stopListening()
        }
    }, [containerRef])

    return { consumeCanvasClick: () => swallowClick.current }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/use-draft-period-drag.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing timeline tests**

The library is replaced by a stub that records its props: the tests call the library callbacks directly, which is exactly what the library does at the end of a drag.

`tests/unit/macro-period-timeline.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

interface StubItem {
    id: string
    group: string
    start_time: number
    end_time: number
    canMove: boolean
    canResize: false | 'both'
}

interface StubTimelineProps {
    items: StubItem[]
    selected: string[]
    minZoom: number
    maxZoom: number
    visibleTimeStart: number
    visibleTimeEnd: number
    moveResizeValidator: (action: 'move' | 'resize', item: StubItem, time: number) => number
    onItemMove: (itemId: string, dragTime: number, newGroupOrder: number) => void
    onItemResize: (itemId: string, time: number, edge: 'left' | 'right') => void
    onItemClick: (itemId: string) => void
    onItemSelect: (itemId: string) => void
    onCanvasClick: (groupId: string, time: number) => void
    onTimeChange: (start: number, end: number) => void
}

const captured = vi.hoisted(() => ({ props: null as StubTimelineProps | null }))

vi.mock('react-calendar-timeline', () => {
    const Empty = () => null
    return {
        default: (props: StubTimelineProps) => {
            captured.props = props
            return <div data-testid="timeline" />
        },
        TimelineHeaders: Empty,
        SidebarHeader: Empty,
        DateHeader: Empty,
        CustomHeader: Empty,
        TimelineMarkers: Empty,
        TodayMarker: Empty,
    }
})

vi.mock('react-calendar-timeline/style.css', () => ({}))

import MacroPeriodTimeline, { type MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'
import { VIEW_SPAN_MS, dayToLocalMs, type MacroPeriodDto, type PlanProgramDto } from '@/lib/macro-periods'

const ms = dayToLocalMs
const HOUR = 3_600_000

const period = (id: string, startDate: string, endDate: string): MacroPeriodDto => ({
    id,
    startDate,
    endDate,
    note: null,
    phaseType: { id: 'ph', name: `Fase ${id}`, color: '#1e3a8a', isActive: true },
})

const PERIODS = [period('a', '2026-10-05', '2026-10-18'), period('b', '2026-11-02', '2026-11-08')]
const PROGRAMS: PlanProgramDto[] = [{ id: 'g1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 }]

const handlers = {
    onVisibleRangeChange: vi.fn(),
    onDraftChange: vi.fn(),
    onDraftCommit: vi.fn(),
    onPeriodChange: vi.fn(),
    onPeriodConflict: vi.fn(),
    onPeriodClick: vi.fn(),
    onProgramClick: vi.fn(),
}

const renderTimeline = (props: Partial<MacroPeriodTimelineProps> = {}) =>
    render(
        <MacroPeriodTimeline
            periods={PERIODS}
            programs={PROGRAMS}
            view="weeks"
            visibleStart={ms('2026-09-28')}
            visibleEnd={ms('2026-09-28') + VIEW_SPAN_MS.weeks}
            draft={null}
            labels={{ phases: 'Fasi', programs: 'Schede', draft: 'Nuovo' }}
            {...handlers}
            {...props}
        />
    )

function timeline(): StubTimelineProps {
    if (!captured.props) throw new Error('timeline not rendered')
    return captured.props
}

describe('MacroPeriodTimeline', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        captured.props = null
    })

    it('maps periods, programs and the draft to library items', () => {
        renderTimeline({ draft: { startDate: '2026-10-19', endDate: '2026-10-25' } })

        expect(timeline().items).toEqual([
            expect.objectContaining({
                id: 'period:a',
                group: 'phases',
                start_time: ms('2026-10-05'),
                end_time: ms('2026-10-19'), // exclusive: the Monday after the last Sunday
                canMove: true,
                canResize: 'both',
            }),
            expect.objectContaining({ id: 'period:b', start_time: ms('2026-11-02'), end_time: ms('2026-11-09') }),
            expect.objectContaining({
                id: 'program:g1',
                group: 'programs',
                start_time: ms('2026-10-07'),
                end_time: ms('2026-11-04'),
                canMove: false,
                canResize: false,
            }),
            expect.objectContaining({
                id: 'draft',
                group: 'phases',
                start_time: ms('2026-10-19'),
                end_time: ms('2026-10-26'),
                canMove: false,
                canResize: false,
            }),
        ])
    })

    it('keeps every period selected so it can be dragged without a first click', () => {
        renderTimeline()

        expect(timeline().selected).toEqual(['period:a', 'period:b'])
    })

    it('locks the zoom to the span of the current view', () => {
        renderTimeline()
        expect(timeline().minZoom).toBe(VIEW_SPAN_MS.weeks)
        expect(timeline().maxZoom).toBe(VIEW_SPAN_MS.weeks)

        renderTimeline({ view: 'month' })
        expect(timeline().minZoom).toBe(VIEW_SPAN_MS.month)
        expect(timeline().maxZoom).toBe(VIEW_SPAN_MS.month)
    })

    it('snaps a drag in the middle of a week to the nearest Monday', () => {
        renderTimeline()
        const { moveResizeValidator, items } = timeline()

        // Wednesday 15:00 → back to Monday; Friday 09:00 → forward to next Monday
        expect(moveResizeValidator('move', items[0], ms('2026-10-21') + 15 * HOUR)).toBe(ms('2026-10-19'))
        expect(moveResizeValidator('resize', items[0], ms('2026-10-23') + 9 * HOUR)).toBe(ms('2026-10-26'))
    })

    it('reports a move onto free weeks, keeping the length', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-19'), 0)

        expect(handlers.onPeriodChange).toHaveBeenCalledWith('a', { startDate: '2026-10-19', endDate: '2026-11-01' })
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('reports a conflict instead of a change when a move overlaps another period', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-26'), 0)

        expect(handlers.onPeriodConflict).toHaveBeenCalledTimes(1)
        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
    })

    it('ignores a move that lands where the period already is', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-05'), 0)

        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('reports a resize of either edge', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-10-26'), 'right')
        expect(handlers.onPeriodChange).toHaveBeenLastCalledWith('a', { startDate: '2026-10-05', endDate: '2026-10-25' })

        timeline().onItemResize('period:a', ms('2026-09-28'), 'left')
        expect(handlers.onPeriodChange).toHaveBeenLastCalledWith('a', { startDate: '2026-09-28', endDate: '2026-10-18' })
    })

    it('keeps one week when an edge is dragged past the other', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-12-07'), 'left')

        expect(handlers.onPeriodChange).toHaveBeenCalledWith('a', { startDate: '2026-10-12', endDate: '2026-10-18' })
    })

    it('reports a conflict when a resize runs into the next period', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-11-09'), 'right')

        expect(handlers.onPeriodConflict).toHaveBeenCalledTimes(1)
        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
    })

    it('ignores move and resize events for items that are not periods', () => {
        renderTimeline()

        timeline().onItemMove('program:g1', ms('2026-11-02'), 1)
        timeline().onItemResize('draft', ms('2026-11-02'), 'right')
        timeline().onItemMove('period:missing', ms('2026-11-02'), 0)

        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('routes a tap on a period to onPeriodClick and on a program to onProgramClick', () => {
        renderTimeline()

        timeline().onItemClick('period:b')
        expect(handlers.onPeriodClick).toHaveBeenCalledWith('b')

        // a program bar is never selected, so the library reports its first tap as a select
        timeline().onItemSelect('program:g1')
        expect(handlers.onProgramClick).toHaveBeenCalledWith('g1')

        timeline().onItemClick('draft')
        expect(handlers.onPeriodClick).toHaveBeenCalledTimes(1)
    })

    it('turns a tap on a free week of the phases row into a one-week draft', () => {
        renderTimeline()

        timeline().onCanvasClick('phases', ms('2026-10-21') + 10 * HOUR)

        expect(handlers.onDraftChange).toHaveBeenCalledWith({ startDate: '2026-10-19', endDate: '2026-10-25' })
        expect(handlers.onDraftCommit).toHaveBeenCalledWith({ startDate: '2026-10-19', endDate: '2026-10-25' })
    })

    it('ignores a tap on the programs row', () => {
        renderTimeline()

        timeline().onCanvasClick('programs', ms('2026-10-21'))

        expect(handlers.onDraftCommit).not.toHaveBeenCalled()
    })

    it('forwards panning to the parent', () => {
        renderTimeline()

        timeline().onTimeChange(10, 20)

        expect(handlers.onVisibleRangeChange).toHaveBeenCalledWith(10, 20)
    })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/unit/macro-period-timeline.test.tsx`
Expected: FAIL — cannot resolve `@/components/MacroPeriodTimeline`.

- [ ] **Step 7: Write the timeline component**

`src/components/MacroPeriodTimeline.tsx`:

```tsx
'use client'

import { useMemo, useRef } from 'react'
import Timeline, {
    CustomHeader,
    DateHeader,
    SidebarHeader,
    TimelineHeaders,
    TimelineMarkers,
    TodayMarker,
    type Id,
    type ReactCalendarTimelineProps,
    type TimelineItemBase,
} from 'react-calendar-timeline'
import 'react-calendar-timeline/style.css'
import {
    VIEW_SPAN_MS,
    addDays,
    clampRangeToFree,
    dayToLocalMs,
    findOverlap,
    localMsToDay,
    movePeriod,
    programToRange,
    readableTextColor,
    resizePeriod,
    snapToWeekStart,
    type DayRange,
    type MacroPeriodDto,
    type PlanProgramDto,
    type TimelineView,
} from '@/lib/macro-periods'
import { useDraftPeriodDrag } from './useDraftPeriodDrag'

export interface MacroPeriodTimelineProps {
    periods: MacroPeriodDto[]
    programs: PlanProgramDto[]
    view: TimelineView
    visibleStart: number
    visibleEnd: number
    /** Range being drawn, or waiting in the dialog; rendered as a dashed bar */
    draft: DayRange | null
    labels: { phases: string; programs: string; draft: string }
    onVisibleRangeChange: (start: number, end: number) => void
    onDraftChange: (range: DayRange | null) => void
    onDraftCommit: (range: DayRange) => void
    /** Whole-week range, different from the current one, overlapping nothing */
    onPeriodChange: (id: string, range: DayRange) => void
    onPeriodConflict: () => void
    onPeriodClick: (id: string) => void
    onProgramClick: (id: string) => void
}

const DAY_MS = 86_400_000
const LINE_HEIGHT = 48
const SIDEBAR_WIDTH = 96
const PHASES_GROUP = 'phases'
const PROGRAMS_GROUP = 'programs'

interface PlanItem extends TimelineItemBase<number> {
    id: string
    group: string
    kind: 'period' | 'program' | 'draft'
    label: string
    tooltip: string
    background: string
    textColor: string
}

/** The library works with an exclusive end: the midnight after the last day. */
const toSpan = (range: DayRange) => ({
    start_time: dayToLocalMs(range.startDate),
    end_time: dayToLocalMs(addDays(range.endDate, 1)),
})

const renderItem: NonNullable<ReactCalendarTimelineProps<PlanItem>['itemRenderer']> = ({
    item,
    itemContext,
    getItemProps,
    getResizeProps,
}) => {
    const { left: leftResizeProps, right: rightResizeProps } = getResizeProps()
    const { key, ...itemProps } = getItemProps({
        style: {
            background: item.background,
            color: item.textColor,
            border: item.kind === 'draft' ? '2px dashed #6b7280' : '1px solid rgba(17, 24, 39, 0.15)',
            borderRadius: 6,
            cursor: item.kind === 'draft' ? 'default' : 'pointer',
        },
    })

    return (
        <div key={key} {...itemProps} title={item.tooltip} data-kind={item.kind}>
            {itemContext.useResizeHandle ? <div {...leftResizeProps} /> : null}
            <div
                className="truncate px-2 text-xs font-semibold"
                style={{ height: itemContext.dimensions.height, lineHeight: `${itemContext.dimensions.height}px` }}
            >
                {item.label}
            </div>
            {itemContext.useResizeHandle ? <div {...rightResizeProps} /> : null}
        </div>
    )
}

/** `period:<id>` → `['period', '<id>']`. Ids are UUIDs: no colon inside. */
const parseItemId = (itemId: Id): [string, string] => {
    const [kind, id = ''] = String(itemId).split(':')
    return [kind, id]
}

/**
 * Lane timeline of a trainee's plan: an editable phases row and a read-only
 * programs row. Loaded with next/dynamic (ssr: false) — never import it statically.
 */
export default function MacroPeriodTimeline({
    periods,
    programs,
    view,
    visibleStart,
    visibleEnd,
    draft,
    labels,
    onVisibleRangeChange,
    onDraftChange,
    onDraftCommit,
    onPeriodChange,
    onPeriodConflict,
    onPeriodClick,
    onProgramClick,
}: MacroPeriodTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollElementRef = useRef<HTMLDivElement | null>(null)
    const visibleRangeRef = useRef({ start: visibleStart, end: visibleEnd })
    visibleRangeRef.current = { start: visibleStart, end: visibleEnd }

    const { consumeCanvasClick } = useDraftPeriodDrag({
        containerRef,
        getScrollElement: () => scrollElementRef.current,
        getVisibleRange: () => visibleRangeRef.current,
        rowHeight: LINE_HEIGHT,
        periods,
        enabled: true,
        onDraftChange,
        onCommit: onDraftCommit,
    })

    const groups = useMemo(
        () => [
            { id: PHASES_GROUP, title: labels.phases },
            { id: PROGRAMS_GROUP, title: labels.programs },
        ],
        [labels.phases, labels.programs]
    )

    const items = useMemo<PlanItem[]>(() => {
        const periodItems = periods.map<PlanItem>((period) => ({
            id: `period:${period.id}`,
            group: PHASES_GROUP,
            kind: 'period',
            label: period.phaseType.name,
            tooltip: period.note ? `${period.phaseType.name} — ${period.note}` : period.phaseType.name,
            background: period.phaseType.color,
            textColor: readableTextColor(period.phaseType.color),
            canMove: true,
            canResize: 'both',
            ...toSpan(period),
        }))

        const programItems = programs.map<PlanItem>((program) => ({
            id: `program:${program.id}`,
            group: PROGRAMS_GROUP,
            kind: 'program',
            label: program.title,
            tooltip: program.title,
            background: '#e5e7eb',
            textColor: '#374151',
            canMove: false,
            canResize: false,
            ...toSpan(programToRange(program.startDate, program.durationWeeks)),
        }))

        const draftItems: PlanItem[] = draft
            ? [
                  {
                      id: 'draft',
                      group: PHASES_GROUP,
                      kind: 'draft',
                      label: labels.draft,
                      tooltip: labels.draft,
                      background: '#f3f4f6',
                      textColor: '#374151',
                      canMove: false,
                      canResize: false,
                      ...toSpan(draft),
                  },
              ]
            : []

        return [...periodItems, ...programItems, ...draftItems]
    }, [periods, programs, draft, labels.draft])

    // The library arms drag and resize on selected items only: keep every period selected
    const selected = useMemo(() => periods.map((period) => `period:${period.id}`), [periods])

    const findPeriod = (itemId: Id) => {
        const [kind, id] = parseItemId(itemId)
        return kind === 'period' ? periods.find((period) => period.id === id) : undefined
    }

    const applyChange = (period: MacroPeriodDto, next: DayRange) => {
        if (next.startDate === period.startDate && next.endDate === period.endDate) return
        if (findOverlap(next, periods, period.id)) {
            onPeriodConflict()
            return
        }
        onPeriodChange(period.id, next)
    }

    const handleItemMove = (itemId: Id, dragTime: number) => {
        const period = findPeriod(itemId)
        if (period) applyChange(period, movePeriod(period, localMsToDay(dragTime)))
    }

    const handleItemResize = (itemId: Id, time: number, edge: 'left' | 'right') => {
        const period = findPeriod(itemId)
        if (period) applyChange(period, resizePeriod(period, edge, localMsToDay(time)))
    }

    const handleItemActivate = (itemId: Id) => {
        const [kind, id] = parseItemId(itemId)
        if (kind === 'period') onPeriodClick(id)
        if (kind === 'program') onProgramClick(id)
    }

    // Touch path (and fallback): a tap on a free week. A mouse press is handled by the drag hook,
    // which also swallows the click the browser fires after it.
    const handleCanvasClick = (groupId: Id, time: number) => {
        if (groupId !== PHASES_GROUP || consumeCanvasClick()) return
        const day = localMsToDay(time)
        const range = clampRangeToFree(day, day, periods)
        if (!range) return
        onDraftChange(range)
        onDraftCommit(range)
    }

    return (
        <div ref={containerRef} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <Timeline<PlanItem>
                groups={groups}
                items={items}
                selected={selected}
                visibleTimeStart={visibleStart}
                visibleTimeEnd={visibleEnd}
                onTimeChange={(start, end) => onVisibleRangeChange(start, end)}
                minZoom={VIEW_SPAN_MS[view]}
                maxZoom={VIEW_SPAN_MS[view]}
                dragSnap={DAY_MS}
                lineHeight={LINE_HEIGHT}
                itemHeightRatio={0.7}
                sidebarWidth={SIDEBAR_WIDTH}
                stackItems={false}
                canMove
                canChangeGroup={false}
                canResize="both"
                scrollRef={(element) => {
                    scrollElementRef.current = element
                }}
                itemRenderer={renderItem}
                // dragSnap is epoch-aligned and cannot land on Mondays: snap here instead
                moveResizeValidator={(_action, _item, time) => dayToLocalMs(snapToWeekStart(localMsToDay(time)))}
                onItemMove={handleItemMove}
                onItemResize={handleItemResize}
                onItemClick={handleItemActivate}
                onItemSelect={handleItemActivate}
                onCanvasClick={handleCanvasClick}
            >
                <TimelineHeaders>
                    <SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} />}</SidebarHeader>
                    {view === 'weeks' ? (
                        <>
                            <DateHeader unit="month" />
                            {/* The library has no week unit: draw Mondays over day intervals, seven days wide */}
                            <CustomHeader unit="day" height={28}>
                                {({ headerContext: { intervals }, getRootProps, getIntervalProps }) => (
                                    <div {...getRootProps()}>
                                        {intervals
                                            .filter((interval) => interval.startTime.day() === 1)
                                            .map((interval) => {
                                                const intervalProps = getIntervalProps({ interval })
                                                return (
                                                    <div
                                                        {...intervalProps}
                                                        key={intervalProps.key}
                                                        className="border-l border-gray-200 text-center text-xs leading-7 text-gray-600"
                                                        style={{
                                                            ...intervalProps.style,
                                                            width: Number(intervalProps.style.width) * 7,
                                                        }}
                                                    >
                                                        {interval.startTime.format('D/M')}
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}
                            </CustomHeader>
                        </>
                    ) : (
                        <>
                            <DateHeader unit="year" />
                            <DateHeader unit="month" />
                        </>
                    )}
                </TimelineHeaders>
                <TimelineMarkers>
                    <TodayMarker />
                </TimelineMarkers>
            </Timeline>
        </div>
    )
}
```

If `<Timeline<PlanItem>` or one of the header child-prop names does not type-check, use the form that worked in the Task 1 spike — the spike is the reference for this library version.

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run tests/unit/macro-period-timeline.test.tsx tests/unit/use-draft-period-drag.test.tsx`
Expected: PASS.

- [ ] **Step 9: Full checks, changelog, commit**

Run: `npm run type-check && npm run lint` — expected: no errors.

```bash
git add src/components/useDraftPeriodDrag.ts src/components/MacroPeriodTimeline.tsx tests/unit/use-draft-period-drag.test.tsx tests/unit/macro-period-timeline.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(planning): lane timeline with drag to create, move and resize"
```

---

### Task 9: Planning tab, default view of the trainee

**Files:**
- Create: `src/app/trainer/trainees/[id]/_planning-tab.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx` (`DetailTab` type at line ~177, initial tab at ~316, tab bar at ~1196, tab content at ~2000)
- Modify: `tests/unit/trainer-trainee-programs-tab.test.tsx`, `tests/unit/trainer-trainee-detail-sbd-report.test.tsx`, `tests/unit/trainer-trainee-detail-resend-invite.test.tsx`
- Test: `tests/unit/trainer-trainee-planning-tab.test.tsx`

**Interfaces:**
- Consumes: `MacroPeriodTimelineProps` (type only) and the component through `next/dynamic` (Task 8); `MacroPeriodFormModal`, `MacroPeriodFormValues` (Task 7); the period endpoints (Task 5) and `GET /api/macro-phase-types` (Task 4); `VIEW_SPAN_MS`, `WEEK_MS`, `dayToLocalMs`, `localMsToDay`, `weekStartOf`, `findOverlap`, types (Task 2); `trainer:planning.*` copy (Task 7).
- Produces: `PlanningTab` (default export) with props `{ traineeId: string }`; `DetailTab` gains `'planning'`, which is the default; any valid `?tab=<name>` selects that tab.

- [ ] **Step 1: Write the failing tab tests**

`tests/unit/trainer-trainee-planning-tab.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'

const mocks = vi.hoisted(() => ({
    timeline: null as MacroPeriodTimelineProps | null,
    showToast: vi.fn(),
    push: vi.fn(),
    startLoader: vi.fn(),
}))

// The real timeline is loaded with next/dynamic: replace the loader with a stub that records its props
vi.mock('next/dynamic', () => ({
    default: () => (props: MacroPeriodTimelineProps) => {
        mocks.timeline = props
        return <div data-testid="timeline" />
    },
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@/components/NavigationLoadingProvider', () => ({
    useNavigationLoader: () => ({ isLoading: false, start: mocks.startLoader, stop: vi.fn() }),
}))

import PlanningTab from '@/app/trainer/trainees/[id]/_planning-tab'
import {
    VIEW_SPAN_MS,
    WEEK_MS,
    dayToLocalMs,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
} from '@/lib/macro-periods'

const TRAINEE_ID = 'trainee-1'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'ph1',
    name: 'Forza',
    description: 'Carichi alti',
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    usageCount: 1,
    ...overrides,
})

const PHASES = [
    phase({ id: 'ph1', name: 'Forza' }),
    phase({ id: 'ph2', name: 'Scarico', description: null, sortOrder: 1, usageCount: 0 }),
    phase({ id: 'ph3', name: 'Vecchia usata', sortOrder: 2, isActive: false }),
    phase({ id: 'ph4', name: 'Vecchia mai usata', sortOrder: 3, isActive: false, usageCount: 0 }),
]

const period = (id: string, startDate: string, endDate: string, phaseId = 'ph1'): MacroPeriodDto => {
    const source = PHASES.find((item) => item.id === phaseId) ?? PHASES[0]
    return {
        id,
        startDate,
        endDate,
        note: null,
        phaseType: { id: source.id, name: source.name, color: source.color, isActive: source.isActive },
    }
}

const PERIODS = [period('a', '2026-10-05', '2026-10-18'), period('b', '2026-11-02', '2026-11-08', 'ph3')]
const PROGRAMS: PlanProgramDto[] = [{ id: 'g1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 }]

type Call = { url: string; method: string; body: unknown }
type Reply = { status: number; json: unknown }

interface ApiOptions {
    periods?: MacroPeriodDto[]
    loadStatus?: number
    onWrite?: (call: Call) => Reply
}

function mockApi({ periods = PERIODS, loadStatus = 200, onWrite }: ApiOptions = {}) {
    const calls: Call[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json }) as Response

        if (method === 'GET') {
            if (url === '/api/macro-phase-types') return reply(loadStatus, { data: { items: PHASES } })
            return reply(loadStatus, { data: { periods, programs: PROGRAMS } })
        }

        const call = { url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined }
        calls.push(call)
        const { status, json } = onWrite ? onWrite(call) : { status: 200, json: { data: {} } }
        return reply(status, json)
    })
    return calls
}

function timeline(): MacroPeriodTimelineProps {
    if (!mocks.timeline) throw new Error('timeline not rendered')
    return mocks.timeline
}

async function renderTab(options?: ApiOptions) {
    const calls = mockApi(options)
    render(<PlanningTab traineeId={TRAINEE_ID} />)
    await screen.findByTestId('timeline')
    return calls
}

const TODAY = '2026-10-07' // a Wednesday

describe('PlanningTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.timeline = null
        // only the clock is faked, so waitFor and findBy* keep working
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(`${TODAY}T10:00:00.000Z`))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('loads the plan and hands periods and programs to the timeline', async () => {
        await renderTab()

        expect(global.fetch).toHaveBeenCalledWith(`/api/trainer/trainees/${TRAINEE_ID}/macro-periods`)
        expect(global.fetch).toHaveBeenCalledWith('/api/macro-phase-types')
        expect(timeline().periods).toEqual(PERIODS)
        expect(timeline().programs).toEqual(PROGRAMS)
        expect(timeline().view).toBe('weeks')
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.weeks)
        // two weeks of lead-in before the current week
        expect(timeline().visibleStart).toBe(dayToLocalMs('2026-10-05') - 2 * WEEK_MS)
    })

    it('lists in the legend the active phases and the archived ones still in use, with their meaning', async () => {
        await renderTab()

        const legend = within(screen.getByRole('list', { name: 'planning.legend' }))
        expect(legend.getByText('Forza')).toBeInTheDocument()
        expect(legend.getByText('Carichi alti')).toBeInTheDocument()
        expect(legend.getByText('Scarico')).toBeInTheDocument()
        expect(legend.getByText('Vecchia usata')).toBeInTheDocument()
        expect(legend.getByText('planning.archivedPhase')).toBeInTheDocument()
        expect(legend.queryByText('Vecchia mai usata')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'planning.managePhases' })).toHaveAttribute('href', '/profile')
    })

    it('shows the empty hint when nothing is planned', async () => {
        await renderTab({ periods: [] })

        expect(screen.getByText('planning.empty')).toBeInTheDocument()
    })

    it('shows an error with a retry when the plan cannot be loaded', async () => {
        mockApi({ loadStatus: 500 })
        render(<PlanningTab traineeId={TRAINEE_ID} />)

        expect(await screen.findByText('planning.loadError')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'common:common.retry' })).toBeInTheDocument()
        expect(screen.queryByTestId('timeline')).not.toBeInTheDocument()
    })

    it('opens the dialog on a drawn range and adds the saved period to the timeline', async () => {
        const created = period('c', '2026-10-19', '2026-10-25')
        const calls = await renderTab({ onWrite: () => ({ status: 201, json: { data: { period: created } } }) })

        act(() => {
            timeline().onDraftChange({ startDate: '2026-10-19', endDate: '2026-10-25' })
            timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' })
        })

        expect(timeline().draft).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' })
        const dialog = within(screen.getByRole('dialog'))
        expect(dialog.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-10-19')

        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(calls).toEqual([
            {
                url: `/api/trainer/trainees/${TRAINEE_ID}/macro-periods`,
                method: 'POST',
                body: { phaseTypeId: 'ph1', startDate: '2026-10-19', endDate: '2026-10-25', note: null },
            },
        ])
        expect(timeline().periods.map((item) => item.id)).toEqual(['a', 'c', 'b'])
        expect(timeline().draft).toBeNull()
    })

    it('keeps the dialog open with the message when the phase was archived elsewhere', async () => {
        await renderTab({
            onWrite: () => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPhase.archived' } } }),
        })

        act(() => timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common:common.save' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('errors:macroPhase.archived')
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(timeline().periods).toEqual(PERIODS)
    })

    it('refuses in the dialog a range that overlaps another period, without calling the API', async () => {
        const calls = await renderTab()

        act(() => timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' }))
        const dialog = within(screen.getByRole('dialog'))
        fireEvent.change(dialog.getByLabelText(/planning\.endWeek/), { target: { value: '2026-11-04' } })
        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('errors:macroPeriod.overlap')
        expect(calls).toHaveLength(0)
    })

    it('discards the draft when the dialog is cancelled', async () => {
        await renderTab()

        act(() => {
            timeline().onDraftChange({ startDate: '2026-10-19', endDate: '2026-10-25' })
            timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' })
        })
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common:common.cancel' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(timeline().draft).toBeNull()
    })

    it('opens an empty dialog from the "new period" button', async () => {
        await renderTab()

        fireEvent.click(screen.getByRole('button', { name: 'planning.newPeriod' }))

        const dialog = within(screen.getByRole('dialog'))
        expect(dialog.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-10-05')
    })

    it('applies a drag at once and saves it', async () => {
        const calls = await renderTab({
            onWrite: () => ({ status: 200, json: { data: { period: period('a', '2026-10-19', '2026-11-01') } } }),
        })

        act(() => timeline().onPeriodChange('a', { startDate: '2026-10-19', endDate: '2026-11-01' }))

        // optimistic: visible before the request resolves
        expect(timeline().periods.find((item) => item.id === 'a')).toMatchObject({ startDate: '2026-10-19', endDate: '2026-11-01' })
        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-periods/a',
            method: 'PATCH',
            body: { startDate: '2026-10-19', endDate: '2026-11-01' },
        })
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('puts the bar back and explains why when the save is rejected', async () => {
        await renderTab({
            onWrite: () => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPeriod.overlap' } } }),
        })

        act(() => timeline().onPeriodChange('a', { startDate: '2026-10-19', endDate: '2026-11-01' }))

        await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('errors:macroPeriod.overlap', 'error'))
        expect(timeline().periods).toEqual(PERIODS)
    })

    it('explains a drag refused because it overlaps', async () => {
        const calls = await renderTab()

        act(() => timeline().onPeriodConflict())

        expect(mocks.showToast).toHaveBeenCalledWith('planning.overlapToast', 'warning')
        expect(calls).toHaveLength(0)
    })

    it('edits a period from its dialog', async () => {
        const updated = { ...period('a', '2026-10-05', '2026-10-18', 'ph2'), note: 'Blocco 1' }
        const calls = await renderTab({ onWrite: () => ({ status: 200, json: { data: { period: updated } } }) })

        act(() => timeline().onPeriodClick('a'))
        const dialog = within(screen.getByRole('dialog'))
        fireEvent.change(dialog.getByLabelText(/planning\.phase/), { target: { value: 'ph2' } })
        fireEvent.change(dialog.getByLabelText('planning.note'), { target: { value: 'Blocco 1' } })
        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(calls[0]).toEqual({
            url: '/api/macro-periods/a',
            method: 'PATCH',
            body: { phaseTypeId: 'ph2', startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' },
        })
        expect(timeline().periods.find((item) => item.id === 'a')).toEqual(updated)
    })

    it('deletes a period after confirmation', async () => {
        const calls = await renderTab({ onWrite: () => ({ status: 200, json: { data: { id: 'a' } } }) })

        act(() => timeline().onPeriodClick('a'))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'planning.editTitle' })).getByRole('button', { name: 'planning.deletePeriod' }))
        fireEvent.click(screen.getByRole('button', { name: 'planning.deleteConfirm' }))

        await waitFor(() => expect(timeline().periods.map((item) => item.id)).toEqual(['b']))
        expect(calls[0]).toEqual({ url: '/api/macro-periods/a', method: 'DELETE', body: undefined })
        expect(screen.queryByRole('dialog', { name: 'planning.editTitle' })).not.toBeInTheDocument()
    })

    it('switches to the month view, keeps the left edge and remembers the choice', async () => {
        await renderTab()
        const start = timeline().visibleStart

        fireEvent.click(screen.getByRole('button', { name: 'planning.viewMonth' }))

        expect(timeline().view).toBe('month')
        expect(timeline().visibleStart).toBe(start)
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.month)
        expect(screen.getByRole('button', { name: 'planning.viewMonth' })).toHaveAttribute('aria-pressed', 'true')
        expect(window.localStorage.getItem('zc.planning.view')).toBe('month')
    })

    it('restores the remembered view', async () => {
        window.localStorage.setItem('zc.planning.view', 'month')

        await renderTab()

        await waitFor(() => expect(timeline().view).toBe('month'))
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.month)
    })

    it('falls back to weeks for a garbage stored view', async () => {
        window.localStorage.setItem('zc.planning.view', 'decade')

        await renderTab()

        expect(timeline().view).toBe('weeks')
    })

    it('moves the window with the navigation buttons and comes back with "today"', async () => {
        await renderTab()
        const start = timeline().visibleStart

        fireEvent.click(screen.getByRole('button', { name: 'planning.next' }))
        expect(timeline().visibleStart).toBe(start + 4 * WEEK_MS)

        fireEvent.click(screen.getByRole('button', { name: 'planning.previous' }))
        fireEvent.click(screen.getByRole('button', { name: 'planning.previous' }))
        expect(timeline().visibleStart).toBe(start - 4 * WEEK_MS)

        fireEvent.click(screen.getByRole('button', { name: 'planning.today' }))
        expect(timeline().visibleStart).toBe(start)
    })

    it('follows the timeline when it is panned', async () => {
        await renderTab()

        act(() => timeline().onVisibleRangeChange(1000, 1000 + VIEW_SPAN_MS.weeks))

        expect(timeline().visibleStart).toBe(1000)
    })

    it('opens a program from its bar through the navigation loader', async () => {
        await renderTab()

        act(() => timeline().onProgramClick('g1'))

        expect(mocks.startLoader).toHaveBeenCalledTimes(1)
        expect(mocks.push).toHaveBeenCalledWith('/trainer/programs/g1')
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/trainer-trainee-planning-tab.test.tsx`
Expected: FAIL — cannot resolve `@/app/trainer/trainees/[id]/_planning-tab`.

- [ ] **Step 3: Write the tab**

`src/app/trainer/trainees/[id]/_planning-tab.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import MacroPeriodFormModal, { type MacroPeriodFormValues } from '@/components/MacroPeriodFormModal'
import type { MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'
import { useNavigationLoader } from '@/components/NavigationLoadingProvider'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import {
    VIEW_SPAN_MS,
    WEEK_MS,
    dayToLocalMs,
    findOverlap,
    localMsToDay,
    weekStartOf,
    type DayRange,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
    type TimelineView,
} from '@/lib/macro-periods'

// Client-only and split out: the timeline library touches the DOM at import time and is heavy
const MacroPeriodTimeline = dynamic<MacroPeriodTimelineProps>(() => import('@/components/MacroPeriodTimeline'), {
    ssr: false,
    loading: () => <SkeletonDetail />,
})

const VIEW_STORAGE_KEY = 'zc.planning.view'

/** How far one press of previous/next moves the window. */
const NAV_STEP_MS: Record<TimelineView, number> = { weeks: 4 * WEEK_MS, month: 13 * WEEK_MS }

/** Weeks shown before the current one, so "now" is not glued to the left edge. */
const LEAD_IN_MS: Record<TimelineView, number> = { weeks: 2 * WEEK_MS, month: 8 * WEEK_MS }

function readStoredView(): TimelineView {
    try {
        return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'month' ? 'month' : 'weeks'
    } catch {
        return 'weeks'
    }
}

function storeView(view: TimelineView) {
    try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, view)
    } catch {
        // storage unavailable (private mode): the choice simply is not remembered
    }
}

function rangeAroundToday(view: TimelineView) {
    const start = dayToLocalMs(weekStartOf(localMsToDay(Date.now()))) - LEAD_IN_MS[view]
    return { start, end: start + VIEW_SPAN_MS[view] }
}

const byStartDate = (a: MacroPeriodDto, b: MacroPeriodDto) => a.startDate.localeCompare(b.startDate)

type DialogState =
    | { mode: 'create'; initial: Partial<MacroPeriodFormValues> }
    | { mode: 'edit'; periodId: string; initial: MacroPeriodFormValues }

export interface PlanningTabProps {
    traineeId: string
}

/**
 * Trainer-only tab, default view of a trainee: the long-term plan as macro
 * periods on an editable timeline, with the trainee's programs underneath.
 */
export default function PlanningTab({ traineeId }: PlanningTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const router = useRouter()
    const navigation = useNavigationLoader()

    const [periods, setPeriods] = useState<MacroPeriodDto[]>([])
    const [programs, setPrograms] = useState<PlanProgramDto[]>([])
    const [phaseTypes, setPhaseTypes] = useState<MacroPhaseTypeDto[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)

    // 'weeks' on the first render (server and client agree), stored choice applied after mount
    const [view, setView] = useState<TimelineView>('weeks')
    const [visibleRange, setVisibleRange] = useState(() => rangeAroundToday('weeks'))

    const [draft, setDraft] = useState<DayRange | null>(null)
    const [dialog, setDialog] = useState<DialogState | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    const load = useCallback(async () => {
        try {
            setLoading(true)
            const [planRes, phasesRes] = await Promise.all([
                fetch(`/api/trainer/trainees/${traineeId}/macro-periods`),
                fetch('/api/macro-phase-types'),
            ])
            const [plan, phases] = await Promise.all([planRes.json(), phasesRes.json()])
            if (!planRes.ok || !phasesRes.ok) throw new Error('load failed')

            setPeriods(plan.data.periods)
            setPrograms(plan.data.programs)
            setPhaseTypes(phases.data.items)
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [traineeId])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        const stored = readStoredView()
        if (stored === 'weeks') return
        setView(stored)
        setVisibleRange((current) => ({ start: current.start, end: current.start + VIEW_SPAN_MS[stored] }))
    }, [])

    /** Sends a write; resolves to `data`, throws an Error carrying the translated message. */
    const send = async (url: string, method: string, body: unknown, fallbackKey: string) => {
        const res = await fetch(url, {
            method,
            ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(getApiErrorMessage(json, t(fallbackKey), t))
        return json.data
    }

    const closeDialog = () => {
        setDialog(null)
        setDialogError(null)
        setDraft(null)
    }

    const handleViewChange = (next: TimelineView) => {
        setView(next)
        storeView(next)
        setVisibleRange((current) => ({ start: current.start, end: current.start + VIEW_SPAN_MS[next] }))
    }

    const shiftWindow = (direction: -1 | 1) =>
        setVisibleRange((current) => ({
            start: current.start + direction * NAV_STEP_MS[view],
            end: current.end + direction * NAV_STEP_MS[view],
        }))

    const handleDraftCommit = (range: DayRange) => {
        setDraft(range)
        setDialogError(null)
        setDialog({ mode: 'create', initial: range })
    }

    const handlePeriodClick = (id: string) => {
        const period = periods.find((item) => item.id === id)
        if (!period) return
        setDialogError(null)
        setDialog({
            mode: 'edit',
            periodId: id,
            initial: {
                phaseTypeId: period.phaseType.id,
                startDate: period.startDate,
                endDate: period.endDate,
                note: period.note,
            },
        })
    }

    /** A drag: show it at once, save it, put the bar back if the server refuses. */
    const handlePeriodChange = async (id: string, range: DayRange) => {
        const previous = periods
        setPeriods((current) => current.map((item) => (item.id === id ? { ...item, ...range } : item)).sort(byStartDate))
        try {
            await send(`/api/macro-periods/${id}`, 'PATCH', range, 'planning.saveError')
        } catch (err) {
            setPeriods(previous)
            showToast(err instanceof Error ? err.message : t('planning.saveError'), 'error')
        }
    }

    const handleSubmit = async (values: MacroPeriodFormValues) => {
        if (!dialog) return
        const editedId = dialog.mode === 'edit' ? dialog.periodId : undefined

        // Same rule as the server: do not send a request that is going to be refused
        if (findOverlap(values, periods, editedId)) {
            setDialogError(t('errors:macroPeriod.overlap'))
            return
        }

        setSaving(true)
        setDialogError(null)
        try {
            if (editedId) {
                const data = await send(`/api/macro-periods/${editedId}`, 'PATCH', values, 'planning.saveError')
                setPeriods((current) => current.map((item) => (item.id === editedId ? data.period : item)).sort(byStartDate))
            } else {
                const data = await send(`/api/trainer/trainees/${traineeId}/macro-periods`, 'POST', values, 'planning.saveError')
                setPeriods((current) => [...current, data.period].sort(byStartDate))
            }
            closeDialog()
        } catch (err) {
            // The dialog stays open: the trainer can pick another phase or range
            setDialogError(err instanceof Error ? err.message : t('planning.saveError'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (dialog?.mode !== 'edit') return
        const { periodId } = dialog
        setSaving(true)
        try {
            await send(`/api/macro-periods/${periodId}`, 'DELETE', undefined, 'planning.deleteError')
            setPeriods((current) => current.filter((item) => item.id !== periodId))
            setConfirmingDelete(false)
            closeDialog()
        } catch (err) {
            setConfirmingDelete(false)
            setDialogError(err instanceof Error ? err.message : t('planning.deleteError'))
        } finally {
            setSaving(false)
        }
    }

    const handleProgramClick = (id: string) => {
        navigation.start()
        router.push(`/trainer/programs/${id}`)
    }

    // Legend: what the trainer can assign, plus archived phases this plan still shows
    const legendPhases = useMemo(() => {
        const usedIds = new Set(periods.map((period) => period.phaseType.id))
        return phaseTypes.filter((phase) => phase.isActive || usedIds.has(phase.id))
    }, [phaseTypes, periods])

    const labels = useMemo(
        () => ({ phases: t('planning.rowPhases'), programs: t('planning.rowPrograms'), draft: t('planning.draft') }),
        [t]
    )

    const viewButtonClass = (active: boolean) =>
        active ? 'bg-brand-primary text-white hover:bg-brand-primary-hover' : ''

    if (loading) return <SkeletonDetail />

    if (loadFailed) {
        return (
            <div className="space-y-3">
                <p className="text-state-error">{t('planning.loadError')}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    {t('common:common.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">{t('planning.title')}</h2>
                    <p className="text-sm text-gray-600">{t('planning.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus size={16} />} onClick={() => setDialog({ mode: 'create', initial: {} })}>
                    {t('planning.newPeriod')}
                </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-pressed={view === 'weeks'}
                        className={viewButtonClass(view === 'weeks')}
                        onClick={() => handleViewChange('weeks')}
                    >
                        {t('planning.viewWeeks')}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-pressed={view === 'month'}
                        className={viewButtonClass(view === 'month')}
                        onClick={() => handleViewChange('month')}
                    >
                        {t('planning.viewMonth')}
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" aria-label={t('planning.previous')} onClick={() => shiftWindow(-1)}>
                        <ChevronLeft size={16} />
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setVisibleRange(rangeAroundToday(view))}>
                        {t('planning.today')}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" aria-label={t('planning.next')} onClick={() => shiftWindow(1)}>
                        <ChevronRight size={16} />
                    </Button>
                </div>
            </div>

            <MacroPeriodTimeline
                periods={periods}
                programs={programs}
                view={view}
                visibleStart={visibleRange.start}
                visibleEnd={visibleRange.end}
                draft={draft}
                labels={labels}
                onVisibleRangeChange={(start, end) => setVisibleRange({ start, end })}
                onDraftChange={setDraft}
                onDraftCommit={handleDraftCommit}
                onPeriodChange={(id, range) => void handlePeriodChange(id, range)}
                onPeriodConflict={() => showToast(t('planning.overlapToast'), 'warning')}
                onPeriodClick={handlePeriodClick}
                onProgramClick={handleProgramClick}
            />

            <p className="text-xs text-gray-500">{periods.length === 0 ? t('planning.empty') : t('planning.dragHint')}</p>

            <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">{t('planning.legend')}</h3>
                    <Link href="/profile" className="text-sm font-semibold text-brand-primary hover:underline">
                        {t('planning.managePhases')}
                    </Link>
                </div>
                <ul aria-label={t('planning.legend')} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {legendPhases.map((phase) => (
                        <li key={phase.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-gray-300"
                                style={{ backgroundColor: phase.color }}
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                    {phase.name}
                                    {!phase.isActive && (
                                        <span className="ml-2 text-xs font-normal text-gray-500">{t('planning.archivedPhase')}</span>
                                    )}
                                </p>
                                {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {dialog && (
                <MacroPeriodFormModal
                    // a fresh form for each opening: its fields are initialised once, from `initial`
                    key={dialog.mode === 'edit' ? dialog.periodId : `new:${dialog.initial.startDate ?? ''}`}
                    mode={dialog.mode}
                    initial={dialog.initial}
                    phaseTypes={phaseTypes}
                    isSaving={saving}
                    error={dialogError}
                    onClose={closeDialog}
                    onSubmit={(values) => void handleSubmit(values)}
                    onDelete={dialog.mode === 'edit' ? () => setConfirmingDelete(true) : undefined}
                />
            )}

            <ConfirmationModal
                isOpen={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                onConfirm={() => void handleDelete()}
                title={t('planning.deleteConfirmTitle')}
                message={t('planning.deleteConfirmMessage')}
                confirmText={t('planning.deleteConfirm')}
                variant="danger"
                isLoading={saving}
            />
        </div>
    )
}
```

Add the missing copy key used above. In both `trainer.json` files, inside `planning`, after `"deleteConfirmMessage"`:

- it: `"deleteConfirm": "Elimina periodo",`
- en: `"deleteConfirm": "Delete period",`

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/trainer-trainee-planning-tab.test.tsx`
Expected: PASS. If the "restores the remembered view" test sees `weeks`, the mount effect is not running after the stored value is read — check the effect, do not change the test.

- [ ] **Step 5: Make planning the default tab**

In `src/app/trainer/trainees/[id]/_content.tsx`:

1. Import (next to `import MeasurementsTab from './_measurements-tab'`):

```tsx
import PlanningTab from './_planning-tab'
```

and add `CalendarRange` to the existing `lucide-react` import list.

2. Replace the `DetailTab` type:

```tsx
type DetailTab = 'planning' | 'notes' | 'programs' | 'records' | 'reports' | 'measurements' | 'subscription'

const DETAIL_TABS: readonly DetailTab[] = ['planning', 'notes', 'programs', 'records', 'reports', 'measurements', 'subscription']

/** `?tab=<name>` opens that tab; anything else opens the plan. */
function resolveInitialTab(requested: string | null): DetailTab {
    return DETAIL_TABS.find((tab) => tab === requested) ?? 'planning'
}
```

3. Replace the `activeTab` state initialiser:

```tsx
    const [activeTab, setActiveTab] = useState<DetailTab>(() => resolveInitialTab(searchParams.get('tab')))
```

4. In the tab bar, change `<nav className="-mb-px flex space-x-8">` to `<nav className="-mb-px flex space-x-8 overflow-x-auto">` (seven tabs no longer fit a phone) and insert, as the **first** child of the `<nav>`, before the notes button:

```tsx
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={<CalendarRange size={16} />}
                                onClick={() => setActiveTab('planning')}
                                aria-pressed={activeTab === 'planning'}
                                className={`rounded-none border-b-2 bg-transparent px-1 pb-4 font-semibold shadow-none hover:bg-transparent ${activeTab === 'planning'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    }`}
                            >
                                {t('planning.tab')}
                            </Button>
```

5. Right before `{activeTab === 'notes' && (`:

```tsx
                {activeTab === 'planning' && <PlanningTab traineeId={traineeId} />}
```

- [ ] **Step 6: Repair the three existing tests of this page**

They render `TraineeDetailContent` and assumed the programs tab was the default. In each of `tests/unit/trainer-trainee-programs-tab.test.tsx`, `tests/unit/trainer-trainee-detail-sbd-report.test.tsx` and `tests/unit/trainer-trainee-detail-resend-invite.test.tsx`, add next to the other `vi.mock` calls:

```tsx
vi.mock('@/app/trainer/trainees/[id]/_planning-tab', () => ({
    default: () => <div data-testid="planning-tab" />,
}))
```

Without this mock the real tab would mount and call `fetch` with URLs those tests do not answer.

Then:
- `trainer-trainee-programs-tab.test.tsx`: in `beforeEach`, change `navigationState.search = ''` to `navigationState.search = 'tab=programs'`. Tests that set `'tab=subscription'` themselves stay as they are.
- `trainer-trainee-detail-sbd-report.test.tsx` clicks `athletes.reportsTab` before asserting, and `trainer-trainee-detail-resend-invite.test.tsx` only uses the page header: neither depends on the default tab, the mock is all they need.

Add one test to `trainer-trainee-programs-tab.test.tsx` for the new default (place it with the other tab tests):

```tsx
    it('opens on the planning tab when no tab is requested', async () => {
        navigationState.search = ''

        render(<TraineeDetailContent />)

        expect(await screen.findByTestId('planning-tab')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'planning.tab' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('opens on the planning tab for an unknown tab name', async () => {
        navigationState.search = 'tab=nope'

        render(<TraineeDetailContent />)

        expect(await screen.findByTestId('planning-tab')).toBeInTheDocument()
    })
```

They rely on the `fetch` mock the file's `beforeEach` already installs; nothing else to set up.

Run: `npx vitest run tests/unit/trainer-trainee-programs-tab.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx tests/unit/trainer-trainee-detail-resend-invite.test.tsx`
Expected: PASS, including the two new tests. A test that still fails because it expected programs content without asking for the tab needs the `tab=programs` search param — not a change to the component.

- [ ] **Step 7: Full checks, changelog, commit**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: no type or lint errors; the whole suite passes and the coverage thresholds hold. Validate both `trainer.json` files with the `JSON.parse` one-liner.

```bash
git add "src/app/trainer/trainees/[id]/_planning-tab.tsx" "src/app/trainer/trainees/[id]/_content.tsx" tests/unit/trainer-trainee-planning-tab.test.tsx tests/unit/trainer-trainee-programs-tab.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx tests/unit/trainer-trainee-detail-resend-invite.test.tsx public/locales/it/trainer.json public/locales/en/trainer.json implementation-docs/CHANGELOG.md
git commit -m "feat(planning): macro-period planning tab as the trainee default view"
```

---

### Task 10: End-to-end flow and release checks

**Files:**
- Create: `tests/e2e/trainer-macro-periods.spec.ts`

**Interfaces:**
- Consumes: the whole feature. Requires the dev server, seed data (`tests/e2e/fixtures/test-users.ts`) and the migration `20261011000000_add_macro_periods` applied.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the scenario**

`tests/e2e/trainer-macro-periods.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

Run (dev server running, seed data present, migration applied): `npx playwright test tests/e2e/trainer-macro-periods.spec.ts`
Expected: PASS.

If the database or the dev server is not available, **do not mark this step done**: say in the report that the scenario is written but not executed, exactly as the changelog did for earlier E2E work.

If step 4 or 5 fails on pointer geometry only (the bar moved, but the assertion on pixels is off), compare with what the Task 1 probe measured before touching the feature code.

- [ ] **Step 3: Release checks**

Run each and record the result:

```bash
npm run type-check
npm run lint
npm run test:unit
npm run build
```

Expected: all four succeed; `test:unit` keeps every coverage threshold. `npm run build` must not report the timeline library in any route other than `/trainer/trainees/[id]` — check the route table for an unexpected size jump on `/profile` or `/trainer/dashboard`, which would mean `MacroPeriodTimeline` was imported statically somewhere.

- [ ] **Step 4: Hand over what was not verified**

The task report must list, as open items for the user:
- **Touch**: moving and resizing a bar with a finger, and tap-on-empty-week opening the dialog, were never exercised automatically. To check by hand on a phone.
- Whether the E2E scenario actually ran.
- Whether the migration was applied to any database.

- [ ] **Step 5: Changelog and commit**

The changelog entry for this task summarises the feature for a reader of the release notes and repeats the migration note from Task 3.

```bash
git add tests/e2e/trainer-macro-periods.spec.ts implementation-docs/CHANGELOG.md
git commit -m "test(e2e): macro-period planning flow"
```
