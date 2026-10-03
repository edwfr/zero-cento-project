# Trainer Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static trainer home (`/trainer/dashboard`) with a desktop working surface: a header with live KPIs, "To do today", inactive trainees, recent feedback (Phase 1), then activity feed, new PRs, 8-week trend and consistency ranking (Phase 2).

**Architecture:** `page.tsx` becomes a thin server shell that resolves session, locale and the trainer's trainee list once, then renders one async server component per widget, each inside its own `<Suspense>`. Every widget calls one pure query module in `src/lib/trainer-dashboard/` and catches its own failure through `loadWidget()`, so one broken widget never takes the page down. The only client component is the recharts trend chart.

**Tech Stack:** Next.js 15 App Router (React 18.3), Prisma, Tailwind, lucide-react 1.8, recharts 3, Vitest + Testing Library (jsdom, `TZ=UTC`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-trainer-home-redesign-design.md`

## Global Constraints

- Desktop only: `lg:grid-cols-3` grid, single column below `lg`; no mobile-specific work.
- No DB migration, no new Prisma fields.
- **No emoji anywhere in the UI or in locale strings.** Every visual marker is a `lucide-react` icon.
- All user-facing text goes through the dashboard translator, with keys under `trainerDashboard.*` in both `public/locales/it/trainer.json` and `public/locales/en/trainer.json`.
- Thresholds: inactivity 7 days, subscription expiring 14 days (`EXPIRING_THRESHOLD_DAYS` from `src/lib/subscriptions.ts`), program ending 7 days, high RPE ≥ 9, recent window 7 days, trend 8 weeks, consistency 4 weeks.
- List limits: inactive 6, feedback 10, feed 15, records 6, ranking 5.
- Every query is scoped to the trainer's trainees; inactive trainees (`User.isActive = false`) are excluded from all widgets.
- Counts use `count` / `groupBy`, never `findMany().length`. Narrow `select`s. No raw SQL.
- Widgets and their tests import components **directly** (`@/components/Card`, `@/components/ProgressBar`, `@/components/Skeleton`), never the `@/components` barrel (≈48 s import cost under jsdom).
- `src/lib/**` coverage floor is 94/94/97/88 (lines/statements/functions/branches): every new lib module ships with tests covering each branch.

## Deviations from the spec (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| Trainee ids via `React.cache` | Shell fetches `getTrainerTrainees()` once and passes it to every widget through `WidgetContext` | Same single query per request, no `cache` import (the test environment has no React `cache`), simpler to test |
| Widget error boundary | `loadWidget()` try/catch inside each server widget, plus `logger.error` | A client error boundary cannot see server-component errors reliably in production; try/catch on the server is deterministic and testable |
| Week boundaries in local time | UTC calendar days and UTC ISO weeks | `ExerciseFeedback.date` is stored as a UTC midnight day key (`getTodayDateKey()`); the server runs in UTC; mixing local time would split a session across two days |
| High RPE = `ExerciseFeedback.actualRpe ≥ 9` | Feedback-level **or** any `SetPerformed.actualRpe ≥ 9`; badge shows the max | Trainees can log RPE per set (2026-05 set-RPE feature); feedback-level only would miss them |

## Review Focus

1. **Trainer with zero trainees** (fresh account, or admin opening the page): every widget shows its empty state and no Prisma query runs with `in: []`. Pinned in Tasks 3–6 and 8–11 ("returns … without querying when there are no trainees").
2. **Deactivated trainee still linked to the trainer**: never appears in KPIs, lists, feed or ranking. Pinned in Tasks 1, 3, 5, 11 (fixtures include `t3`, inactive).
3. **Session logged on a Sunday evening in Italy**: `date` is the UTC day key, so it belongs to that Sunday's week; relative times come from `createdAt`. Pinned in Task 1 (`groupSessions` uses `date` for the day and `createdAt` for ordering) and Task 10 (week bucketing).
4. **Program with `startDate = null` or starting in the future**: ignored by "program ending" and by the consistency ranking. Pinned in Tasks 4 and 11.
5. **Feedback whose note is only whitespace**: not shown as a "recent feedback" item unless its RPE is high. Pinned in Task 6.

## File Structure

```
src/lib/trainer-dashboard/
  constants.ts            thresholds and list limits
  dates.ts                UTC day/week helpers, program end date, recent window
  trainees.ts             getTrainerTrainees, activeTraineeIds, fullName, initials
  sessions.ts             SESSION_FEEDBACK_SELECT, groupSessions, countSessionsBetween
  load-widget.ts          loadWidget(): try/catch + logger
  i18n.ts                 locale resolution, translator (with _zero/_one plurals), date/relative formatting, greeting
  header-kpis.ts          getHeaderKpis
  todo-today.ts           getTodoItems
  inactive-trainees.ts    getInactiveTrainees
  recent-feedback.ts      getRecentFeedback
  activity-feed.ts        getActivityFeed          (phase 2)
  new-records.ts          getNewRecords            (phase 2)
  weekly-trend.ts         getWeeklyTrend           (phase 2)
  consistency-ranking.ts  getConsistencyRanking    (phase 2)

src/app/trainer/dashboard/
  page.tsx                thin server shell (rewritten)
  _widgets/types.ts       WidgetContext
  _widgets/WidgetCard.tsx WidgetCard, WidgetEmpty, WidgetError, WidgetSkeleton, Avatar
  _widgets/DashboardHeader.tsx  greeting, date, quick actions, <Suspense> around HeaderKpis
  _widgets/HeaderKpis.tsx
  _widgets/TodoTodayWidget.tsx
  _widgets/InactiveTraineesWidget.tsx
  _widgets/RecentFeedbackWidget.tsx
  _widgets/ActivityFeedWidget.tsx        (phase 2)
  _widgets/NewRecordsWidget.tsx          (phase 2)
  _widgets/WeeklyTrendWidget.tsx         (phase 2)
  _widgets/WeeklyTrendChart.tsx          (phase 2, 'use client')
  _widgets/ConsistencyRankingWidget.tsx  (phase 2)

tests/unit/trainer-dashboard/
  fixtures.ts             NOW, day(), trainees, makeCtx()  (not a test file: no .test suffix)
  dates.test.ts  sessions.test.ts  trainees.test.ts  load-widget.test.ts  i18n.test.ts
  header-kpis.test.ts  todo-today.test.ts  inactive-trainees.test.ts  recent-feedback.test.ts
  activity-feed.test.ts  new-records.test.ts  weekly-trend.test.ts  consistency-ranking.test.ts
  widgets-phase1.test.tsx  widgets-phase2.test.tsx

tests/e2e/trainer-dashboard.spec.ts            (new)
tests/e2e/trainer-subscription-renewals.spec.ts (home KPI assertion updated)
public/locales/{it,en}/trainer.json            trainerDashboard block replaced
implementation-docs/CHANGELOG.md               entries for phase 1 and phase 2
```

## Working notes for the implementer

- **Branch:** `feature/trainer-home-redesign` (already exists, created from `development`). Do not create worktrees. Commit only the files your task lists.
- **Pre-existing uncommitted changes** on this branch belong to the user: `implementation-docs/CHANGELOG.md` (an "Icone nelle tab" entry) and `src/app/trainer/trainees/[id]/_content.tsx`. Never `git add` them, never `git add -A` / `git add .`. Task 7 and Task 12 explain how to commit only our CHANGELOG entry.
- **Line endings:** `trainer.json` files are LF with a UTF-8 BOM; `CHANGELOG.md` is CRLF. Use the scripts given, or the Edit tool. Do not rewrite these files with Python text mode or `sed`.
- **Running tests:** `npx vitest run tests/unit/trainer-dashboard/<file>` for a single file. The repo is on `/mnt/c` under WSL: the full suite with coverage takes 8–10 minutes.
- **Calling an async server component in a test:** `render(await SomeWidget({ ctx }))`. This works because widgets use no hooks.
- **Prisma `groupBy` in tests:** the deep mock's typing breaks on `groupBy`; cast it like `tests/unit/lib/subscription-queries.test.ts` does: `const groupByMock = prismaMock.exerciseFeedback.groupBy as unknown as Mock`.
- `prismaMock` is reset before each test by `tests/unit/setup.ts`. Never re-declare `vi.mock('@/lib/prisma')`.

---

# Phase 1 — useful

### Task 1: Foundations — dates, constants, trainees, sessions, loadWidget

**Files:**
- Create: `src/lib/trainer-dashboard/constants.ts`
- Create: `src/lib/trainer-dashboard/dates.ts`
- Create: `src/lib/trainer-dashboard/trainees.ts`
- Create: `src/lib/trainer-dashboard/sessions.ts`
- Create: `src/lib/trainer-dashboard/load-widget.ts`
- Create: `tests/unit/trainer-dashboard/fixtures.ts`
- Test: `tests/unit/trainer-dashboard/dates.test.ts`, `sessions.test.ts`, `trainees.test.ts`, `load-widget.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `logger` from `@/lib/logger`.
- Produces:
  - `constants.ts`: `INACTIVITY_DAYS = 7`, `PROGRAM_ENDING_DAYS = 7`, `HIGH_RPE_THRESHOLD = 9`, `RECENT_WINDOW_DAYS = 7`, `TREND_WEEKS = 8`, `CONSISTENCY_WEEKS = 4`, `LIST_LIMITS = { inactive: 6, feedback: 10, feed: 15, records: 6, ranking: 5 }`
  - `dates.ts`: `DAY_MS`, `startOfUtcDay(date: Date): Date`, `addDays(date: Date, days: number): Date`, `startOfUtcWeek(date: Date): Date`, `utcDayKey(date: Date): string` (`YYYY-MM-DD`), `wholeDaysBetween(from: Date, to: Date): number`, `programEndDate(startDate: Date, durationWeeks: number): Date`, `recentWindowStart(now: Date): Date`
  - `trainees.ts`: `interface DashboardTrainee { id: string; firstName: string; lastName: string; isActive: boolean }`, `getTrainerTrainees(trainerId: string): Promise<DashboardTrainee[]>`, `activeTraineeIds(trainees: DashboardTrainee[]): string[]`, `fullName(person: { firstName: string; lastName: string }): string`, `initials(person: { firstName: string; lastName: string }): string`
  - `sessions.ts`: `SESSION_FEEDBACK_SELECT`, `interface SessionSourceRow { traineeId: string; date: Date; createdAt: Date; workoutExercise: { workoutId: string } }`, `interface TrainingSession { key: string; traineeId: string; workoutId: string; day: string; lastLoggedAt: Date; exerciseCount: number }`, `groupSessions(rows: SessionSourceRow[]): TrainingSession[]` (newest first), `countSessionsBetween(sessions: TrainingSession[], from: Date, to: Date): number` (`from` inclusive, `to` exclusive)
  - `load-widget.ts`: `type WidgetResult<T> = { ok: true; data: T } | { ok: false }`, `loadWidget<T>(widget: string, load: () => Promise<T>): Promise<WidgetResult<T>>`
  - `tests/unit/trainer-dashboard/fixtures.ts`: `NOW`, `day(iso)`, `at(isoDateTime)`, `makeTrainee(...)`, `TRAINEES` (used by every later test)

- [ ] **Step 1: Write the shared test fixtures**

`tests/unit/trainer-dashboard/fixtures.ts`:

```ts
import type { DashboardTrainee } from '@/lib/trainer-dashboard/trainees'

/** Saturday 3 Oct 2026, 10:00 UTC (12:00 in Rome). ISO week starts Mon 28 Sep. */
export const NOW = new Date('2026-10-03T10:00:00.000Z')

/** UTC midnight of a calendar day, the shape of ExerciseFeedback.date. */
export const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** A precise UTC instant, the shape of createdAt. */
export const at = (isoDateTime: string) => new Date(`${isoDateTime}.000Z`)

export const makeTrainee = (
    id: string,
    firstName: string,
    lastName: string,
    isActive = true,
): DashboardTrainee => ({ id, firstName, lastName, isActive })

/** t3 is deactivated: every widget must ignore it. */
export const TRAINEES: DashboardTrainee[] = [
    makeTrainee('t1', 'Anna', 'Rossi'),
    makeTrainee('t2', 'Luca', 'Bianchi'),
    makeTrainee('t3', 'Sara', 'Verdi', false),
]
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/trainer-dashboard/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    addDays,
    programEndDate,
    recentWindowStart,
    startOfUtcDay,
    startOfUtcWeek,
    utcDayKey,
    wholeDaysBetween,
} from '@/lib/trainer-dashboard/dates'
import { NOW, day, at } from './fixtures'

describe('trainer-dashboard dates', () => {
    it('startOfUtcDay drops the time of day', () => {
        expect(startOfUtcDay(at('2026-10-03T23:59:59'))).toEqual(day('2026-10-03'))
    })

    it('addDays moves by whole days in both directions', () => {
        expect(addDays(day('2026-10-03'), 2)).toEqual(day('2026-10-05'))
        expect(addDays(day('2026-10-03'), -7)).toEqual(day('2026-09-26'))
    })

    it('startOfUtcWeek returns the Monday of the ISO week', () => {
        expect(startOfUtcWeek(NOW)).toEqual(day('2026-09-28'))
        expect(startOfUtcWeek(day('2026-09-28'))).toEqual(day('2026-09-28'))
        expect(startOfUtcWeek(at('2026-10-04T23:00:00'))).toEqual(day('2026-09-28'))
    })

    it('utcDayKey formats YYYY-MM-DD', () => {
        expect(utcDayKey(at('2026-10-03T22:30:00'))).toBe('2026-10-03')
    })

    it('wholeDaysBetween counts calendar days, ignoring time of day', () => {
        expect(wholeDaysBetween(day('2026-09-26'), NOW)).toBe(7)
        expect(wholeDaysBetween(NOW, day('2026-10-01'))).toBe(-2)
    })

    it('programEndDate is start + durationWeeks × 7 days', () => {
        expect(programEndDate(at('2026-09-01T08:00:00'), 4)).toEqual(day('2026-09-29'))
    })

    it('recentWindowStart is 7 calendar days before today', () => {
        expect(recentWindowStart(NOW)).toEqual(day('2026-09-26'))
    })
})
```

`tests/unit/trainer-dashboard/sessions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { countSessionsBetween, groupSessions } from '@/lib/trainer-dashboard/sessions'
import { day, at } from './fixtures'

const row = (traineeId: string, workoutId: string, date: string, createdAt: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(createdAt),
    workoutExercise: { workoutId },
})

describe('groupSessions', () => {
    it('merges feedback of the same trainee, workout and day into one session', () => {
        const sessions = groupSessions([
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:00:00'),
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:40:00'),
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:20:00'),
        ])

        expect(sessions).toEqual([
            {
                key: 't1|w1|2026-10-02',
                traineeId: 't1',
                workoutId: 'w1',
                day: '2026-10-02',
                lastLoggedAt: at('2026-10-02T17:40:00'),
                exerciseCount: 3,
            },
        ])
    })

    it('splits by day (from the date key, not createdAt), by workout and by trainee, newest first', () => {
        const sessions = groupSessions([
            // logged just after midnight UTC but keyed on the previous day: still the 1 Oct session
            row('t1', 'w1', '2026-10-01', '2026-10-02T00:30:00'),
            row('t1', 'w1', '2026-10-03', '2026-10-03T08:00:00'),
            row('t1', 'w2', '2026-10-03', '2026-10-03T09:00:00'),
            row('t2', 'w2', '2026-10-03', '2026-10-03T07:00:00'),
        ])

        expect(sessions.map((s) => s.key)).toEqual([
            't1|w2|2026-10-03',
            't1|w1|2026-10-03',
            't2|w2|2026-10-03',
            't1|w1|2026-10-01',
        ])
    })

    it('returns an empty list for no rows', () => {
        expect(groupSessions([])).toEqual([])
    })
})

describe('countSessionsBetween', () => {
    it('counts sessions whose day is in [from, to)', () => {
        const sessions = groupSessions([
            row('t1', 'w1', '2026-09-27', '2026-09-27T10:00:00'),
            row('t1', 'w2', '2026-09-28', '2026-09-28T10:00:00'),
            row('t1', 'w3', '2026-10-04', '2026-10-04T10:00:00'),
            row('t1', 'w4', '2026-10-05', '2026-10-05T10:00:00'),
        ])

        expect(countSessionsBetween(sessions, day('2026-09-28'), day('2026-10-05'))).toBe(2)
    })
})
```

`tests/unit/trainer-dashboard/trainees.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { activeTraineeIds, fullName, getTrainerTrainees, initials } from '@/lib/trainer-dashboard/trainees'
import { prismaMock } from '../../helpers/prisma-mock'
import { TRAINEES } from './fixtures'

describe('getTrainerTrainees', () => {
    it("loads the trainer's trainees with their active flag in one query", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: TRAINEES[0] },
            { trainee: TRAINEES[2] },
        ] as never)

        const result = await getTrainerTrainees('trainer-1')

        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1' },
            select: { trainee: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
        })
        expect(result).toEqual([TRAINEES[0], TRAINEES[2]])
    })
})

describe('trainee helpers', () => {
    it('activeTraineeIds drops deactivated trainees', () => {
        expect(activeTraineeIds(TRAINEES)).toEqual(['t1', 't2'])
    })

    it('fullName and initials', () => {
        expect(fullName(TRAINEES[0])).toBe('Anna Rossi')
        expect(initials(TRAINEES[0])).toBe('AR')
        expect(initials({ firstName: 'élodie', lastName: '' })).toBe('É')
    })
})
```

`tests/unit/trainer-dashboard/load-widget.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { logger } from '@/lib/logger'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'

describe('loadWidget', () => {
    it('wraps the loaded data', async () => {
        await expect(loadWidget('todo-today', async () => [1, 2])).resolves.toEqual({ ok: true, data: [1, 2] })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('logs and reports failure instead of throwing', async () => {
        const error = new Error('db down')

        await expect(loadWidget('todo-today', async () => { throw error })).resolves.toEqual({ ok: false })
        expect(logger.error).toHaveBeenCalledWith({ error, widget: 'todo-today' }, 'Trainer dashboard widget failed to load')
    })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard`
Expected: FAIL — `Failed to resolve import "@/lib/trainer-dashboard/dates"` (and the other modules).

- [ ] **Step 4: Implement the modules**

`src/lib/trainer-dashboard/constants.ts`:

```ts
/** Trainer home thresholds. Fixed by design: no per-trainer settings. */
export const INACTIVITY_DAYS = 7
export const PROGRAM_ENDING_DAYS = 7
export const HIGH_RPE_THRESHOLD = 9
export const RECENT_WINDOW_DAYS = 7
export const TREND_WEEKS = 8
export const CONSISTENCY_WEEKS = 4

export const LIST_LIMITS = {
    inactive: 6,
    feedback: 10,
    feed: 15,
    records: 6,
    ranking: 5,
} as const
```

`src/lib/trainer-dashboard/dates.ts`:

```ts
import { RECENT_WINDOW_DAYS } from './constants'

/**
 * Every dashboard date is a UTC calendar day, matching ExerciseFeedback.date
 * (written as getTodayDateKey(), midnight UTC). Weeks are ISO weeks, Monday first.
 */
export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS)
}

export function startOfUtcWeek(date: Date): Date {
    const dayStart = startOfUtcDay(date)
    const daysSinceMonday = (dayStart.getUTCDay() + 6) % 7
    return addDays(dayStart, -daysSinceMonday)
}

export function utcDayKey(date: Date): string {
    return startOfUtcDay(date).toISOString().slice(0, 10)
}

export function wholeDaysBetween(from: Date, to: Date): number {
    return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS)
}

export function programEndDate(startDate: Date, durationWeeks: number): Date {
    return addDays(startOfUtcDay(startDate), durationWeeks * 7)
}

/** First day of the "last 7 days" window shared by every recent-activity widget. */
export function recentWindowStart(now: Date): Date {
    return addDays(startOfUtcDay(now), -RECENT_WINDOW_DAYS)
}
```

`src/lib/trainer-dashboard/trainees.ts`:

```ts
import { prisma } from '@/lib/prisma'

export interface DashboardTrainee {
    id: string
    firstName: string
    lastName: string
    isActive: boolean
}

/** One query per request: the page shell passes the result to every widget. */
export async function getTrainerTrainees(trainerId: string): Promise<DashboardTrainee[]> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId },
        select: { trainee: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
    })
    return links.map((link) => link.trainee)
}

export function activeTraineeIds(trainees: DashboardTrainee[]): string[] {
    return trainees.filter((trainee) => trainee.isActive).map((trainee) => trainee.id)
}

export function fullName(person: { firstName: string; lastName: string }): string {
    return `${person.firstName} ${person.lastName}`.trim()
}

export function initials(person: { firstName: string; lastName: string }): string {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()
}
```

`src/lib/trainer-dashboard/sessions.ts`:

```ts
import { utcDayKey } from './dates'

/**
 * A session is one (trainee, workout, calendar day) in ExerciseFeedback.
 * WorkoutExercise.isCompleted has no timestamp, so feedback is the reliable
 * record of when training happened: `date` gives the day, `createdAt` the time.
 */
export const SESSION_FEEDBACK_SELECT = {
    traineeId: true,
    date: true,
    createdAt: true,
    workoutExercise: { select: { workoutId: true } },
} as const

export interface SessionSourceRow {
    traineeId: string
    date: Date
    createdAt: Date
    workoutExercise: { workoutId: string }
}

export interface TrainingSession {
    key: string
    traineeId: string
    workoutId: string
    /** YYYY-MM-DD, from ExerciseFeedback.date */
    day: string
    lastLoggedAt: Date
    exerciseCount: number
}

export function groupSessions(rows: SessionSourceRow[]): TrainingSession[] {
    const sessions = new Map<string, TrainingSession>()

    for (const row of rows) {
        const day = utcDayKey(row.date)
        const workoutId = row.workoutExercise.workoutId
        const key = `${row.traineeId}|${workoutId}|${day}`
        const existing = sessions.get(key)

        if (existing) {
            existing.exerciseCount += 1
            if (row.createdAt > existing.lastLoggedAt) existing.lastLoggedAt = row.createdAt
        } else {
            sessions.set(key, {
                key,
                traineeId: row.traineeId,
                workoutId,
                day,
                lastLoggedAt: row.createdAt,
                exerciseCount: 1,
            })
        }
    }

    return [...sessions.values()].sort((left, right) => right.lastLoggedAt.getTime() - left.lastLoggedAt.getTime())
}

export function countSessionsBetween(sessions: TrainingSession[], from: Date, to: Date): number {
    const fromKey = utcDayKey(from)
    const toKey = utcDayKey(to)
    return sessions.filter((session) => session.day >= fromKey && session.day < toKey).length
}
```

`src/lib/trainer-dashboard/load-widget.ts`:

```ts
import { logger } from '@/lib/logger'

export type WidgetResult<T> = { ok: true; data: T } | { ok: false }

/** Keeps one failing widget from taking down the whole home page. */
export async function loadWidget<T>(widget: string, load: () => Promise<T>): Promise<WidgetResult<T>> {
    try {
        return { ok: true, data: await load() }
    } catch (error) {
        logger.error({ error, widget }, 'Trainer dashboard widget failed to load')
        return { ok: false }
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard`
Expected: PASS (4 files).

- [ ] **Step 6: Commit**

```bash
git add src/lib/trainer-dashboard/constants.ts src/lib/trainer-dashboard/dates.ts src/lib/trainer-dashboard/trainees.ts src/lib/trainer-dashboard/sessions.ts src/lib/trainer-dashboard/load-widget.ts tests/unit/trainer-dashboard/fixtures.ts tests/unit/trainer-dashboard/dates.test.ts tests/unit/trainer-dashboard/sessions.test.ts tests/unit/trainer-dashboard/trainees.test.ts tests/unit/trainer-dashboard/load-widget.test.ts
git commit -m "feat(trainer-home): add dashboard date, session and trainee helpers"
```

---

### Task 2: Dashboard i18n — translator, formatting, locale keys

**Files:**
- Create: `src/lib/trainer-dashboard/i18n.ts`
- Modify: `public/locales/it/trainer.json` (replace the `trainerDashboard` block)
- Modify: `public/locales/en/trainer.json` (replace the `trainerDashboard` block)
- Test: `tests/unit/trainer-dashboard/i18n.test.ts`

**Interfaces:**
- Consumes: `startOfUtcDay`, `wholeDaysBetween` from `dates.ts`.
- Produces:
  - `type DashboardLocale = 'it' | 'en'`
  - `type TranslationParams = Record<string, string | number>`
  - `type Translate = (key: string, params?: TranslationParams) => string` — keys are full paths in `trainer.json`, e.g. `'trainerDashboard.todo.title'`; when `params.count` is `0` or `1` and a `<key>_zero` / `<key>_one` sibling exists, that sibling is used
  - `resolveDashboardLocale(cookieLocale?: string): DashboardLocale`
  - `createTranslator(locale: DashboardLocale): Translate`
  - `formatRelative(date: Date, now: Date, t: Translate): string`
  - `formatDayLabel(dayKey: string, now: Date, locale: DashboardLocale, t: Translate): string`
  - `formatShortDay(date: Date, locale: DashboardLocale): string` (`dd/MM`, UTC)
  - `formatLongDate(now: Date, locale: DashboardLocale): string` (Europe/Rome)
  - `greetingKey(now: Date): string` (Europe/Rome hour: < 12 morning, < 18 afternoon, else evening)

- [ ] **Step 1: Replace the `trainerDashboard` locale block**

The old keys are used only by the page being rewritten (`grep -rn "trainerDashboard\." src` shows only `src/app/trainer/dashboard/page.tsx`). The files are LF with a UTF-8 BOM and 4-space indentation: this script keeps all three properties and the block's position in the object.

```bash
node <<'EOF'
const fs = require('fs')

const blocks = {
  it: {
    header: {
      greetingMorning: 'Buongiorno, {{firstName}}',
      greetingAfternoon: 'Buon pomeriggio, {{firstName}}',
      greetingEvening: 'Buonasera, {{firstName}}',
      newProgram: 'Nuovo programma',
      newTrainee: 'Nuovo atleta',
      kpiActiveTrainees: 'Atleti attivi (7 gg)',
      kpiActivePrograms: 'Programmi attivi',
      kpiSessionsWeek: 'Sessioni questa settimana',
      kpiSessionsDelta: '{{delta}} rispetto alla settimana scorsa',
      kpiUnavailable: 'Indicatori non disponibili al momento.',
    },
    widget: {
      loadError: 'Impossibile caricare questa sezione. Ricarica la pagina per riprovare.',
      moreItems: '+{{count}} altri',
    },
    todo: {
      title: 'Da fare oggi',
      empty: 'Tutto in ordine: nessuna azione richiesta.',
      subscriptionExpired: 'Abbonamento scaduto da {{count}} giorni',
      subscriptionExpired_one: 'Abbonamento scaduto da 1 giorno',
      subscriptionExpiring: 'Abbonamento in scadenza tra {{count}} giorni',
      subscriptionExpiring_one: 'Abbonamento in scadenza domani',
      subscriptionExpiring_zero: 'Abbonamento in scadenza oggi',
      testsToReview: 'Test completati da revisionare · Settimana {{week}}',
      programEnding: '{{program}} termina tra {{count}} giorni, nessun programma successivo',
      programEnding_one: '{{program}} termina domani, nessun programma successivo',
      programEnding_zero: '{{program}} è terminato, nessun programma successivo',
      testWeekInProgress: 'Settimana di test in corso · Settimana {{week}}',
      testsProgress: 'Test completati',
    },
    inactive: {
      title: 'Atleti inattivi',
      subtitle: 'Con un programma attivo, nessun allenamento negli ultimi 7 giorni',
      lastSession: 'Ultimo allenamento {{count}} giorni fa',
      lastSession_one: 'Ultimo allenamento ieri',
      never: 'Nessun allenamento registrato',
      empty: 'Tutti gli atleti con un programma attivo si sono allenati di recente.',
      viewAll: 'Vedi tutti gli atleti',
    },
    feedback: {
      title: 'Feedback recenti',
      subtitle: 'Note degli atleti e RPE alto, ultimi 7 giorni',
      rpe: 'RPE {{value}}',
      empty: 'Nessuna nota o RPE alto negli ultimi 7 giorni.',
    },
    feed: {
      title: 'Attività recente',
      entry: 'ha completato Giorno {{day}} · Settimana {{week}}',
      exercises: '{{count}} esercizi',
      exercises_one: '1 esercizio',
      record: 'Nuovo record',
      empty: 'Nessun allenamento registrato negli ultimi 7 giorni.',
    },
    records: {
      title: 'Nuovi record',
      subtitle: 'Ultimi 7 giorni',
      value: '{{weight}} kg × {{reps}}',
      delta: '+{{delta}} kg',
      first: 'Primo record',
      empty: 'Nessun nuovo record questa settimana. La prossima è quella buona.',
    },
    trend: {
      title: 'Andamento ultime 8 settimane',
      sessions: 'Sessioni',
      volume: 'Volume (kg)',
      summary: '{{count}} sessioni questa settimana',
      summary_one: '1 sessione questa settimana',
      delta: '{{delta}} rispetto alla settimana scorsa',
    },
    consistency: {
      title: 'Classifica costanza',
      subtitle: 'Aderenza al programma, ultime 4 settimane',
      sessions: '{{done}} / {{expected}} sessioni',
      empty: 'Nessun atleta con un programma attivo.',
    },
    time: {
      justNow: 'poco fa',
      minutesAgo: '{{count}} min fa',
      hoursAgo: '{{count}} ore fa',
      hoursAgo_one: '1 ora fa',
      daysAgo: '{{count}} giorni fa',
      daysAgo_one: 'ieri',
      today: 'Oggi',
      yesterday: 'Ieri',
    },
  },
  en: {
    header: {
      greetingMorning: 'Good morning, {{firstName}}',
      greetingAfternoon: 'Good afternoon, {{firstName}}',
      greetingEvening: 'Good evening, {{firstName}}',
      newProgram: 'New program',
      newTrainee: 'New athlete',
      kpiActiveTrainees: 'Active athletes (7 days)',
      kpiActivePrograms: 'Active programs',
      kpiSessionsWeek: 'Sessions this week',
      kpiSessionsDelta: '{{delta}} vs last week',
      kpiUnavailable: 'Indicators are not available right now.',
    },
    widget: {
      loadError: 'This section could not be loaded. Reload the page to try again.',
      moreItems: '+{{count}} more',
    },
    todo: {
      title: 'To do today',
      empty: 'All clear: nothing needs your attention.',
      subscriptionExpired: 'Subscription expired {{count}} days ago',
      subscriptionExpired_one: 'Subscription expired 1 day ago',
      subscriptionExpiring: 'Subscription expires in {{count}} days',
      subscriptionExpiring_one: 'Subscription expires tomorrow',
      subscriptionExpiring_zero: 'Subscription expires today',
      testsToReview: 'Tests completed, ready for review · Week {{week}}',
      programEnding: '{{program}} ends in {{count}} days, no follow-up program',
      programEnding_one: '{{program}} ends tomorrow, no follow-up program',
      programEnding_zero: '{{program}} has ended, no follow-up program',
      testWeekInProgress: 'Test week in progress · Week {{week}}',
      testsProgress: 'Tests completed',
    },
    inactive: {
      title: 'Inactive athletes',
      subtitle: 'Active program, no training in the last 7 days',
      lastSession: 'Last session {{count}} days ago',
      lastSession_one: 'Last session yesterday',
      never: 'No sessions logged yet',
      empty: 'Every athlete with an active program has trained recently.',
      viewAll: 'See all athletes',
    },
    feedback: {
      title: 'Recent feedback',
      subtitle: 'Athlete notes and high RPE, last 7 days',
      rpe: 'RPE {{value}}',
      empty: 'No notes or high RPE in the last 7 days.',
    },
    feed: {
      title: 'Recent activity',
      entry: 'completed Day {{day}} · Week {{week}}',
      exercises: '{{count}} exercises',
      exercises_one: '1 exercise',
      record: 'New record',
      empty: 'No sessions logged in the last 7 days.',
    },
    records: {
      title: 'New records',
      subtitle: 'Last 7 days',
      value: '{{weight}} kg × {{reps}}',
      delta: '+{{delta}} kg',
      first: 'First record',
      empty: 'No new records this week. Next week is the one.',
    },
    trend: {
      title: 'Last 8 weeks',
      sessions: 'Sessions',
      volume: 'Volume (kg)',
      summary: '{{count}} sessions this week',
      summary_one: '1 session this week',
      delta: '{{delta}} vs last week',
    },
    consistency: {
      title: 'Consistency ranking',
      subtitle: 'Program adherence, last 4 weeks',
      sessions: '{{done}} / {{expected}} sessions',
      empty: 'No athletes with an active program.',
    },
    time: {
      justNow: 'just now',
      minutesAgo: '{{count}} min ago',
      hoursAgo: '{{count}} hours ago',
      hoursAgo_one: '1 hour ago',
      daysAgo: '{{count}} days ago',
      daysAgo_one: 'yesterday',
      today: 'Today',
      yesterday: 'Yesterday',
    },
  },
}

for (const locale of ['it', 'en']) {
  const file = `public/locales/${locale}/trainer.json`
  const raw = fs.readFileSync(file, 'utf8')
  const hasBom = raw.charCodeAt(0) === 0xfeff
  const data = JSON.parse(hasBom ? raw.slice(1) : raw)
  if (!('trainerDashboard' in data)) throw new Error(`${file}: trainerDashboard block missing`)
  data.trainerDashboard = blocks[locale]
  fs.writeFileSync(file, (hasBom ? '﻿' : '') + JSON.stringify(data, null, 4) + '\n', 'utf8')
}
EOF
```

Then check that only the `trainerDashboard` block changed:

Run: `git diff --stat public/locales && git diff public/locales/it/trainer.json | grep '^[-+]' | grep -v trainerDashboard | head -5`
Expected: both files changed; the visible changed lines are inside `trainerDashboard`. If the whole file shows as changed (final newline or indentation mismatch), open the original with `git show HEAD:public/locales/it/trainer.json | tail -c 20 | od -c` and fix the trailing newline in the script before continuing.

- [ ] **Step 2: Write the failing test**

`tests/unit/trainer-dashboard/i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    createTranslator,
    formatDayLabel,
    formatLongDate,
    formatRelative,
    formatShortDay,
    greetingKey,
    resolveDashboardLocale,
} from '@/lib/trainer-dashboard/i18n'
import { NOW, at, day } from './fixtures'

const t = createTranslator('it')

describe('resolveDashboardLocale', () => {
    it('defaults to Italian and recognises English variants', () => {
        expect(resolveDashboardLocale(undefined)).toBe('it')
        expect(resolveDashboardLocale('it-IT')).toBe('it')
        expect(resolveDashboardLocale('EN-us')).toBe('en')
    })
})

describe('createTranslator', () => {
    it('interpolates parameters', () => {
        expect(t('trainerDashboard.header.greetingMorning', { firstName: 'Edo' })).toBe('Buongiorno, Edo')
    })

    it('picks _one and _zero variants from count when they exist', () => {
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 5 })).toBe('Abbonamento in scadenza tra 5 giorni')
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 1 })).toBe('Abbonamento in scadenza domani')
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 0 })).toBe('Abbonamento in scadenza oggi')
        // no _zero variant: falls back to the base key
        expect(t('trainerDashboard.inactive.lastSession', { count: 0 })).toBe('Ultimo allenamento 0 giorni fa')
    })

    it('returns the key itself when it does not exist', () => {
        expect(t('trainerDashboard.nope')).toBe('trainerDashboard.nope')
    })

    it('translates English', () => {
        expect(createTranslator('en')('trainerDashboard.todo.title')).toBe('To do today')
    })
})

describe('formatRelative', () => {
    it('covers minutes, hours and days', () => {
        expect(formatRelative(at('2026-10-03T09:59:30'), NOW, t)).toBe('poco fa')
        expect(formatRelative(at('2026-10-03T09:35:00'), NOW, t)).toBe('25 min fa')
        expect(formatRelative(at('2026-10-03T09:00:00'), NOW, t)).toBe('1 ora fa')
        expect(formatRelative(at('2026-10-03T03:00:00'), NOW, t)).toBe('7 ore fa')
        expect(formatRelative(at('2026-10-02T03:00:00'), NOW, t)).toBe('ieri')
        expect(formatRelative(at('2026-09-29T08:00:00'), NOW, t)).toBe('4 giorni fa')
    })

    it('treats future instants (clock skew) as just now', () => {
        expect(formatRelative(at('2026-10-03T10:05:00'), NOW, t)).toBe('poco fa')
    })
})

describe('day formatting', () => {
    it('labels today and yesterday, otherwise weekday + dd/MM', () => {
        expect(formatDayLabel('2026-10-03', NOW, 'it', t)).toBe('Oggi')
        expect(formatDayLabel('2026-10-02', NOW, 'it', t)).toBe('Ieri')
        expect(formatDayLabel('2026-09-29', NOW, 'it', t)).toMatch(/mar.*29\/09/i)
    })

    it('formatShortDay prints dd/MM in UTC', () => {
        expect(formatShortDay(day('2026-09-28'), 'it')).toBe('28/09')
    })

    it('formatLongDate uses the Rome calendar day', () => {
        expect(formatLongDate(NOW, 'it')).toMatch(/3 ottobre 2026/i)
        expect(formatLongDate(at('2026-10-03T22:30:00'), 'it')).toMatch(/4 ottobre 2026/i)
    })
})

describe('greetingKey', () => {
    it('follows the hour in Rome (UTC+2 in October)', () => {
        expect(greetingKey(at('2026-10-03T06:00:00'))).toBe('trainerDashboard.header.greetingMorning')
        expect(greetingKey(at('2026-10-03T10:00:00'))).toBe('trainerDashboard.header.greetingAfternoon')
        expect(greetingKey(at('2026-10-03T17:00:00'))).toBe('trainerDashboard.header.greetingEvening')
    })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/i18n.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/trainer-dashboard/i18n"`.

- [ ] **Step 4: Implement `i18n.ts`**

The resolution and interpolation logic comes from the current `page.tsx` (`resolveLocale`, `resolveTranslation`, `translate`), moved here and extended with plural variants.

`src/lib/trainer-dashboard/i18n.ts`:

```ts
import trainerIt from '../../../public/locales/it/trainer.json'
import trainerEn from '../../../public/locales/en/trainer.json'
import { startOfUtcDay, wholeDaysBetween } from './dates'

/**
 * Server-side translation for the trainer home. The page is a server component,
 * so it cannot use react-i18next; it reads the same trainer.json files directly.
 */
export type DashboardLocale = 'it' | 'en'
export type TranslationParams = Record<string, string | number>
export type Translate = (key: string, params?: TranslationParams) => string

const DICTIONARIES: Record<DashboardLocale, Record<string, unknown>> = {
    it: trainerIt as Record<string, unknown>,
    en: trainerEn as Record<string, unknown>,
}

const INTL_LOCALES: Record<DashboardLocale, string> = { it: 'it-IT', en: 'en-GB' }

/** Calendar the trainers live in: used for the greeting and today's date. */
const TRAINER_TIME_ZONE = 'Europe/Rome'

export function resolveDashboardLocale(cookieLocale?: string): DashboardLocale {
    if (!cookieLocale) return 'it'
    return cookieLocale.toLowerCase().startsWith('en') ? 'en' : 'it'
}

function lookup(dictionary: Record<string, unknown>, key: string): string | null {
    const value = key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && part in current) {
            return (current as Record<string, unknown>)[part]
        }
        return null
    }, dictionary)
    return typeof value === 'string' ? value : null
}

export function createTranslator(locale: DashboardLocale): Translate {
    const dictionary = DICTIONARIES[locale]

    return (key, params) => {
        const count = params?.count
        const pluralKey = count === 0 ? `${key}_zero` : count === 1 ? `${key}_one` : null
        const template = (pluralKey && lookup(dictionary, pluralKey)) || lookup(dictionary, key)

        if (!template) return key
        if (!params) return template

        return Object.entries(params).reduce(
            (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
            template,
        )
    }
}

export function formatRelative(date: Date, now: Date, t: Translate): string {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
    if (minutes < 1) return t('trainerDashboard.time.justNow')
    if (minutes < 60) return t('trainerDashboard.time.minutesAgo', { count: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('trainerDashboard.time.hoursAgo', { count: hours })

    return t('trainerDashboard.time.daysAgo', { count: Math.floor(hours / 24) })
}

export function formatShortDay(date: Date, locale: DashboardLocale): string {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date)
}

export function formatDayLabel(dayKey: string, now: Date, locale: DashboardLocale, t: Translate): string {
    const date = new Date(`${dayKey}T00:00:00.000Z`)
    const daysAgo = wholeDaysBetween(date, startOfUtcDay(now))
    if (daysAgo === 0) return t('trainerDashboard.time.today')
    if (daysAgo === 1) return t('trainerDashboard.time.yesterday')

    const weekday = new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'short', timeZone: 'UTC' }).format(date)
    return `${weekday} ${formatShortDay(date, locale)}`
}

export function formatLongDate(now: Date, locale: DashboardLocale): string {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TRAINER_TIME_ZONE,
    }).format(now)
}

export function greetingKey(now: Date): string {
    const hour = Number(
        new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TRAINER_TIME_ZONE }).format(now),
    )
    if (hour < 12) return 'trainerDashboard.header.greetingMorning'
    if (hour < 18) return 'trainerDashboard.header.greetingAfternoon'
    return 'trainerDashboard.header.greetingEvening'
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/i18n.test.ts`
Expected: PASS. If `formatDayLabel` for 29/09 fails, print the actual value (`console.log`) and loosen only the weekday part of the regex: Node's ICU prints `mar 29/09` for it-IT.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trainer-dashboard/i18n.ts tests/unit/trainer-dashboard/i18n.test.ts public/locales/it/trainer.json public/locales/en/trainer.json
git commit -m "feat(trainer-home): add dashboard translator and new locale keys"
```

The old `page.tsx` still references the removed keys and will show raw keys until Task 7 replaces it. That is acceptable on this local branch; nothing is pushed before Task 7.

---

### Task 3: Widget primitives and the header

**Files:**
- Create: `src/app/trainer/dashboard/_widgets/types.ts`
- Create: `src/app/trainer/dashboard/_widgets/WidgetCard.tsx`
- Create: `src/lib/trainer-dashboard/header-kpis.ts`
- Create: `src/app/trainer/dashboard/_widgets/HeaderKpis.tsx`
- Create: `src/app/trainer/dashboard/_widgets/DashboardHeader.tsx`
- Test: `tests/unit/trainer-dashboard/header-kpis.test.ts`
- Test: `tests/unit/trainer-dashboard/widgets-phase1.test.tsx` (created here, extended in Tasks 4–6)

**Interfaces:**
- Consumes: Task 1 (`DashboardTrainee`, `activeTraineeIds`, `addDays`, `startOfUtcWeek`, `SESSION_FEEDBACK_SELECT`, `groupSessions`, `countSessionsBetween`, `loadWidget`), Task 2 (`Translate`, `DashboardLocale`, `createTranslator`, `formatLongDate`, `greetingKey`).
- Produces:
  - `types.ts`: `interface WidgetContext { trainerId: string; trainees: DashboardTrainee[]; now: Date; locale: DashboardLocale; t: Translate }`
  - `WidgetCard.tsx`: `WidgetCard({ title, subtitle?, icon, action?, children })` (renders `role="region"` with `aria-label={title}`), `WidgetEmpty({ icon, message })`, `WidgetError({ title, icon, t })`, `WidgetSkeleton()`, `Avatar({ label })`
  - `header-kpis.ts`: `interface HeaderKpis { activeTrainees: number; totalTrainees: number; activePrograms: number; sessionsThisWeek: number; sessionsLastWeek: number }`, `getHeaderKpis(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<HeaderKpis>`
  - `HeaderKpis.tsx`: default async `HeaderKpis({ ctx })`
  - `DashboardHeader.tsx`: default `DashboardHeader({ ctx, firstName })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/header-kpis.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const feedback = (traineeId: string, workoutId: string, date: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
})

describe('getHeaderKpis', () => {
    it('counts active trainees, active programs and sessions this week vs last week', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(3)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            // last week (21–27 Sep), t2 only; 27 Sep is inside the 7-day window
            feedback('t2', 'w1', '2026-09-22'),
            feedback('t2', 'w2', '2026-09-27'),
            // this week (from 28 Sep): two exercises of one session + another session
            feedback('t1', 'w3', '2026-09-30'),
            feedback('t1', 'w3', '2026-09-30'),
            feedback('t1', 'w4', '2026-10-02'),
        ] as never)

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(prismaMock.trainingProgram.count).toHaveBeenCalledWith({ where: { trainerId: 'trainer-1', status: 'active' } })
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-09-21') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
            },
        })
        expect(kpis).toEqual({
            activeTrainees: 2,
            totalTrainees: 2,
            activePrograms: 3,
            sessionsThisWeek: 2,
            sessionsLastWeek: 2,
        })
    })

    it('does not count a trainee whose last session is older than the 7-day window as active', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(1)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([feedback('t1', 'w1', '2026-09-25')] as never)

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(kpis.activeTrainees).toBe(0)
        expect(kpis.sessionsLastWeek).toBe(1)
    })

    it('skips the feedback query when the trainer has no active trainees', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(0)

        const kpis = await getHeaderKpis('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)

        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
        expect(kpis).toEqual({ activeTrainees: 0, totalTrainees: 0, activePrograms: 0, sessionsThisWeek: 0, sessionsLastWeek: 0 })
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/header-kpis.test.ts`
Expected: FAIL — cannot resolve `@/lib/trainer-dashboard/header-kpis`.

- [ ] **Step 3: Implement `header-kpis.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { addDays, recentWindowStart, startOfUtcWeek } from './dates'
import { SESSION_FEEDBACK_SELECT, countSessionsBetween, groupSessions } from './sessions'
import { activeTraineeIds, type DashboardTrainee } from './trainees'

export interface HeaderKpis {
    activeTrainees: number
    totalTrainees: number
    activePrograms: number
    sessionsThisWeek: number
    sessionsLastWeek: number
}

export async function getHeaderKpis(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<HeaderKpis> {
    const traineeIds = activeTraineeIds(trainees)
    const weekStart = startOfUtcWeek(now)
    const lastWeekStart = addDays(weekStart, -7)
    const activeSince = recentWindowStart(now)

    // lastWeekStart is always on or before activeSince, so one feedback query covers both KPIs
    const [activePrograms, rows] = await Promise.all([
        prisma.trainingProgram.count({ where: { trainerId, status: 'active' } }),
        traineeIds.length === 0
            ? Promise.resolve([])
            : prisma.exerciseFeedback.findMany({
                where: { traineeId: { in: traineeIds }, date: { gte: lastWeekStart } },
                select: SESSION_FEEDBACK_SELECT,
            }),
    ])

    const sessions = groupSessions(rows)
    const activeTrainees = new Set(rows.filter((row) => row.date >= activeSince).map((row) => row.traineeId)).size

    return {
        activeTrainees,
        totalTrainees: traineeIds.length,
        activePrograms,
        sessionsThisWeek: countSessionsBetween(sessions, weekStart, addDays(weekStart, 7)),
        sessionsLastWeek: countSessionsBetween(sessions, lastWeekStart, weekStart),
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/header-kpis.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing widget tests**

`tests/unit/trainer-dashboard/widgets-phase1.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/header-kpis', () => ({ getHeaderKpis: vi.fn() }))
// DashboardHeader wraps the async HeaderKpis in <Suspense>; React 18 in jsdom cannot render
// an async component, so the header test replaces it with a static stand-in.
vi.mock('@/app/trainer/dashboard/_widgets/HeaderKpis', () => ({
    default: () => <div data-testid="header-kpis" />,
}))

import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import DashboardHeader from '@/app/trainer/dashboard/_widgets/DashboardHeader'
import { NOW, TRAINEES } from './fixtures'

const { default: HeaderKpis } = await vi.importActual<typeof import('@/app/trainer/dashboard/_widgets/HeaderKpis')>(
    '@/app/trainer/dashboard/_widgets/HeaderKpis',
)

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
    return { trainerId: 'trainer-1', trainees: TRAINEES, now: NOW, locale: 'it', t: createTranslator('it'), ...overrides }
}

async function renderAsync(node: Promise<ReactNode>) {
    return render(<>{await node}</>)
}

describe('DashboardHeader', () => {
    it('greets the trainer, shows today and the quick actions', () => {
        render(<DashboardHeader ctx={makeCtx()} firstName="Edo" />)

        expect(screen.getByRole('heading', { level: 1, name: 'Buon pomeriggio, Edo' })).toBeInTheDocument()
        expect(screen.getByText(/3 ottobre 2026/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /nuovo programma/i })).toHaveAttribute('href', '/trainer/programs/new')
        expect(screen.getByRole('link', { name: /nuovo atleta/i })).toHaveAttribute('href', '/trainer/trainees/new')
        expect(screen.getByTestId('header-kpis')).toBeInTheDocument()
    })
})

describe('HeaderKpis', () => {
    it('renders the three KPIs with a positive week delta', async () => {
        vi.mocked(getHeaderKpis).mockResolvedValue({
            activeTrainees: 4,
            totalTrainees: 6,
            activePrograms: 5,
            sessionsThisWeek: 9,
            sessionsLastWeek: 7,
        })

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(getHeaderKpis).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(screen.getByText('Atleti attivi (7 gg)').closest('div')).toHaveTextContent('4 / 6')
        expect(screen.getByText('Programmi attivi').closest('div')).toHaveTextContent('5')
        expect(screen.getByText('+2 rispetto alla settimana scorsa')).toBeInTheDocument()
    })

    it('shows a negative delta without a plus sign', async () => {
        vi.mocked(getHeaderKpis).mockResolvedValue({
            activeTrainees: 1, totalTrainees: 1, activePrograms: 1, sessionsThisWeek: 1, sessionsLastWeek: 4,
        })

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(screen.getByText('-3 rispetto alla settimana scorsa')).toBeInTheDocument()
    })

    it('degrades to a notice when the KPIs fail to load', async () => {
        vi.mocked(getHeaderKpis).mockRejectedValue(new Error('db down'))

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(screen.getByRole('alert')).toHaveTextContent('Indicatori non disponibili al momento.')
    })
})

export { makeCtx, renderAsync, within }
```

> The `export` line lets Tasks 4–6 append their `describe` blocks to this same file and reuse `makeCtx` / `renderAsync`. Vitest ignores exports from test files.

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: FAIL — cannot resolve `@/app/trainer/dashboard/_widgets/DashboardHeader`.

- [ ] **Step 7: Implement the widget primitives, `HeaderKpis` and `DashboardHeader`**

`src/app/trainer/dashboard/_widgets/types.ts`:

```ts
import type { DashboardLocale, Translate } from '@/lib/trainer-dashboard/i18n'
import type { DashboardTrainee } from '@/lib/trainer-dashboard/trainees'

/** Everything a widget needs, resolved once by the page shell. */
export interface WidgetContext {
    trainerId: string
    trainees: DashboardTrainee[]
    now: Date
    locale: DashboardLocale
    t: Translate
}
```

`src/app/trainer/dashboard/_widgets/WidgetCard.tsx`:

```tsx
import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Card } from '@/components/Card'
import { SkeletonText } from '@/components/Skeleton'
import type { Translate } from '@/lib/trainer-dashboard/i18n'

interface WidgetCardProps {
    title: string
    subtitle?: string
    icon: ReactNode
    action?: ReactNode
    children: ReactNode
}

export function WidgetCard({ title, subtitle, icon, action, children }: WidgetCardProps) {
    return (
        <Card role="region" aria-label={title} className="h-full">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <span className="text-brand-primary" aria-hidden="true">{icon}</span>
                        {title}
                    </h2>
                    {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </Card>
    )
}

export function WidgetEmpty({ icon, message }: { icon: ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
            <span className="text-gray-400" aria-hidden="true">{icon}</span>
            {message}
        </div>
    )
}

export function WidgetError({ title, icon, t }: { title: string; icon: ReactNode; t: Translate }) {
    return (
        <WidgetCard title={title} icon={icon}>
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('trainerDashboard.widget.loadError')}
            </div>
        </WidgetCard>
    )
}

export function WidgetSkeleton() {
    return (
        <Card className="h-full" aria-hidden="true">
            <SkeletonText lines={5} />
        </Card>
    )
}

export function Avatar({ label }: { label: string }) {
    return (
        <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-brand-primary"
            aria-hidden="true"
        >
            {label}
        </span>
    )
}
```

`src/app/trainer/dashboard/_widgets/HeaderKpis.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Activity, ClipboardList, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import type { WidgetContext } from './types'

function Kpi({ icon, label, value, footer }: { icon: ReactNode; label: string; value: ReactNode; footer?: ReactNode }) {
    return (
        <div className="rounded-lg bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <p className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-brand-primary" aria-hidden="true">{icon}</span>
                {label}
            </p>
            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
            {footer}
        </div>
    )
}

export default async function HeaderKpis({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const result = await loadWidget('header-kpis', () => getHeaderKpis(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) {
        return (
            <p role="alert" className="mt-6 text-sm text-gray-300">
                {t('trainerDashboard.header.kpiUnavailable')}
            </p>
        )
    }

    const kpis = result.data
    const delta = kpis.sessionsThisWeek - kpis.sessionsLastWeek
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
    const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'

    return (
        <div className="mt-6 grid grid-cols-3 gap-4">
            <Kpi
                icon={<Users className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActiveTrainees')}
                value={`${kpis.activeTrainees} / ${kpis.totalTrainees}`}
            />
            <Kpi
                icon={<ClipboardList className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActivePrograms')}
                value={kpis.activePrograms}
            />
            <Kpi
                icon={<Activity className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiSessionsWeek')}
                value={kpis.sessionsThisWeek}
                footer={
                    <p className={`mt-1 flex items-center gap-1 text-sm ${deltaColor}`}>
                        <DeltaIcon className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.kpiSessionsDelta', { delta: delta > 0 ? `+${delta}` : String(delta) })}
                    </p>
                }
            />
        </div>
    )
}
```

`src/app/trainer/dashboard/_widgets/DashboardHeader.tsx`:

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, UserPlus } from 'lucide-react'
import { formatLongDate, greetingKey } from '@/lib/trainer-dashboard/i18n'
import HeaderKpis from './HeaderKpis'
import type { WidgetContext } from './types'

function KpiSkeleton() {
    return (
        <div className="mt-6 grid grid-cols-3 gap-4" aria-hidden="true">
            {[0, 1, 2].map((index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-white/10" />
            ))}
        </div>
    )
}

export default function DashboardHeader({ ctx, firstName }: { ctx: WidgetContext; firstName: string }) {
    const { t } = ctx

    return (
        <header className="rounded-xl bg-gray-900 p-6 text-white shadow-md">
            <div className="flex items-start justify-between gap-6">
                <div>
                    <p className="text-sm first-letter:uppercase text-gray-400">{formatLongDate(ctx.now, ctx.locale)}</p>
                    <h1 className="mt-1 text-3xl font-bold">{t(greetingKey(ctx.now), { firstName })}</h1>
                </div>
                <div className="flex shrink-0 gap-3">
                    <Link
                        href="/trainer/programs/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-semibold text-gray-900 transition-colors hover:bg-brand-primary-hover"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newProgram')}
                    </Link>
                    <Link
                        href="/trainer/trainees/new"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10"
                    >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newTrainee')}
                    </Link>
                </div>
            </div>
            <Suspense fallback={<KpiSkeleton />}>
                <HeaderKpis ctx={ctx} />
            </Suspense>
        </header>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/header-kpis.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: PASS. If the top-level `await vi.importActual` is rejected by the transformer, move it into a `beforeAll` that assigns a `let HeaderKpis` variable.

- [ ] **Step 9: Commit**

```bash
git add src/app/trainer/dashboard/_widgets/types.ts src/app/trainer/dashboard/_widgets/WidgetCard.tsx src/lib/trainer-dashboard/header-kpis.ts src/app/trainer/dashboard/_widgets/HeaderKpis.tsx src/app/trainer/dashboard/_widgets/DashboardHeader.tsx tests/unit/trainer-dashboard/header-kpis.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx
git commit -m "feat(trainer-home): add widget primitives and header with live KPIs"
```

---

### Task 4: "To do today"

**Files:**
- Create: `src/lib/trainer-dashboard/todo-today.ts`
- Create: `src/app/trainer/dashboard/_widgets/TodoTodayWidget.tsx`
- Test: `tests/unit/trainer-dashboard/todo-today.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase1.test.tsx`

**Interfaces:**
- Consumes: `getTrainerSubscriptionOverview(trainerId, today)` from `@/lib/subscription-queries` (returns `SubscriptionOverview`: `withSubscription[].subscription.{status, daysLeft}`, `daysLeft` negative when expired); Task 1 dates; `PROGRAM_ENDING_DAYS`; Task 3 widget primitives.
- Produces:
  - `type TodoItem` (discriminated on `kind`):
    - `{ kind: 'subscriptionExpired'; traineeId: string; traineeName: string; days: number }` (days since expiry, ≥ 1)
    - `{ kind: 'subscriptionExpiring'; traineeId: string; traineeName: string; days: number }` (days left, ≥ 0)
    - `{ kind: 'testsToReview'; programId: string; traineeName: string; weekNumber: number }`
    - `{ kind: 'programEnding'; programId: string; traineeId: string; traineeName: string; programTitle: string; days: number }` (≥ 0)
    - `{ kind: 'testWeekInProgress'; programId: string; traineeName: string; weekNumber: number; completed: number; planned: number }`
  - `getTodoItems(trainerId: string, now: Date): Promise<TodoItem[]>` — sorted by the order above, then by trainee name
  - default async `TodoTodayWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/todo-today.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/subscription-queries', () => ({ getTrainerSubscriptionOverview: vi.fn() }))

import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getTodoItems } from '@/lib/trainer-dashboard/todo-today'
import type { SubscriptionOverview } from '@/lib/subscriptions'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, at, day } from './fixtures'

const overview = (items: SubscriptionOverview['withSubscription']): SubscriptionOverview => ({
    withSubscription: items,
    withoutSubscription: [],
    counts: { none: 0, active: 0, expiring: 0, expired: 0 },
})

const subscribed = (traineeId: string, firstName: string, status: 'active' | 'expiring' | 'expired', daysLeft: number) => ({
    traineeId,
    firstName,
    lastName: 'X',
    subscription: { status, daysLeft, endDate: '2026-10-10T00:00:00.000Z' },
})

const testWeek = (id: string, programId: string, firstName: string, workouts: boolean[][]) => ({
    id,
    weekNumber: 4,
    program: { id: programId, trainee: { firstName, lastName: 'X' } },
    workouts: workouts.map((exercises) => ({ workoutExercises: exercises.map((isCompleted) => ({ isCompleted })) })),
})

const program = (
    id: string,
    traineeId: string,
    status: 'draft' | 'active',
    startDate: Date | null,
    durationWeeks: number,
) => ({ id, title: `Prog ${id}`, status, startDate, durationWeeks, traineeId, trainee: { firstName: traineeId.toUpperCase(), lastName: 'X' } })

function arrange({
    subscriptions = [],
    weeks = [],
    programs = [],
}: {
    subscriptions?: SubscriptionOverview['withSubscription']
    weeks?: ReturnType<typeof testWeek>[]
    programs?: ReturnType<typeof program>[]
}) {
    vi.mocked(getTrainerSubscriptionOverview).mockResolvedValue(overview(subscriptions))
    prismaMock.week.findMany.mockResolvedValue(weeks as never)
    prismaMock.trainingProgram.findMany.mockResolvedValue(programs as never)
}

describe('getTodoItems', () => {
    it('queries subscriptions for today, current test weeks and open programs', async () => {
        arrange({})

        await expect(getTodoItems('trainer-1', NOW)).resolves.toEqual([])

        expect(getTrainerSubscriptionOverview).toHaveBeenCalledWith('trainer-1', day('2026-10-03'))
        expect(prismaMock.week.findMany).toHaveBeenCalledWith({
            where: {
                weekType: 'test',
                startDate: { gte: day('2026-09-28'), lte: NOW },
                program: { trainerId: 'trainer-1', status: { in: ['active', 'completed'] } },
            },
            select: {
                id: true,
                weekNumber: true,
                program: { select: { id: true, trainee: { select: { firstName: true, lastName: true } } } },
                workouts: { select: { workoutExercises: { select: { isCompleted: true } } } },
            },
        })
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: { in: ['draft', 'active'] } },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                traineeId: true,
                trainee: { select: { firstName: true, lastName: true } },
            },
        })
    })

    it('turns expired and expiring subscriptions into items, ignoring active ones', async () => {
        arrange({
            subscriptions: [
                subscribed('t1', 'Zoe', 'expired', -3),
                subscribed('t2', 'Bea', 'expiring', 0),
                subscribed('t3', 'Ada', 'active', 40),
            ],
        })

        await expect(getTodoItems('trainer-1', NOW)).resolves.toEqual([
            { kind: 'subscriptionExpired', traineeId: 't1', traineeName: 'Zoe X', days: 3 },
            { kind: 'subscriptionExpiring', traineeId: 't2', traineeName: 'Bea X', days: 0 },
        ])
    })

    it('splits test weeks into "to review" (all planned tests done) and "in progress"', async () => {
        arrange({
            weeks: [
                testWeek('wk1', 'p1', 'Done', [[true, true], [true], []]),
                testWeek('wk2', 'p2', 'Half', [[true], [false, true]]),
                testWeek('wk3', 'p3', 'Empty', [[], []]),
            ],
        })

        await expect(getTodoItems('trainer-1', NOW)).resolves.toEqual([
            { kind: 'testsToReview', programId: 'p1', traineeName: 'Done X', weekNumber: 4 },
            { kind: 'testWeekInProgress', programId: 'p2', traineeName: 'Half X', weekNumber: 4, completed: 1, planned: 2 },
        ])
    })

    it('flags active programs ending within 7 days only when the trainee has no other open program', async () => {
        arrange({
            programs: [
                // ends 2026-10-06 (3 days), no successor → flagged
                program('p1', 't1', 'active', at('2026-09-08T09:00:00'), 4),
                // ended 2026-09-29, still active, no successor → flagged with 0 days
                program('p2', 't2', 'active', day('2026-09-01'), 4),
                // ends 2026-10-06 but a draft follows → not flagged
                program('p3', 't3', 'active', day('2026-09-08'), 4),
                program('p4', 't3', 'draft', null, 4),
                // ends 2026-10-27 → too far
                program('p5', 't5', 'active', day('2026-09-08'), 7),
                // no start date → ignored
                program('p6', 't6', 'active', null, 1),
            ],
        })

        await expect(getTodoItems('trainer-1', NOW)).resolves.toEqual([
            { kind: 'programEnding', programId: 'p1', traineeId: 't1', traineeName: 'T1 X', programTitle: 'Prog p1', days: 3 },
            { kind: 'programEnding', programId: 'p2', traineeId: 't2', traineeName: 'T2 X', programTitle: 'Prog p2', days: 0 },
        ])
    })

    it('orders by urgency, then by trainee name', async () => {
        arrange({
            subscriptions: [subscribed('t1', 'Zoe', 'expiring', 5), subscribed('t2', 'Ada', 'expiring', 9), subscribed('t3', 'Max', 'expired', -1)],
            weeks: [testWeek('wk1', 'p1', 'Bob', [[false]])],
        })

        const items = await getTodoItems('trainer-1', NOW)

        expect(items.map((item) => `${item.kind}:${item.traineeName}`)).toEqual([
            'subscriptionExpired:Max X',
            'subscriptionExpiring:Ada X',
            'subscriptionExpiring:Zoe X',
            'testWeekInProgress:Bob X',
        ])
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/todo-today.test.ts`
Expected: FAIL — cannot resolve `@/lib/trainer-dashboard/todo-today`.

- [ ] **Step 3: Implement `todo-today.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { PROGRAM_ENDING_DAYS } from './constants'
import { programEndDate, startOfUtcDay, startOfUtcWeek, wholeDaysBetween } from './dates'
import { fullName } from './trainees'

export type TodoItem =
    | { kind: 'subscriptionExpired'; traineeId: string; traineeName: string; days: number }
    | { kind: 'subscriptionExpiring'; traineeId: string; traineeName: string; days: number }
    | { kind: 'testsToReview'; programId: string; traineeName: string; weekNumber: number }
    | { kind: 'programEnding'; programId: string; traineeId: string; traineeName: string; programTitle: string; days: number }
    | { kind: 'testWeekInProgress'; programId: string; traineeName: string; weekNumber: number; completed: number; planned: number }

const PRIORITY: Record<TodoItem['kind'], number> = {
    subscriptionExpired: 0,
    subscriptionExpiring: 1,
    testsToReview: 2,
    programEnding: 3,
    testWeekInProgress: 4,
}

export async function getTodoItems(trainerId: string, now: Date): Promise<TodoItem[]> {
    const today = startOfUtcDay(now)

    const [overview, testWeeks, openPrograms] = await Promise.all([
        getTrainerSubscriptionOverview(trainerId, today),
        prisma.week.findMany({
            where: {
                weekType: 'test',
                startDate: { gte: startOfUtcWeek(now), lte: now },
                program: { trainerId, status: { in: ['active', 'completed'] } },
            },
            select: {
                id: true,
                weekNumber: true,
                program: { select: { id: true, trainee: { select: { firstName: true, lastName: true } } } },
                workouts: { select: { workoutExercises: { select: { isCompleted: true } } } },
            },
        }),
        prisma.trainingProgram.findMany({
            where: { trainerId, status: { in: ['draft', 'active'] } },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                traineeId: true,
                trainee: { select: { firstName: true, lastName: true } },
            },
        }),
    ])

    const items: TodoItem[] = []

    for (const entry of overview.withSubscription) {
        const traineeName = fullName(entry)
        if (entry.subscription.status === 'expired') {
            items.push({ kind: 'subscriptionExpired', traineeId: entry.traineeId, traineeName, days: -entry.subscription.daysLeft })
        } else if (entry.subscription.status === 'expiring') {
            items.push({ kind: 'subscriptionExpiring', traineeId: entry.traineeId, traineeName, days: entry.subscription.daysLeft })
        }
    }

    for (const week of testWeeks) {
        const plannedWorkouts = week.workouts.filter((workout) => workout.workoutExercises.length > 0)
        if (plannedWorkouts.length === 0) continue

        const completed = plannedWorkouts.filter((workout) =>
            workout.workoutExercises.every((exercise) => exercise.isCompleted),
        ).length
        const base = { programId: week.program.id, traineeName: fullName(week.program.trainee), weekNumber: week.weekNumber }

        items.push(
            completed === plannedWorkouts.length
                ? { kind: 'testsToReview', ...base }
                : { kind: 'testWeekInProgress', ...base, completed, planned: plannedWorkouts.length },
        )
    }

    for (const program of openPrograms) {
        if (program.status !== 'active' || !program.startDate) continue

        const daysLeft = wholeDaysBetween(today, programEndDate(program.startDate, program.durationWeeks))
        if (daysLeft > PROGRAM_ENDING_DAYS) continue

        const hasSuccessor = openPrograms.some((other) => other.traineeId === program.traineeId && other.id !== program.id)
        if (hasSuccessor) continue

        items.push({
            kind: 'programEnding',
            programId: program.id,
            traineeId: program.traineeId,
            traineeName: fullName(program.trainee),
            programTitle: program.title,
            days: Math.max(0, daysLeft),
        })
    }

    return items.sort(
        (left, right) => PRIORITY[left.kind] - PRIORITY[right.kind] || left.traineeName.localeCompare(right.traineeName),
    )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/todo-today.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

At the top of `tests/unit/trainer-dashboard/widgets-phase1.test.tsx`, add next to the other `vi.mock` calls:

```tsx
vi.mock('@/lib/trainer-dashboard/todo-today', () => ({ getTodoItems: vi.fn() }))
```

and next to the other imports:

```tsx
import { getTodoItems } from '@/lib/trainer-dashboard/todo-today'
import TodoTodayWidget from '@/app/trainer/dashboard/_widgets/TodoTodayWidget'
```

Append at the end of the file (before the `export` line):

```tsx
describe('TodoTodayWidget', () => {
    it('lists every item with its text and link, and shows the count', async () => {
        vi.mocked(getTodoItems).mockResolvedValue([
            { kind: 'subscriptionExpired', traineeId: 't1', traineeName: 'Anna Rossi', days: 2 },
            { kind: 'subscriptionExpiring', traineeId: 't2', traineeName: 'Luca Bianchi', days: 1 },
            { kind: 'testsToReview', programId: 'p1', traineeName: 'Anna Rossi', weekNumber: 4 },
            { kind: 'programEnding', programId: 'p2', traineeId: 't2', traineeName: 'Luca Bianchi', programTitle: 'Forza', days: 3 },
            { kind: 'testWeekInProgress', programId: 'p3', traineeName: 'Sara Verdi', weekNumber: 6, completed: 1, planned: 3 },
        ])

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Da fare oggi' })
        const links = within(region).getAllByRole('link')
        expect(getTodoItems).toHaveBeenCalledWith('trainer-1', NOW)
        expect(within(region).getByText('5')).toBeInTheDocument()
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/trainer/subscriptions',
            '/trainer/subscriptions',
            '/trainer/programs/p1/tests?backContext=dashboard',
            '/trainer/programs/new',
            '/trainer/programs/p3',
        ])
        expect(links[0]).toHaveTextContent('Abbonamento scaduto da 2 giorni')
        expect(links[1]).toHaveTextContent('Abbonamento in scadenza domani')
        expect(links[2]).toHaveTextContent('Test completati da revisionare · Settimana 4')
        expect(links[3]).toHaveTextContent('Forza termina tra 3 giorni, nessun programma successivo')
        expect(links[4]).toHaveTextContent('Settimana di test in corso · Settimana 6')
        expect(within(links[4]).getByText('Test completati')).toBeInTheDocument()
    })

    it('shows the all-clear state when there is nothing to do', async () => {
        vi.mocked(getTodoItems).mockResolvedValue([])

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Tutto in ordine: nessuna azione richiesta.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getTodoItems).mockRejectedValue(new Error('db down'))

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Da fare oggi' })).getByRole('alert')).toHaveTextContent(
            'Impossibile caricare questa sezione',
        )
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: FAIL — cannot resolve `TodoTodayWidget`.

- [ ] **Step 7: Implement `TodoTodayWidget.tsx`**

```tsx
import Link from 'next/link'
import {
    CalendarClock,
    CalendarX,
    ChevronRight,
    CircleCheck,
    Flame,
    FlaskConical,
    Hourglass,
    ListTodo,
    type LucideIcon,
} from 'lucide-react'
import ProgressBar from '@/components/ProgressBar'
import type { Translate } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getTodoItems, type TodoItem } from '@/lib/trainer-dashboard/todo-today'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

const ITEM_STYLE: Record<TodoItem['kind'], { icon: LucideIcon; className: string }> = {
    subscriptionExpired: { icon: CalendarX, className: 'bg-red-50 text-red-600' },
    subscriptionExpiring: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
    testsToReview: { icon: FlaskConical, className: 'bg-purple-50 text-purple-600' },
    programEnding: { icon: Hourglass, className: 'bg-blue-50 text-blue-600' },
    testWeekInProgress: { icon: Flame, className: 'bg-amber-50 text-amber-600' },
}

function describeItem(item: TodoItem, t: Translate): { key: string; href: string; text: string } {
    switch (item.kind) {
        case 'subscriptionExpired':
        case 'subscriptionExpiring':
            return {
                key: `${item.kind}-${item.traineeId}`,
                href: '/trainer/subscriptions',
                text: t(`trainerDashboard.todo.${item.kind}`, { count: item.days }),
            }
        case 'testsToReview':
            return {
                key: `${item.kind}-${item.programId}`,
                href: `/trainer/programs/${item.programId}/tests?backContext=dashboard`,
                text: t('trainerDashboard.todo.testsToReview', { week: item.weekNumber }),
            }
        case 'programEnding':
            return {
                key: `${item.kind}-${item.programId}`,
                href: '/trainer/programs/new',
                text: t('trainerDashboard.todo.programEnding', { program: item.programTitle, count: item.days }),
            }
        case 'testWeekInProgress':
            return {
                key: `${item.kind}-${item.programId}`,
                href: `/trainer/programs/${item.programId}`,
                text: t('trainerDashboard.todo.testWeekInProgress', { week: item.weekNumber }),
            }
    }
}

export default async function TodoTodayWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.todo.title')
    const icon = <ListTodo className="h-5 w-5" />
    const result = await loadWidget('todo-today', () => getTodoItems(ctx.trainerId, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard
            title={title}
            icon={icon}
            action={
                items.length > 0 && (
                    <span className="rounded-full bg-brand-primary/15 px-2.5 py-0.5 text-sm font-semibold text-gray-900">
                        {items.length}
                    </span>
                )
            }
        >
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.todo.empty')} />
            ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                    {items.map((item) => {
                        const { key, href, text } = describeItem(item, t)
                        const { icon: Icon, className } = ITEM_STYLE[item.kind]

                        return (
                            <li key={key}>
                                <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900">{item.traineeName}</p>
                                        <p className="text-sm text-gray-600">{text}</p>
                                        {item.kind === 'testWeekInProgress' && (
                                            <ProgressBar
                                                current={item.completed}
                                                total={item.planned}
                                                label={t('trainerDashboard.todo.testsProgress')}
                                                labelClassName="text-xs text-gray-500"
                                                size="sm"
                                                color="warning"
                                                className="mt-2 max-w-xs"
                                            />
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </WidgetCard>
    )
}
```

Check that `ListTodo` exists: `node -e "console.log('ListTodo' in require('lucide-react'))"` → `true`. If not, use `ClipboardCheck`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/todo-today.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/todo-today.ts src/app/trainer/dashboard/_widgets/TodoTodayWidget.tsx tests/unit/trainer-dashboard/todo-today.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx
git commit -m "feat(trainer-home): add 'to do today' widget"
```

---

### Task 5: Inactive trainees

**Files:**
- Create: `src/lib/trainer-dashboard/inactive-trainees.ts`
- Create: `src/app/trainer/dashboard/_widgets/InactiveTraineesWidget.tsx`
- Test: `tests/unit/trainer-dashboard/inactive-trainees.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase1.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`activeTraineeIds`, `fullName`, `initials`, `recentWindowStart`, `startOfUtcDay`, `wholeDaysBetween`, `LIST_LIMITS`), Task 3 primitives.
- Produces:
  - `interface InactiveTrainee { traineeId: string; traineeName: string; initials: string; daysSinceLastSession: number | null }` (`null` = never trained)
  - `interface InactiveTraineesResult { items: InactiveTrainee[]; total: number }`
  - `getInactiveTrainees(trainees: DashboardTrainee[], now: Date): Promise<InactiveTraineesResult>`
  - default async `InactiveTraineesWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/inactive-trainees.test.ts`:

```ts
import { describe, it, expect, type Mock } from 'vitest'
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, day, makeTrainee } from './fixtures'

const groupByMock = prismaMock.exerciseFeedback.groupBy as unknown as Mock

describe('getInactiveTrainees', () => {
    it('returns trainees with an active program and no feedback in the last 7 days, never-trained first', async () => {
        const trainees = [
            ...TRAINEES,
            makeTrainee('t4', 'Bruno', 'Neri'),
            makeTrainee('t5', 'Carla', 'Blu'),
        ]
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            { traineeId: 't1' }, { traineeId: 't2' }, { traineeId: 't4' }, { traineeId: 't5' },
        ] as never)
        groupByMock.mockResolvedValue([
            { traineeId: 't1', _max: { date: day('2026-09-30') } }, // trained 3 days ago → active
            { traineeId: 't2', _max: { date: day('2026-09-20') } }, // 13 days ago
            { traineeId: 't4', _max: { date: day('2026-09-25') } }, // 8 days ago
            // t5 never trained
        ] as never)

        const result = await getInactiveTrainees(trainees, NOW)

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2', 't4', 't5'] }, status: 'active' },
            select: { traineeId: true },
            distinct: ['traineeId'],
        })
        expect(groupByMock).toHaveBeenCalledWith({
            by: ['traineeId'],
            where: { traineeId: { in: ['t1', 't2', 't4', 't5'] } },
            _max: { date: true },
        })
        expect(result).toEqual({
            total: 3,
            items: [
                { traineeId: 't5', traineeName: 'Carla Blu', initials: 'CB', daysSinceLastSession: null },
                { traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB', daysSinceLastSession: 13 },
                { traineeId: 't4', traineeName: 'Bruno Neri', initials: 'BN', daysSinceLastSession: 8 },
            ],
        })
    })

    it('treats feedback exactly at the window start (7 days ago) as recent', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([{ traineeId: 't1' }] as never)
        groupByMock.mockResolvedValue([{ traineeId: 't1', _max: { date: day('2026-09-26') } }] as never)

        await expect(getInactiveTrainees(TRAINEES, NOW)).resolves.toEqual({ items: [], total: 0 })
    })

    it('caps the list at 6 but reports the full total', async () => {
        const many = Array.from({ length: 8 }, (_, index) => makeTrainee(`n${index}`, `Name${index}`, 'Z'))
        prismaMock.trainingProgram.findMany.mockResolvedValue(many.map((trainee) => ({ traineeId: trainee.id })) as never)
        groupByMock.mockResolvedValue([] as never)

        const result = await getInactiveTrainees(many, NOW)

        expect(result.total).toBe(8)
        expect(result.items).toHaveLength(6)
        // all "never": alphabetical
        expect(result.items[0].traineeName).toBe('Name0 Z')
    })

    it('does not query feedback when no trainee has an active program', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)

        await expect(getInactiveTrainees(TRAINEES, NOW)).resolves.toEqual({ items: [], total: 0 })
        expect(groupByMock).not.toHaveBeenCalled()
    })

    it('does not query at all without active trainees', async () => {
        await expect(getInactiveTrainees([makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual({ items: [], total: 0 })
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/inactive-trainees.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `inactive-trainees.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart, startOfUtcDay, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, initials, type DashboardTrainee } from './trainees'

export interface InactiveTrainee {
    traineeId: string
    traineeName: string
    initials: string
    /** null when the trainee never logged a session */
    daysSinceLastSession: number | null
}

export interface InactiveTraineesResult {
    items: InactiveTrainee[]
    total: number
}

const EMPTY: InactiveTraineesResult = { items: [], total: 0 }

export async function getInactiveTrainees(trainees: DashboardTrainee[], now: Date): Promise<InactiveTraineesResult> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return EMPTY

    const programs = await prisma.trainingProgram.findMany({
        where: { traineeId: { in: traineeIds }, status: 'active' },
        select: { traineeId: true },
        distinct: ['traineeId'],
    })
    const withProgram = programs.map((program) => program.traineeId)
    if (withProgram.length === 0) return EMPTY

    const lastSessions = await prisma.exerciseFeedback.groupBy({
        by: ['traineeId'],
        where: { traineeId: { in: withProgram } },
        _max: { date: true },
    })

    const lastByTrainee = new Map(lastSessions.map((row) => [row.traineeId, row._max.date]))
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))
    const today = startOfUtcDay(now)
    const since = recentWindowStart(now)

    const inactive: InactiveTrainee[] = []
    for (const traineeId of withProgram) {
        const last = lastByTrainee.get(traineeId) ?? null
        const trainee = byId.get(traineeId)
        if (!trainee || (last && last >= since)) continue

        inactive.push({
            traineeId,
            traineeName: fullName(trainee),
            initials: initials(trainee),
            daysSinceLastSession: last ? wholeDaysBetween(last, today) : null,
        })
    }

    // never-trained first, then the longest silence; NaN (Infinity − Infinity) falls through to the name
    inactive.sort(
        (left, right) =>
            (right.daysSinceLastSession ?? Infinity) - (left.daysSinceLastSession ?? Infinity) ||
            left.traineeName.localeCompare(right.traineeName),
    )

    return { items: inactive.slice(0, LIST_LIMITS.inactive), total: inactive.length }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/inactive-trainees.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

In `widgets-phase1.test.tsx` add the mock and the imports:

```tsx
vi.mock('@/lib/trainer-dashboard/inactive-trainees', () => ({ getInactiveTrainees: vi.fn() }))
```

```tsx
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import InactiveTraineesWidget from '@/app/trainer/dashboard/_widgets/InactiveTraineesWidget'
```

Append:

```tsx
describe('InactiveTraineesWidget', () => {
    it('links each inactive trainee to their profile and shows how long they have been silent', async () => {
        vi.mocked(getInactiveTrainees).mockResolvedValue({
            total: 8,
            items: [
                { traineeId: 't5', traineeName: 'Carla Blu', initials: 'CB', daysSinceLastSession: null },
                { traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB', daysSinceLastSession: 13 },
                { traineeId: 't4', traineeName: 'Bruno Neri', initials: 'BN', daysSinceLastSession: 1 },
            ],
        })

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Atleti inattivi' })
        expect(getInactiveTrainees).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(within(region).getByRole('link', { name: /Carla Blu/ })).toHaveAttribute('href', '/trainer/trainees/t5')
        expect(within(region).getByText('Nessun allenamento registrato')).toBeInTheDocument()
        expect(within(region).getByText('Ultimo allenamento 13 giorni fa')).toBeInTheDocument()
        expect(within(region).getByText('Ultimo allenamento ieri')).toBeInTheDocument()
        expect(within(region).getByRole('link', { name: '+5 altri' })).toHaveAttribute('href', '/trainer/trainees')
    })

    it('shows the empty state', async () => {
        vi.mocked(getInactiveTrainees).mockResolvedValue({ items: [], total: 0 })

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Tutti gli atleti con un programma attivo si sono allenati di recente.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getInactiveTrainees).mockRejectedValue(new Error('db down'))

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Atleti inattivi' })).getByRole('alert')).toBeInTheDocument()
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: FAIL — cannot resolve `InactiveTraineesWidget`.

- [ ] **Step 7: Implement `InactiveTraineesWidget.tsx`**

```tsx
import Link from 'next/link'
import { ChevronRight, CircleCheck, UserX } from 'lucide-react'
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { Avatar, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function InactiveTraineesWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.inactive.title')
    const icon = <UserX className="h-5 w-5" />
    const result = await loadWidget('inactive-trainees', () => getInactiveTrainees(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const { items, total } = result.data
    const hidden = total - items.length

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.inactive.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.inactive.empty')} />
            ) : (
                <>
                    <ul className="-mx-2 space-y-1">
                        {items.map((item) => (
                            <li key={item.traineeId}>
                                <Link
                                    href={`/trainer/trainees/${item.traineeId}`}
                                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                                >
                                    <Avatar label={item.initials} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                        <p className="text-sm text-gray-500">
                                            {item.daysSinceLastSession === null
                                                ? t('trainerDashboard.inactive.never')
                                                : t('trainerDashboard.inactive.lastSession', { count: item.daysSinceLastSession })}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {hidden > 0 && (
                        <Link href="/trainer/trainees" className="mt-3 inline-block text-sm font-semibold text-gray-700 hover:text-gray-900">
                            {t('trainerDashboard.widget.moreItems', { count: hidden })}
                        </Link>
                    )}
                </>
            )}
        </WidgetCard>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/inactive-trainees.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/inactive-trainees.ts src/app/trainer/dashboard/_widgets/InactiveTraineesWidget.tsx tests/unit/trainer-dashboard/inactive-trainees.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx
git commit -m "feat(trainer-home): add inactive trainees widget"
```

---

### Task 6: Recent feedback

**Files:**
- Create: `src/lib/trainer-dashboard/recent-feedback.ts`
- Create: `src/app/trainer/dashboard/_widgets/RecentFeedbackWidget.tsx`
- Test: `tests/unit/trainer-dashboard/recent-feedback.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase1.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, `HIGH_RPE_THRESHOLD`, `LIST_LIMITS`; Task 2 `formatRelative`; Task 3 primitives.
- Produces:
  - `interface RecentFeedbackItem { id: string; traineeName: string; exerciseName: string; programId: string; rpe: number | null; isHighRpe: boolean; note: string | null; loggedAt: Date }` — `rpe` is the max of the feedback RPE and every set RPE
  - `getRecentFeedback(trainees: DashboardTrainee[], now: Date): Promise<RecentFeedbackItem[]>`
  - default async `RecentFeedbackWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/recent-feedback.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getRecentFeedback } from '@/lib/trainer-dashboard/recent-feedback'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const row = (
    id: string,
    { notes = null, actualRpe = null, setRpes = [] }: { notes?: string | null; actualRpe?: number | null; setRpes?: (number | null)[] },
) => ({
    id,
    notes,
    actualRpe,
    createdAt: at('2026-10-02T18:00:00'),
    trainee: { firstName: 'Anna', lastName: 'Rossi' },
    setsPerformed: setRpes.map((value) => ({ actualRpe: value })),
    workoutExercise: { exercise: { name: 'Squat' }, workout: { week: { programId: 'p1' } } },
})

describe('getRecentFeedback', () => {
    it('loads recent feedback with a note or high RPE, newest first', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        await getRecentFeedback(TRAINEES, NOW)

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: {
                traineeId: { in: ['t1', 't2'] },
                date: { gte: day('2026-09-26') },
                OR: [
                    { notes: { not: null } },
                    { actualRpe: { gte: 9 } },
                    { setsPerformed: { some: { actualRpe: { gte: 9 } } } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                notes: true,
                actualRpe: true,
                createdAt: true,
                trainee: { select: { firstName: true, lastName: true } },
                setsPerformed: { select: { actualRpe: true } },
                workoutExercise: {
                    select: {
                        exercise: { select: { name: true } },
                        workout: { select: { week: { select: { programId: true } } } },
                    },
                },
            },
        })
    })

    it('maps rows, trims notes and takes the highest RPE from feedback or sets', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            row('f1', { notes: '  Dolore al ginocchio  ', actualRpe: 7 }),
            row('f2', { actualRpe: 8, setRpes: [8, 9.5, null] }),
        ] as never)

        await expect(getRecentFeedback(TRAINEES, NOW)).resolves.toEqual([
            {
                id: 'f1', traineeName: 'Anna Rossi', exerciseName: 'Squat', programId: 'p1',
                rpe: 7, isHighRpe: false, note: 'Dolore al ginocchio', loggedAt: at('2026-10-02T18:00:00'),
            },
            {
                id: 'f2', traineeName: 'Anna Rossi', exerciseName: 'Squat', programId: 'p1',
                rpe: 9.5, isHighRpe: true, note: null, loggedAt: at('2026-10-02T18:00:00'),
            },
        ])
    })

    it('drops whitespace-only notes without high RPE, and caps the list at 10', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            row('blank', { notes: '   ', actualRpe: 6 }),
            ...Array.from({ length: 12 }, (_, index) => row(`n${index}`, { notes: 'ok' })),
        ] as never)

        const items = await getRecentFeedback(TRAINEES, NOW)

        expect(items).toHaveLength(10)
        expect(items.map((item) => item.id)).not.toContain('blank')
    })

    it('does not query without active trainees', async () => {
        await expect(getRecentFeedback([makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/recent-feedback.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `recent-feedback.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { HIGH_RPE_THRESHOLD, LIST_LIMITS } from './constants'
import { recentWindowStart } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface RecentFeedbackItem {
    id: string
    traineeName: string
    exerciseName: string
    programId: string
    /** Highest RPE among the feedback and its sets */
    rpe: number | null
    isHighRpe: boolean
    note: string | null
    loggedAt: Date
}

export async function getRecentFeedback(trainees: DashboardTrainee[], now: Date): Promise<RecentFeedbackItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const rows = await prisma.exerciseFeedback.findMany({
        where: {
            traineeId: { in: traineeIds },
            date: { gte: recentWindowStart(now) },
            OR: [
                { notes: { not: null } },
                { actualRpe: { gte: HIGH_RPE_THRESHOLD } },
                { setsPerformed: { some: { actualRpe: { gte: HIGH_RPE_THRESHOLD } } } },
            ],
        },
        orderBy: { createdAt: 'desc' },
        // headroom for blank notes, which can only be filtered after loading
        take: LIST_LIMITS.feedback * 2,
        select: {
            id: true,
            notes: true,
            actualRpe: true,
            createdAt: true,
            trainee: { select: { firstName: true, lastName: true } },
            setsPerformed: { select: { actualRpe: true } },
            workoutExercise: {
                select: {
                    exercise: { select: { name: true } },
                    workout: { select: { week: { select: { programId: true } } } },
                },
            },
        },
    })

    return rows
        .map((row) => {
            const rpeValues = [row.actualRpe, ...row.setsPerformed.map((set) => set.actualRpe)].filter(
                (value): value is number => value !== null,
            )
            const rpe = rpeValues.length > 0 ? Math.max(...rpeValues) : null

            return {
                id: row.id,
                traineeName: fullName(row.trainee),
                exerciseName: row.workoutExercise.exercise.name,
                programId: row.workoutExercise.workout.week.programId,
                rpe,
                isHighRpe: rpe !== null && rpe >= HIGH_RPE_THRESHOLD,
                note: row.notes?.trim() || null,
                loggedAt: row.createdAt,
            }
        })
        .filter((item) => item.note !== null || item.isHighRpe)
        .slice(0, LIST_LIMITS.feedback)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/recent-feedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

In `widgets-phase1.test.tsx` add:

```tsx
vi.mock('@/lib/trainer-dashboard/recent-feedback', () => ({ getRecentFeedback: vi.fn() }))
```

```tsx
import { getRecentFeedback } from '@/lib/trainer-dashboard/recent-feedback'
import RecentFeedbackWidget from '@/app/trainer/dashboard/_widgets/RecentFeedbackWidget'
import { at } from './fixtures'
```

(merge `at` into the existing `./fixtures` import.)

Append:

```tsx
describe('RecentFeedbackWidget', () => {
    it('shows trainee, exercise, relative time, RPE badge and the note, linking to the program', async () => {
        vi.mocked(getRecentFeedback).mockResolvedValue([
            {
                id: 'f1', traineeName: 'Anna Rossi', exerciseName: 'Squat', programId: 'p1',
                rpe: 9.5, isHighRpe: true, note: 'Ginocchio dolorante', loggedAt: at('2026-10-03T08:00:00'),
            },
            {
                id: 'f2', traineeName: 'Luca Bianchi', exerciseName: 'Panca', programId: 'p2',
                rpe: null, isHighRpe: false, note: 'Tutto bene', loggedAt: at('2026-10-02T09:00:00'),
            },
        ])

        await renderAsync(RecentFeedbackWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Feedback recenti' })
        const links = within(region).getAllByRole('link')
        expect(getRecentFeedback).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(links[0]).toHaveAttribute('href', '/trainer/programs/p1')
        expect(links[0]).toHaveTextContent('Anna Rossi')
        expect(links[0]).toHaveTextContent('Squat')
        expect(links[0]).toHaveTextContent('2 ore fa')
        expect(links[0]).toHaveTextContent('Ginocchio dolorante')
        expect(within(links[0]).getByText('RPE 9.5')).toHaveClass('bg-red-100')
        expect(within(links[1]).queryByText(/RPE/)).not.toBeInTheDocument()
    })

    it('shows the empty state', async () => {
        vi.mocked(getRecentFeedback).mockResolvedValue([])

        await renderAsync(RecentFeedbackWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessuna nota o RPE alto negli ultimi 7 giorni.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getRecentFeedback).mockRejectedValue(new Error('db down'))

        await renderAsync(RecentFeedbackWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Feedback recenti' })).getByRole('alert')).toBeInTheDocument()
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: FAIL — cannot resolve `RecentFeedbackWidget`.

- [ ] **Step 7: Implement `RecentFeedbackWidget.tsx`**

```tsx
import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'
import { formatRelative } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getRecentFeedback } from '@/lib/trainer-dashboard/recent-feedback'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function RecentFeedbackWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.feedback.title')
    const icon = <MessageSquareText className="h-5 w-5" />
    const result = await loadWidget('recent-feedback', () => getRecentFeedback(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.feedback.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<MessageSquareText className="h-8 w-8" />} message={t('trainerDashboard.feedback.empty')} />
            ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link href={`/trainer/programs/${item.programId}`} className="block rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="min-w-0 truncate text-sm">
                                        <span className="font-semibold text-gray-900">{item.traineeName}</span>
                                        <span className="text-gray-500"> · {item.exerciseName}</span>
                                    </p>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {item.rpe !== null && (
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    item.isHighRpe ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {t('trainerDashboard.feedback.rpe', { value: item.rpe })}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">{formatRelative(item.loggedAt, ctx.now, t)}</span>
                                    </div>
                                </div>
                                {item.note && <p className="mt-1 line-clamp-2 text-sm text-gray-700">{item.note}</p>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetCard>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/recent-feedback.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/recent-feedback.ts src/app/trainer/dashboard/_widgets/RecentFeedbackWidget.tsx tests/unit/trainer-dashboard/recent-feedback.test.ts tests/unit/trainer-dashboard/widgets-phase1.test.tsx
git commit -m "feat(trainer-home): add recent feedback widget"
```

---

### Task 7: Page shell (Phase 1), E2E, CHANGELOG, verification

**Files:**
- Modify (rewrite): `src/app/trainer/dashboard/page.tsx`
- Create: `tests/e2e/trainer-dashboard.spec.ts`
- Modify: `tests/e2e/trainer-subscription-renewals.spec.ts:65-69`
- Modify: `implementation-docs/CHANGELOG.md` (our entry only, see Step 6)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: the Phase 1 home. Task 12 changes only the grid of `page.tsx`.

- [ ] **Step 1: Rewrite `page.tsx`**

Replace the whole file with:

```tsx
import { Suspense, type ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import { createTranslator, resolveDashboardLocale } from '@/lib/trainer-dashboard/i18n'
import { getTrainerTrainees } from '@/lib/trainer-dashboard/trainees'
import DashboardHeader from './_widgets/DashboardHeader'
import InactiveTraineesWidget from './_widgets/InactiveTraineesWidget'
import RecentFeedbackWidget from './_widgets/RecentFeedbackWidget'
import TodoTodayWidget from './_widgets/TodoTodayWidget'
import { WidgetSkeleton } from './_widgets/WidgetCard'
import type { WidgetContext } from './_widgets/types'

const SPAN_CLASS = { 1: '', 2: 'lg:col-span-2', 3: 'lg:col-span-3' } as const

/** Grid cell that streams its widget independently of the others. */
function Slot({ span = 1, children }: { span?: keyof typeof SPAN_CLASS; children: ReactNode }) {
    return (
        <div className={SPAN_CLASS[span]}>
            <Suspense fallback={<WidgetSkeleton />}>{children}</Suspense>
        </div>
    )
}

export default async function TrainerDashboard() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Verify trainer role - redirect to correct dashboard if wrong role
    if (session.user.role !== 'trainer' && session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const locale = resolveDashboardLocale((await cookies()).get('i18next')?.value)
    const ctx: WidgetContext = {
        trainerId: session.user.id,
        trainees: await getTrainerTrainees(session.user.id),
        now: new Date(),
        locale,
        t: createTranslator(locale),
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="space-y-6">
                <DashboardHeader ctx={ctx} firstName={session.user.firstName} />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Slot span={2}>
                        <TodoTodayWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <InactiveTraineesWidget ctx={ctx} />
                    </Slot>
                    <Slot span={3}>
                        <RecentFeedbackWidget ctx={ctx} />
                    </Slot>
                </div>
            </div>
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Type-check, lint and run the dashboard tests**

Run: `npm run type-check && npm run lint && npx vitest run tests/unit/trainer-dashboard`
Expected: no type errors, no lint errors, all dashboard tests PASS.

Likely type error: `prisma.exerciseFeedback.groupBy` in `inactive-trainees.ts` complaining about circular `by`/`_max` generics. If it appears, keep the call and annotate the result: `const lastSessions: { traineeId: string; _max: { date: Date | null } }[] = await prisma.exerciseFeedback.groupBy({...})`.

- [ ] **Step 3: Update the E2E assertion that read the removed subscriptions KPI card**

In `tests/e2e/trainer-subscription-renewals.spec.ts` replace:

```ts
        // Home KPI counts at least this athlete
        await page.goto('/trainer/dashboard')
        const kpi = page.getByRole('link', { name: /abbonamenti|subscriptions/i }).filter({ hasText: /in scadenza|expiring/i })
        await expect(kpi).toBeVisible()
        await expect(kpi.locator('span.text-3xl')).not.toHaveText('0')
```

with:

```ts
        // Home "To do today" lists this athlete's expiring subscription
        await page.goto('/trainer/dashboard')
        const todo = page.getByRole('region', { name: /da fare oggi|to do today/i })
        const todoItem = todo.getByRole('link').filter({ hasText: traineeName })
        await expect(todoItem).toContainText(/in scadenza|expires/i)
        await expect(todoItem).toHaveAttribute('href', '/trainer/subscriptions')
```

Also update the file's header comment line "in the profile, the athlete list, the subscriptions page and the home KPI." → "… and the home 'To do today' list."

- [ ] **Step 4: Add the home E2E spec**

`tests/e2e/trainer-dashboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: the trainer home renders its header and every widget, whatever the data.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 */
test.describe('Trainer: home', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('shows the greeting, quick actions and every widget', { tag: '@smoke' }, async ({ page }) => {
        await expect(
            page.getByRole('heading', { level: 1, name: /buongiorno|buon pomeriggio|buonasera|good (morning|afternoon|evening)/i }),
        ).toBeVisible()
        await expect(page.getByRole('link', { name: /nuovo programma|new program/i })).toHaveAttribute('href', '/trainer/programs/new')

        for (const name of [/da fare oggi|to do today/i, /atleti inattivi|inactive athletes/i, /feedback recenti|recent feedback/i]) {
            const region = page.getByRole('region', { name })
            await expect(region).toBeVisible()
            await expect(region.getByRole('alert')).toHaveCount(0)
        }
    })

    test('quick action opens the new program page', async ({ page }) => {
        await page.getByRole('link', { name: /nuovo programma|new program/i }).click()
        await page.waitForURL('**/trainer/programs/new')
    })
})
```

- [ ] **Step 5: Run the E2E specs if the environment allows**

Run: `npx playwright test tests/e2e/trainer-dashboard.spec.ts tests/e2e/trainer-subscription-renewals.spec.ts`
Expected: PASS. The corporate network blocks Postgres from WSL, so this may fail to start the server or log in: in that case record "E2E not run: no DB access from WSL" in the task report and continue. Do not mark E2E as passing.

- [ ] **Step 6: Add the CHANGELOG entry without committing the user's pending hunk**

`implementation-docs/CHANGELOG.md` is CRLF and already carries an uncommitted entry of the user ("Icone nelle tab del dettaglio atleta"). The script below inserts our entry right after the `### Changed` line of `[Unreleased]`, both in the working copy and in a copy of `HEAD`, then stages only the HEAD-based copy. Result: the commit contains only our entry, and the working tree keeps both.

```bash
SCRATCH=/tmp/claude-1000/-mnt-c-dev-projects-zero-cento-project/3760ee0a-e73b-4ad2-b1f5-6bcd4c0288d5/scratchpad
git show HEAD:implementation-docs/CHANGELOG.md > "$SCRATCH/changelog-head.md"
python3 - "$SCRATCH/changelog-head.md" implementation-docs/CHANGELOG.md <<'EOF'
import sys
entry = (
    "### [3 Ottobre 2026] — Home trainer: Fase 1 (da fare oggi, atleti inattivi, feedback)\r\n"
    "\r\n"
    "**File modificati:** `src/app/trainer/dashboard/page.tsx`, `src/app/trainer/dashboard/_widgets/*` (nuovi), "
    "`src/lib/trainer-dashboard/*` (nuovi), `public/locales/{en,it}/trainer.json`, `tests/unit/trainer-dashboard/*` (nuovi), "
    "`tests/e2e/trainer-dashboard.spec.ts` (nuovo), `tests/e2e/trainer-subscription-renewals.spec.ts`, `implementation-docs/CHANGELOG.md`\r\n"
    "**Note:** La home trainer era un hub di link ridondanti (stat card, azioni rapide e card di navigazione verso le stesse tre pagine). "
    "Ora: intestazione con saluto, data, azioni rapide e 3 KPI (atleti attivi 7 gg, programmi attivi, sessioni della settimana con delta); "
    "\"Da fare oggi\" con abbonamenti scaduti/in scadenza, test da revisionare, programmi in chiusura senza successore e settimane di test in corso; "
    "atleti inattivi da 7 giorni con programma attivo; feedback recenti con note o RPE >= 9. Ogni widget è un server component in `<Suspense>` "
    "con la sua query in `src/lib/trainer-dashboard/` e gestisce da sé l'errore, così un widget rotto non blocca la pagina. "
    "Sessione = atleta + workout + giorno (UTC) di `ExerciseFeedback`. Nessuna migrazione. Solo icone lucide, niente emoji. "
    "Spec: `docs/superpowers/specs/2026-10-03-trainer-home-redesign-design.md`.\r\n"
)
anchor = b"### Changed\r\n"
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    if anchor not in data:
        sys.exit(f"{path}: anchor '### Changed' (CRLF) not found")
    data = data.replace(anchor, anchor + entry.encode("utf-8"), 1)
    open(path, "wb").write(data)
EOF
blob=$(git hash-object -w "$SCRATCH/changelog-head.md")
git update-index --cacheinfo 100644,"$blob",implementation-docs/CHANGELOG.md
git diff --cached --stat implementation-docs/CHANGELOG.md
```

Expected: `git diff --cached` shows `1 file changed, 4 insertions(+)` for the CHANGELOG. `git diff implementation-docs/CHANGELOG.md` (unstaged) still shows the user's "Icone nelle tab" entry. If the user has committed their entry in the meantime, `git diff implementation-docs/CHANGELOG.md` before the script is empty, and the result is the same.

- [ ] **Step 7: Run the full unit suite with coverage**

Run: `npm run test:unit -- --coverage`
Expected: all tests PASS and the coverage thresholds hold (`src/lib/**` ≥ 94/94/97/88). This takes 8–10 minutes on `/mnt/c`. If `src/lib/**` drops below the floor, add the missing branch tests to the owning `src/lib/trainer-dashboard/*` test file. Never lower a threshold.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build succeeds; `/trainer/dashboard` is listed as a dynamic (ƒ) route. Afterwards run `git status --short package-lock.json` and restore it with `git checkout -- package-lock.json` if the build rewrote it.

- [ ] **Step 9: Commit**

```bash
git add src/app/trainer/dashboard/page.tsx tests/e2e/trainer-dashboard.spec.ts tests/e2e/trainer-subscription-renewals.spec.ts
git commit -m "feat(trainer-home): rebuild trainer home around daily widgets (phase 1)"
git status --short
```

The CHANGELOG is already staged from Step 6, so the commit includes it. Expected `git status` afterwards: only the user's pre-existing ` M implementation-docs/CHANGELOG.md` and ` M src/app/trainer/trainees/[id]/_content.tsx`.

**Phase 1 checkpoint:** stop and show the home to the user (`npm run dev`, open `/trainer/dashboard` as a trainer) before starting Phase 2.

---

# Phase 2 — alive

### Task 8: Activity feed

**Files:**
- Create: `src/lib/trainer-dashboard/activity-feed.ts`
- Create: `src/app/trainer/dashboard/_widgets/ActivityFeedWidget.tsx`
- Test: `tests/unit/trainer-dashboard/activity-feed.test.ts`
- Test: `tests/unit/trainer-dashboard/widgets-phase2.test.tsx` (created here, extended in Tasks 9–11)

**Interfaces:**
- Consumes: Task 1 (`SESSION_FEEDBACK_SELECT`, `groupSessions`, `recentWindowStart`, `utcDayKey`, `activeTraineeIds`, `fullName`, `initials`, `LIST_LIMITS`), Task 2 (`formatDayLabel`, `formatRelative`), Task 3 primitives.
- Produces:
  - `interface ActivityItem { key: string; traineeId: string; traineeName: string; initials: string; programId: string; weekNumber: number; dayIndex: number; exerciseCount: number; lastLoggedAt: Date; day: string; hasRecord: boolean }`
  - `getActivityFeed(trainees: DashboardTrainee[], now: Date): Promise<ActivityItem[]>` (newest first, max 15)
  - default async `ActivityFeedWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/activity-feed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const feedback = (traineeId: string, workoutId: string, date: string, time: string, dayIndex = 1, weekNumber = 2) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T${time}`),
    workoutExercise: { workoutId, workout: { dayIndex, week: { weekNumber, programId: `prog-${traineeId}` } } },
})

describe('getActivityFeed', () => {
    it('queries the last 7 days of feedback and personal records', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)

        await expect(getActivityFeed(TRAINEES, NOW)).resolves.toEqual([])

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-09-26') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: {
                    select: {
                        workoutId: true,
                        workout: { select: { dayIndex: true, week: { select: { weekNumber: true, programId: true } } } },
                    },
                },
            },
        })
        expect(prismaMock.personalRecord.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, recordDate: { gte: day('2026-09-26') } },
            select: { traineeId: true, recordDate: true },
        })
    })

    it('turns feedback into sessions with workout details and flags same-day records', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            feedback('t1', 'w1', '2026-10-03', '08:00:00', 3, 2),
            feedback('t1', 'w1', '2026-10-03', '08:30:00', 3, 2),
            feedback('t2', 'w9', '2026-10-01', '19:00:00', 1, 5),
        ] as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([{ traineeId: 't1', recordDate: at('2026-10-03T08:15:00') }] as never)

        await expect(getActivityFeed(TRAINEES, NOW)).resolves.toEqual([
            {
                key: 't1|w1|2026-10-03', traineeId: 't1', traineeName: 'Anna Rossi', initials: 'AR',
                programId: 'prog-t1', weekNumber: 2, dayIndex: 3, exerciseCount: 2,
                lastLoggedAt: at('2026-10-03T08:30:00'), day: '2026-10-03', hasRecord: true,
            },
            {
                key: 't2|w9|2026-10-01', traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB',
                programId: 'prog-t2', weekNumber: 5, dayIndex: 1, exerciseCount: 1,
                lastLoggedAt: at('2026-10-01T19:00:00'), day: '2026-10-01', hasRecord: false,
            },
        ])
    })

    it('keeps only the 15 most recent sessions', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue(
            Array.from({ length: 20 }, (_, index) => feedback('t1', `w${index}`, '2026-10-02', `${String(index).padStart(2, '0')}:00:00`)) as never,
        )
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)

        const items = await getActivityFeed(TRAINEES, NOW)

        expect(items).toHaveLength(15)
        expect(items[0].key).toBe('t1|w19|2026-10-02')
    })

    it('does not query without active trainees', async () => {
        await expect(getActivityFeed([makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/activity-feed.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `activity-feed.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart, utcDayKey } from './dates'
import { SESSION_FEEDBACK_SELECT, groupSessions } from './sessions'
import { activeTraineeIds, fullName, initials, type DashboardTrainee } from './trainees'

export interface ActivityItem {
    key: string
    traineeId: string
    traineeName: string
    initials: string
    programId: string
    weekNumber: number
    dayIndex: number
    exerciseCount: number
    lastLoggedAt: Date
    day: string
    hasRecord: boolean
}

export async function getActivityFeed(trainees: DashboardTrainee[], now: Date): Promise<ActivityItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const since = recentWindowStart(now)
    const [rows, records] = await Promise.all([
        prisma.exerciseFeedback.findMany({
            where: { traineeId: { in: traineeIds }, date: { gte: since } },
            select: {
                ...SESSION_FEEDBACK_SELECT,
                workoutExercise: {
                    select: {
                        workoutId: true,
                        workout: { select: { dayIndex: true, week: { select: { weekNumber: true, programId: true } } } },
                    },
                },
            },
        }),
        prisma.personalRecord.findMany({
            where: { traineeId: { in: traineeIds }, recordDate: { gte: since } },
            select: { traineeId: true, recordDate: true },
        }),
    ])

    const workouts = new Map(rows.map((row) => [row.workoutExercise.workoutId, row.workoutExercise.workout]))
    const recordDays = new Set(records.map((record) => `${record.traineeId}|${utcDayKey(record.recordDate)}`))
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))

    return groupSessions(rows)
        .slice(0, LIST_LIMITS.feed)
        .flatMap((session) => {
            const workout = workouts.get(session.workoutId)
            const trainee = byId.get(session.traineeId)
            if (!workout || !trainee) return []

            return [{
                key: session.key,
                traineeId: session.traineeId,
                traineeName: fullName(trainee),
                initials: initials(trainee),
                programId: workout.week.programId,
                weekNumber: workout.week.weekNumber,
                dayIndex: workout.dayIndex,
                exerciseCount: session.exerciseCount,
                lastLoggedAt: session.lastLoggedAt,
                day: session.day,
                hasRecord: recordDays.has(`${session.traineeId}|${session.day}`),
            }]
        })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/activity-feed.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing widget test**

`tests/unit/trainer-dashboard/widgets-phase2.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/activity-feed', () => ({ getActivityFeed: vi.fn() }))

import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import ActivityFeedWidget from '@/app/trainer/dashboard/_widgets/ActivityFeedWidget'
import { NOW, TRAINEES, at } from './fixtures'

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
    return { trainerId: 'trainer-1', trainees: TRAINEES, now: NOW, locale: 'it', t: createTranslator('it'), ...overrides }
}

async function renderAsync(node: Promise<ReactNode>) {
    return render(<>{await node}</>)
}

const activity = (key: string, day: string, overrides: Partial<Awaited<ReturnType<typeof getActivityFeed>>[number]> = {}) => ({
    key, traineeId: 't1', traineeName: 'Anna Rossi', initials: 'AR', programId: 'p1', weekNumber: 2, dayIndex: 3,
    exerciseCount: 5, lastLoggedAt: at(`${day}T08:00:00`), day, hasRecord: false, ...overrides,
})

describe('ActivityFeedWidget', () => {
    it('groups sessions by day and describes each one', async () => {
        vi.mocked(getActivityFeed).mockResolvedValue([
            activity('a', '2026-10-03', { hasRecord: true }),
            activity('b', '2026-10-02', { traineeName: 'Luca Bianchi', initials: 'LB', exerciseCount: 1, programId: 'p2' }),
        ])

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Attività recente' })
        expect(getActivityFeed).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(within(region).getByRole('heading', { name: 'Oggi' })).toBeInTheDocument()
        expect(within(region).getByRole('heading', { name: 'Ieri' })).toBeInTheDocument()
        const [first, second] = within(region).getAllByRole('link')
        expect(first).toHaveAttribute('href', '/trainer/programs/p1')
        expect(first).toHaveTextContent('Anna Rossi ha completato Giorno 3 · Settimana 2')
        expect(first).toHaveTextContent('5 esercizi · 2 ore fa')
        expect(within(first).getByText('Nuovo record')).toBeInTheDocument()
        expect(second).toHaveTextContent('1 esercizio')
        expect(within(second).queryByText('Nuovo record')).not.toBeInTheDocument()
    })

    it('shows the empty state', async () => {
        vi.mocked(getActivityFeed).mockResolvedValue([])

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun allenamento registrato negli ultimi 7 giorni.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getActivityFeed).mockRejectedValue(new Error('db down'))

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Attività recente' })).getByRole('alert')).toBeInTheDocument()
    })
})

export { makeCtx, renderAsync }
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: FAIL — cannot resolve `ActivityFeedWidget`.

- [ ] **Step 7: Implement `ActivityFeedWidget.tsx`**

```tsx
import Link from 'next/link'
import { Activity, Trophy } from 'lucide-react'
import { getActivityFeed, type ActivityItem } from '@/lib/trainer-dashboard/activity-feed'
import { formatDayLabel, formatRelative } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { Avatar, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

function groupByDay(items: ActivityItem[]): [string, ActivityItem[]][] {
    const groups = new Map<string, ActivityItem[]>()
    for (const item of items) {
        groups.set(item.day, [...(groups.get(item.day) ?? []), item])
    }
    return [...groups.entries()]
}

export default async function ActivityFeedWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.feed.title')
    const icon = <Activity className="h-5 w-5" />
    const result = await loadWidget('activity-feed', () => getActivityFeed(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Activity className="h-8 w-8" />} message={t('trainerDashboard.feed.empty')} />
            ) : (
                <div className="space-y-5">
                    {groupByDay(items).map(([day, dayItems]) => (
                        <section key={day}>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {formatDayLabel(day, ctx.now, ctx.locale, t)}
                            </h3>
                            <ul className="-mx-2 grid grid-cols-1 gap-1 lg:grid-cols-2">
                                {dayItems.map((item) => (
                                    <li key={item.key}>
                                        <Link
                                            href={`/trainer/programs/${item.programId}`}
                                            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                                        >
                                            <Avatar label={item.initials} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-gray-700">
                                                    <span className="font-semibold text-gray-900">{item.traineeName}</span>{' '}
                                                    {t('trainerDashboard.feed.entry', { day: item.dayIndex, week: item.weekNumber })}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {t('trainerDashboard.feed.exercises', { count: item.exerciseCount })} ·{' '}
                                                    {formatRelative(item.lastLoggedAt, ctx.now, t)}
                                                </p>
                                            </div>
                                            {item.hasRecord && (
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                                    <Trophy className="h-3 w-3" aria-hidden="true" />
                                                    {t('trainerDashboard.feed.record')}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </WidgetCard>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/activity-feed.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/activity-feed.ts src/app/trainer/dashboard/_widgets/ActivityFeedWidget.tsx tests/unit/trainer-dashboard/activity-feed.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx
git commit -m "feat(trainer-home): add recent activity feed widget"
```

---

### Task 9: New personal records

**Files:**
- Create: `src/lib/trainer-dashboard/new-records.ts`
- Create: `src/app/trainer/dashboard/_widgets/NewRecordsWidget.tsx`
- Test: `tests/unit/trainer-dashboard/new-records.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase2.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, `LIST_LIMITS`, Task 3 primitives.
- Produces:
  - `interface NewRecordItem { id: string; traineeName: string; exerciseName: string; reps: number; weight: number; recordDate: Date; deltaKg: number | null }` — `null` = first record for that trainee + exercise + reps; otherwise weight minus the previous best (rounded to 0.1 kg, can be ≤ 0)
  - `getNewRecords(trainees: DashboardTrainee[], now: Date): Promise<NewRecordItem[]>`
  - default async `NewRecordsWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/new-records.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, day, makeTrainee } from './fixtures'

const record = (id: string, traineeId: string, exerciseId: string, reps: number, weight: number, date: string) => ({
    id,
    traineeId,
    exerciseId,
    reps,
    weight,
    recordDate: day(date),
    trainee: { firstName: 'Anna', lastName: 'Rossi' },
    exercise: { name: exerciseId === 'e1' ? 'Squat' : 'Panca' },
})

describe('getNewRecords', () => {
    it('loads this week records and compares them with the previous best of the same lift and reps', async () => {
        prismaMock.personalRecord.findMany
            .mockResolvedValueOnce([
                record('r1', 't1', 'e1', 1, 142.5, '2026-10-02'),
                record('r2', 't1', 'e2', 5, 80, '2026-09-30'),
            ] as never)
            .mockResolvedValueOnce([
                { traineeId: 't1', exerciseId: 'e1', reps: 1, weight: 130, recordDate: day('2026-06-01') },
                { traineeId: 't1', exerciseId: 'e1', reps: 1, weight: 137.4, recordDate: day('2026-08-01') },
                // same lift, different reps: not comparable
                { traineeId: 't1', exerciseId: 'e2', reps: 3, weight: 85, recordDate: day('2026-08-01') },
            ] as never)

        const items = await getNewRecords(TRAINEES, NOW)

        expect(prismaMock.personalRecord.findMany).toHaveBeenNthCalledWith(1, {
            where: { traineeId: { in: ['t1', 't2'] }, recordDate: { gte: day('2026-09-26') } },
            orderBy: { recordDate: 'desc' },
            take: 6,
            select: {
                id: true,
                traineeId: true,
                exerciseId: true,
                reps: true,
                weight: true,
                recordDate: true,
                trainee: { select: { firstName: true, lastName: true } },
                exercise: { select: { name: true } },
            },
        })
        expect(prismaMock.personalRecord.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                OR: [
                    { traineeId: 't1', exerciseId: 'e1', reps: 1, recordDate: { lt: day('2026-10-02') } },
                    { traineeId: 't1', exerciseId: 'e2', reps: 5, recordDate: { lt: day('2026-09-30') } },
                ],
            },
            select: { traineeId: true, exerciseId: true, reps: true, weight: true, recordDate: true },
        })
        expect(items).toEqual([
            { id: 'r1', traineeName: 'Anna Rossi', exerciseName: 'Squat', reps: 1, weight: 142.5, recordDate: day('2026-10-02'), deltaKg: 5.1 },
            { id: 'r2', traineeName: 'Anna Rossi', exerciseName: 'Panca', reps: 5, weight: 80, recordDate: day('2026-09-30'), deltaKg: null },
        ])
    })

    it('skips the comparison query when there are no new records', async () => {
        prismaMock.personalRecord.findMany.mockResolvedValueOnce([] as never)

        await expect(getNewRecords(TRAINEES, NOW)).resolves.toEqual([])
        expect(prismaMock.personalRecord.findMany).toHaveBeenCalledTimes(1)
    })

    it('does not query without active trainees', async () => {
        await expect(getNewRecords([makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.personalRecord.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/new-records.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `new-records.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface NewRecordItem {
    id: string
    traineeName: string
    exerciseName: string
    reps: number
    weight: number
    recordDate: Date
    /** null for a first record of that lift and rep count */
    deltaKg: number | null
}

export async function getNewRecords(trainees: DashboardTrainee[], now: Date): Promise<NewRecordItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const recent = await prisma.personalRecord.findMany({
        where: { traineeId: { in: traineeIds }, recordDate: { gte: recentWindowStart(now) } },
        orderBy: { recordDate: 'desc' },
        take: LIST_LIMITS.records,
        select: {
            id: true,
            traineeId: true,
            exerciseId: true,
            reps: true,
            weight: true,
            recordDate: true,
            trainee: { select: { firstName: true, lastName: true } },
            exercise: { select: { name: true } },
        },
    })
    if (recent.length === 0) return []

    const previous = await prisma.personalRecord.findMany({
        where: {
            OR: recent.map((record) => ({
                traineeId: record.traineeId,
                exerciseId: record.exerciseId,
                reps: record.reps,
                recordDate: { lt: record.recordDate },
            })),
        },
        select: { traineeId: true, exerciseId: true, reps: true, weight: true, recordDate: true },
    })

    return recent.map((record) => {
        const earlier = previous.filter(
            (other) =>
                other.traineeId === record.traineeId &&
                other.exerciseId === record.exerciseId &&
                other.reps === record.reps &&
                other.recordDate < record.recordDate,
        )
        const bestBefore = earlier.length > 0 ? Math.max(...earlier.map((other) => other.weight)) : null

        return {
            id: record.id,
            traineeName: fullName(record.trainee),
            exerciseName: record.exercise.name,
            reps: record.reps,
            weight: record.weight,
            recordDate: record.recordDate,
            deltaKg: bestBefore === null ? null : Math.round((record.weight - bestBefore) * 10) / 10,
        }
    })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/new-records.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

In `widgets-phase2.test.tsx` add:

```tsx
vi.mock('@/lib/trainer-dashboard/new-records', () => ({ getNewRecords: vi.fn() }))
```

```tsx
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import NewRecordsWidget from '@/app/trainer/dashboard/_widgets/NewRecordsWidget'
import { day } from './fixtures'
```

(merge `day` into the existing `./fixtures` import.)

Append before the `export` line:

```tsx
describe('NewRecordsWidget', () => {
    it('shows each record with its improvement, or "first record"', async () => {
        vi.mocked(getNewRecords).mockResolvedValue([
            { id: 'r1', traineeName: 'Anna Rossi', exerciseName: 'Squat', reps: 1, weight: 142.5, recordDate: day('2026-10-02'), deltaKg: 5 },
            { id: 'r2', traineeName: 'Luca Bianchi', exerciseName: 'Panca', reps: 5, weight: 80, recordDate: day('2026-09-30'), deltaKg: null },
            { id: 'r3', traineeName: 'Luca Bianchi', exerciseName: 'Stacco', reps: 3, weight: 150, recordDate: day('2026-09-29'), deltaKg: 0 },
        ])

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Nuovi record' })
        const items = within(region).getAllByRole('listitem')
        expect(getNewRecords).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(items[0]).toHaveTextContent('Anna Rossi')
        expect(items[0]).toHaveTextContent('Squat')
        expect(items[0]).toHaveTextContent('142.5 kg × 1')
        expect(items[0]).toHaveTextContent('+5 kg')
        expect(items[1]).toHaveTextContent('Primo record')
        expect(items[2]).not.toHaveTextContent('+0 kg')
        expect(items[2]).not.toHaveTextContent('Primo record')
    })

    it('shows the encouraging empty state', async () => {
        vi.mocked(getNewRecords).mockResolvedValue([])

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun nuovo record questa settimana. La prossima è quella buona.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getNewRecords).mockRejectedValue(new Error('db down'))

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Nuovi record' })).getByRole('alert')).toBeInTheDocument()
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: FAIL — cannot resolve `NewRecordsWidget`.

- [ ] **Step 7: Implement `NewRecordsWidget.tsx`**

```tsx
import { Sparkles, Trophy } from 'lucide-react'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function NewRecordsWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.records.title')
    const icon = <Trophy className="h-5 w-5" />
    const result = await loadWidget('new-records', () => getNewRecords(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.records.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Sparkles className="h-8 w-8" />} message={t('trainerDashboard.records.empty')} />
            ) : (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                <Trophy className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                <p className="truncate text-sm text-gray-500">{item.exerciseName}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="font-semibold text-gray-900">
                                    {t('trainerDashboard.records.value', { weight: item.weight, reps: item.reps })}
                                </p>
                                {item.deltaKg === null ? (
                                    <p className="text-xs text-gray-500">{t('trainerDashboard.records.first')}</p>
                                ) : item.deltaKg > 0 ? (
                                    <p className="text-xs font-semibold text-green-600">
                                        {t('trainerDashboard.records.delta', { delta: item.deltaKg })}
                                    </p>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetCard>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/new-records.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/new-records.ts src/app/trainer/dashboard/_widgets/NewRecordsWidget.tsx tests/unit/trainer-dashboard/new-records.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx
git commit -m "feat(trainer-home): add new personal records widget"
```

---

### Task 10: 8-week trend

**Files:**
- Create: `src/lib/trainer-dashboard/weekly-trend.ts`
- Create: `src/app/trainer/dashboard/_widgets/WeeklyTrendChart.tsx` (`'use client'`)
- Create: `src/app/trainer/dashboard/_widgets/WeeklyTrendWidget.tsx`
- Test: `tests/unit/trainer-dashboard/weekly-trend.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase2.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`SESSION_FEEDBACK_SELECT`, `groupSessions`, `addDays`, `startOfUtcDay`, `startOfUtcWeek`, `utcDayKey`, `DAY_MS`, `activeTraineeIds`, `TREND_WEEKS`), Task 2 (`formatShortDay`), Task 3 primitives.
- Produces:
  - `interface TrendWeek { weekStart: string; sessions: number; volumeKg: number }` (`weekStart` = Monday `YYYY-MM-DD`)
  - `getWeeklyTrend(trainees: DashboardTrainee[], now: Date): Promise<TrendWeek[]>` — always 8 entries, oldest first, current week last
  - `WeeklyTrendChart({ data: WeeklyTrendPoint[]; sessionsLabel: string; volumeLabel: string })`, `interface WeeklyTrendPoint { label: string; sessions: number; volumeKg: number }`
  - default async `WeeklyTrendWidget({ ctx })`

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/weekly-trend.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const WEEK_STARTS = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

const feedback = (workoutId: string, date: string, sets: { reps: number; weight: number }[]) => ({
    traineeId: 't1',
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
    setsPerformed: sets,
})

describe('getWeeklyTrend', () => {
    it('returns 8 empty weeks without querying when there are no active trainees', async () => {
        const weeks = await getWeeklyTrend([makeTrainee('t9', 'Off', 'Line', false)], NOW)

        expect(weeks).toEqual(WEEK_STARTS.map((weekStart) => ({ weekStart, sessions: 0, volumeKg: 0 })))
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })

    it('buckets sessions and completed-set volume into ISO weeks', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            // first week
            feedback('w1', '2026-08-10', [{ reps: 5, weight: 100 }]),
            // current week: one session with two exercises + one more session
            feedback('w2', '2026-09-28', [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }]),
            feedback('w2', '2026-09-28', [{ reps: 10, weight: 20.5 }]),
            // Sunday 4 Oct still belongs to the current week
            feedback('w3', '2026-10-04', []),
        ] as never)

        const weeks = await getWeeklyTrend(TRAINEES, NOW)

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-08-10') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
                setsPerformed: { where: { completed: true }, select: { reps: true, weight: true } },
            },
        })
        expect(weeks[0]).toEqual({ weekStart: '2026-08-10', sessions: 1, volumeKg: 500 })
        expect(weeks.slice(1, 7).every((week) => week.sessions === 0 && week.volumeKg === 0)).toBe(true)
        expect(weeks[7]).toEqual({ weekStart: '2026-09-28', sessions: 2, volumeKg: 1205 })
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/weekly-trend.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `weekly-trend.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { TREND_WEEKS } from './constants'
import { DAY_MS, addDays, startOfUtcDay, startOfUtcWeek, utcDayKey } from './dates'
import { SESSION_FEEDBACK_SELECT, groupSessions } from './sessions'
import { activeTraineeIds, type DashboardTrainee } from './trainees'

export interface TrendWeek {
    /** Monday of the week, YYYY-MM-DD */
    weekStart: string
    sessions: number
    volumeKg: number
}

const WEEK_MS = 7 * DAY_MS

export async function getWeeklyTrend(trainees: DashboardTrainee[], now: Date): Promise<TrendWeek[]> {
    const firstWeek = addDays(startOfUtcWeek(now), -7 * (TREND_WEEKS - 1))
    const weeks: TrendWeek[] = Array.from({ length: TREND_WEEKS }, (_, index) => ({
        weekStart: utcDayKey(addDays(firstWeek, 7 * index)),
        sessions: 0,
        volumeKg: 0,
    }))

    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return weeks

    const rows = await prisma.exerciseFeedback.findMany({
        where: { traineeId: { in: traineeIds }, date: { gte: firstWeek } },
        select: {
            ...SESSION_FEEDBACK_SELECT,
            setsPerformed: { where: { completed: true }, select: { reps: true, weight: true } },
        },
    })

    const weekIndex = (date: Date) => Math.floor((startOfUtcDay(date).getTime() - firstWeek.getTime()) / WEEK_MS)
    const bucket = (date: Date) => weeks[weekIndex(date)] as TrendWeek | undefined

    for (const row of rows) {
        const week = bucket(row.date)
        if (week) week.volumeKg += row.setsPerformed.reduce((sum, set) => sum + set.reps * set.weight, 0)
    }
    for (const session of groupSessions(rows)) {
        const week = bucket(new Date(`${session.day}T00:00:00.000Z`))
        if (week) week.sessions += 1
    }

    return weeks.map((week) => ({ ...week, volumeKg: Math.round(week.volumeKg) }))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/weekly-trend.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

In `widgets-phase2.test.tsx` add the mocks (recharts is mocked the same way as `tests/unit/measurement-trend-chart.test.tsx`):

```tsx
vi.mock('@/lib/trainer-dashboard/weekly-trend', () => ({ getWeeklyTrend: vi.fn() }))
vi.mock('recharts', () => {
    const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: Pass,
        ComposedChart: ({ children, data }: { children?: ReactNode; data?: unknown[] }) => (
            <div data-testid="trend-chart" data-points={JSON.stringify(data)}>{children}</div>
        ),
        Bar: ({ dataKey, name }: { dataKey: string; name: string }) => <div data-testid={`bar-${dataKey}`}>{name}</div>,
        Line: ({ dataKey, name }: { dataKey: string; name: string }) => <div data-testid={`line-${dataKey}`}>{name}</div>,
        XAxis: () => null,
        YAxis: () => null,
        CartesianGrid: () => null,
        Tooltip: () => null,
        Legend: () => null,
    }
})
```

```tsx
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import WeeklyTrendWidget from '@/app/trainer/dashboard/_widgets/WeeklyTrendWidget'
```

Append:

```tsx
describe('WeeklyTrendWidget', () => {
    const weeks = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

    it('summarises the current week and passes 8 labelled points to the chart', async () => {
        vi.mocked(getWeeklyTrend).mockResolvedValue(
            weeks.map((weekStart, index) => ({ weekStart, sessions: index === 7 ? 9 : index === 6 ? 12 : 4, volumeKg: 1000 * index })),
        )

        await renderAsync(WeeklyTrendWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Andamento ultime 8 settimane' })
        expect(getWeeklyTrend).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(within(region).getByText('9 sessioni questa settimana')).toBeInTheDocument()
        expect(within(region).getByText('-3 rispetto alla settimana scorsa')).toBeInTheDocument()
        const points = JSON.parse(within(region).getByTestId('trend-chart').getAttribute('data-points') ?? '[]')
        expect(points).toHaveLength(8)
        expect(points[0]).toEqual({ label: '10/08', sessions: 4, volumeKg: 0 })
        expect(points[7]).toEqual({ label: '28/09', sessions: 9, volumeKg: 7000 })
        expect(within(region).getByTestId('bar-sessions')).toHaveTextContent('Sessioni')
        expect(within(region).getByTestId('line-volumeKg')).toHaveTextContent('Volume (kg)')
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getWeeklyTrend).mockRejectedValue(new Error('db down'))

        await renderAsync(WeeklyTrendWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Andamento ultime 8 settimane' })).getByRole('alert')).toBeInTheDocument()
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: FAIL — cannot resolve `WeeklyTrendWidget`.

- [ ] **Step 7: Implement the chart and the widget**

`src/app/trainer/dashboard/_widgets/WeeklyTrendChart.tsx`:

```tsx
'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface WeeklyTrendPoint {
    label: string
    sessions: number
    volumeKg: number
}

interface WeeklyTrendChartProps {
    data: WeeklyTrendPoint[]
    sessionsLabel: string
    volumeLabel: string
}

// brand.primary and gray-900 from tailwind.config.ts: recharts needs literal colours
const SESSIONS_COLOR = '#FFA700'
const VOLUME_COLOR = '#111827'

export default function WeeklyTrendChart({ data, sessionsLabel, volumeLabel }: WeeklyTrendChartProps) {
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="sessions" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="sessions" dataKey="sessions" name={sessionsLabel} fill={SESSIONS_COLOR} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="volume" dataKey="volumeKg" name={volumeLabel} type="monotone" stroke={VOLUME_COLOR} strokeWidth={2} dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
```

`src/app/trainer/dashboard/_widgets/WeeklyTrendWidget.tsx`:

```tsx
import { ChartColumn, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { formatShortDay } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import WeeklyTrendChart from './WeeklyTrendChart'
import { WidgetCard, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function WeeklyTrendWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.trend.title')
    const icon = <ChartColumn className="h-5 w-5" />
    const result = await loadWidget('weekly-trend', () => getWeeklyTrend(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const weeks = result.data
    const current = weeks[weeks.length - 1]
    const previous = weeks[weeks.length - 2]
    const delta = current.sessions - previous.sessions
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
    const deltaColor = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'

    return (
        <WidgetCard title={title} icon={icon}>
            <div className="mb-3 flex items-baseline gap-3">
                <p className="text-sm font-semibold text-gray-900">
                    {t('trainerDashboard.trend.summary', { count: current.sessions })}
                </p>
                <p className={`flex items-center gap-1 text-sm ${deltaColor}`}>
                    <DeltaIcon className="h-4 w-4" aria-hidden="true" />
                    {t('trainerDashboard.trend.delta', { delta: delta > 0 ? `+${delta}` : String(delta) })}
                </p>
            </div>
            <WeeklyTrendChart
                data={weeks.map((week) => ({
                    label: formatShortDay(new Date(`${week.weekStart}T00:00:00.000Z`), ctx.locale),
                    sessions: week.sessions,
                    volumeKg: week.volumeKg,
                }))}
                sessionsLabel={t('trainerDashboard.trend.sessions')}
                volumeLabel={t('trainerDashboard.trend.volume')}
            />
        </WidgetCard>
    )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/weekly-trend.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/weekly-trend.ts src/app/trainer/dashboard/_widgets/WeeklyTrendChart.tsx src/app/trainer/dashboard/_widgets/WeeklyTrendWidget.tsx tests/unit/trainer-dashboard/weekly-trend.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx
git commit -m "feat(trainer-home): add 8-week sessions and volume trend"
```

---

### Task 11: Consistency ranking

**Files:**
- Create: `src/lib/trainer-dashboard/consistency-ranking.ts`
- Create: `src/app/trainer/dashboard/_widgets/ConsistencyRankingWidget.tsx`
- Test: `tests/unit/trainer-dashboard/consistency-ranking.test.ts`
- Modify (append): `tests/unit/trainer-dashboard/widgets-phase2.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, `CONSISTENCY_WEEKS`, `LIST_LIMITS`; Task 3 primitives; `ProgressBar`.
- Produces:
  - `interface ConsistencyItem { traineeId: string; traineeName: string; sessions: number; expected: number; adherence: number }` (`adherence` in 0..1)
  - `getConsistencyRanking(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<ConsistencyItem[]>` (top 5)
  - default async `ConsistencyRankingWidget({ ctx })`

Rules, with `today = startOfUtcDay(now)`:
- window = the last 28 calendar days including today: `windowStart = today − 27 days`
- program used = the trainee's most recently started `active` program with `startDate ≤ now`; trainees without one are excluded
- `from = max(windowStart, startOfUtcDay(program.startDate))`
- `elapsedWeeks = clamp(ceil((wholeDaysBetween(from, today) + 1) / 7), 1, 4)`
- `expected = workoutsPerWeek × elapsedWeeks`; `sessions` = sessions with `day ≥ from`; `adherence = min(1, sessions / expected)` (0 when `expected` is 0)
- order: adherence desc, sessions desc, name asc

- [ ] **Step 1: Write the failing query test**

`tests/unit/trainer-dashboard/consistency-ranking.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const program = (traineeId: string, startDate: string, workoutsPerWeek: number) => ({
    traineeId,
    startDate: day(startDate),
    workoutsPerWeek,
})

const sessionOn = (traineeId: string, workoutId: string, date: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
})

const trainees = [...TRAINEES, makeTrainee('t4', 'Bruno', 'Neri')]

describe('getConsistencyRanking', () => {
    it('queries active started programs and the last 28 days of feedback', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([program('t1', '2026-08-01', 3)] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        await getConsistencyRanking('trainer-1', trainees, NOW)

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: 'active', startDate: { lte: NOW } },
            select: { traineeId: true, startDate: true, workoutsPerWeek: true },
            orderBy: { startDate: 'desc' },
        })
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1'] }, date: { gte: day('2026-09-06') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
            },
        })
    })

    it('computes adherence over 4 weeks, or over the elapsed weeks for a recent program, capped at 100%', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            program('t1', '2026-08-01', 3), // full window: expected 12
            program('t2', '2026-09-24', 2), // started 10 days ago: 2 weeks → expected 4
            program('t3', '2026-08-01', 3), // deactivated trainee → ignored
            program('t4', '2026-08-01', 1), // expected 4, over-delivers
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            ...['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map((workoutId, index) => sessionOn('t1', workoutId, `2026-09-${10 + index}`)),
            sessionOn('t1', 'old', '2026-09-05'), // before the window: the query would not return it, and it is ignored anyway
            sessionOn('t2', 'w1', '2026-09-23'), // before t2's program start → ignored
            sessionOn('t2', 'w2', '2026-09-25'),
            sessionOn('t2', 'w3', '2026-10-01'),
            sessionOn('t2', 'w4', '2026-10-02'),
            ...['a', 'b', 'c', 'd', 'e'].map((workoutId, index) => sessionOn('t4', workoutId, `2026-09-2${index}`)),
        ] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([
            { traineeId: 't4', traineeName: 'Bruno Neri', sessions: 5, expected: 4, adherence: 1 },
            { traineeId: 't2', traineeName: 'Luca Bianchi', sessions: 3, expected: 4, adherence: 0.75 },
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 6, expected: 12, adherence: 0.5 },
        ])
    })

    it('uses only the most recently started active program per trainee', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            program('t1', '2026-09-28', 4), // newest first (orderBy startDate desc)
            program('t1', '2026-06-01', 2),
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([sessionOn('t1', 'w1', '2026-09-29')] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 1, expected: 4, adherence: 0.25 },
        ])
    })

    it('keeps the top 5 and breaks ties by sessions then name', async () => {
        const many = Array.from({ length: 7 }, (_, index) => makeTrainee(`n${index}`, `Name${index}`, 'Z'))
        prismaMock.trainingProgram.findMany.mockResolvedValue(many.map((trainee) => program(trainee.id, '2026-08-01', 0)) as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        const items = await getConsistencyRanking('trainer-1', many, NOW)

        expect(items).toHaveLength(5)
        expect(items.every((item) => item.adherence === 0)).toBe(true)
        expect(items.map((item) => item.traineeName)).toEqual(['Name0 Z', 'Name1 Z', 'Name2 Z', 'Name3 Z', 'Name4 Z'])
    })

    it('skips the feedback query when no active trainee has a started program', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([program('t3', '2026-08-01', 3)] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/trainer-dashboard/consistency-ranking.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement `consistency-ranking.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { CONSISTENCY_WEEKS, LIST_LIMITS } from './constants'
import { addDays, startOfUtcDay, utcDayKey, wholeDaysBetween } from './dates'
import { SESSION_FEEDBACK_SELECT, groupSessions } from './sessions'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface ConsistencyItem {
    traineeId: string
    traineeName: string
    sessions: number
    expected: number
    /** 0..1, capped */
    adherence: number
}

export async function getConsistencyRanking(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<ConsistencyItem[]> {
    const today = startOfUtcDay(now)
    const windowStart = addDays(today, -(7 * CONSISTENCY_WEEKS - 1))
    const activeIds = new Set(activeTraineeIds(trainees))

    const programs = await prisma.trainingProgram.findMany({
        where: { trainerId, status: 'active', startDate: { lte: now } },
        select: { traineeId: true, startDate: true, workoutsPerWeek: true },
        orderBy: { startDate: 'desc' },
    })

    // newest first: the first program seen per trainee is the current one
    const current = new Map<string, { startDate: Date; workoutsPerWeek: number }>()
    for (const program of programs) {
        if (!program.startDate || !activeIds.has(program.traineeId) || current.has(program.traineeId)) continue
        current.set(program.traineeId, { startDate: program.startDate, workoutsPerWeek: program.workoutsPerWeek })
    }
    if (current.size === 0) return []

    const rows = await prisma.exerciseFeedback.findMany({
        where: { traineeId: { in: [...current.keys()] }, date: { gte: windowStart } },
        select: SESSION_FEEDBACK_SELECT,
    })
    const sessions = groupSessions(rows)
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))

    const items: ConsistencyItem[] = [...current.entries()].map(([traineeId, program]) => {
        const programStart = startOfUtcDay(program.startDate)
        const from = programStart > windowStart ? programStart : windowStart
        const elapsedWeeks = Math.min(
            CONSISTENCY_WEEKS,
            Math.max(1, Math.ceil((wholeDaysBetween(from, today) + 1) / 7)),
        )
        const expected = program.workoutsPerWeek * elapsedWeeks
        const fromKey = utcDayKey(from)
        const done = sessions.filter((session) => session.traineeId === traineeId && session.day >= fromKey).length
        const trainee = byId.get(traineeId)

        return {
            traineeId,
            traineeName: trainee ? fullName(trainee) : '',
            sessions: done,
            expected,
            adherence: expected > 0 ? Math.min(1, done / expected) : 0,
        }
    })

    return items
        .sort(
            (left, right) =>
                right.adherence - left.adherence ||
                right.sessions - left.sessions ||
                left.traineeName.localeCompare(right.traineeName),
        )
        .slice(0, LIST_LIMITS.ranking)
}
```

Check the t2 case by hand: program start 24 Sep, today 3 Oct → `wholeDaysBetween = 9`, `(9 + 1) / 7 = 1.43` → 2 weeks → expected 4; sessions on or after 24 Sep: 25 Sep, 1 Oct, 2 Oct = 3 → 0.75. Window start: 3 Oct − 27 days = 6 Sep.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/trainer-dashboard/consistency-ranking.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the failing widget tests**

In `widgets-phase2.test.tsx` add:

```tsx
vi.mock('@/lib/trainer-dashboard/consistency-ranking', () => ({ getConsistencyRanking: vi.fn() }))
```

```tsx
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import ConsistencyRankingWidget from '@/app/trainer/dashboard/_widgets/ConsistencyRankingWidget'
```

Append:

```tsx
describe('ConsistencyRankingWidget', () => {
    it('ranks trainees with medals for the top three and a sessions label', async () => {
        vi.mocked(getConsistencyRanking).mockResolvedValue([
            { traineeId: 't4', traineeName: 'Bruno Neri', sessions: 5, expected: 4, adherence: 1 },
            { traineeId: 't2', traineeName: 'Luca Bianchi', sessions: 3, expected: 4, adherence: 0.75 },
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 6, expected: 12, adherence: 0.5 },
            { traineeId: 't5', traineeName: 'Carla Blu', sessions: 1, expected: 12, adherence: 1 / 12 },
        ])

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Classifica costanza' })
        const rows = within(region).getAllByRole('listitem')
        expect(getConsistencyRanking).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(rows).toHaveLength(4)
        expect(rows[0]).toHaveTextContent('Bruno Neri')
        expect(rows[0]).toHaveTextContent('5 / 4 sessioni')
        expect(rows[0]).toHaveTextContent('100%')
        expect(within(rows[0]).getByTestId('medal-1')).toBeInTheDocument()
        expect(within(rows[2]).getByTestId('medal-3')).toBeInTheDocument()
        expect(within(rows[3]).queryByTestId(/medal/)).not.toBeInTheDocument()
        expect(rows[3]).toHaveTextContent('4')
    })

    it('shows the empty state', async () => {
        vi.mocked(getConsistencyRanking).mockResolvedValue([])

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun atleta con un programma attivo.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getConsistencyRanking).mockRejectedValue(new Error('db down'))

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Classifica costanza' })).getByRole('alert')).toBeInTheDocument()
    })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: FAIL — cannot resolve `ConsistencyRankingWidget`.

- [ ] **Step 7: Implement `ConsistencyRankingWidget.tsx`**

`data-testid` is used on the medals because the icon has no text and no accessible role.

```tsx
import { Medal, Users } from 'lucide-react'
import ProgressBar from '@/components/ProgressBar'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-700']

export default async function ConsistencyRankingWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.consistency.title')
    const icon = <Medal className="h-5 w-5" />
    const result = await loadWidget('consistency-ranking', () => getConsistencyRanking(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.consistency.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Users className="h-8 w-8" />} message={t('trainerDashboard.consistency.empty')} />
            ) : (
                <ol className="space-y-4">
                    {items.map((item, index) => (
                        <li key={item.traineeId} className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold text-gray-500">
                                {index < MEDAL_COLORS.length ? (
                                    <Medal className={`h-6 w-6 ${MEDAL_COLORS[index]}`} aria-hidden="true" data-testid={`medal-${index + 1}`} />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <ProgressBar
                                current={Math.min(item.sessions, item.expected)}
                                total={item.expected}
                                label={`${item.traineeName} · ${t('trainerDashboard.consistency.sessions', { done: item.sessions, expected: item.expected })}`}
                                labelClassName="text-sm text-gray-700"
                                size="sm"
                                color={item.adherence >= 0.8 ? 'success' : item.adherence >= 0.5 ? 'warning' : 'danger'}
                                className="min-w-0 flex-1"
                            />
                        </li>
                    ))}
                </ol>
            )}
        </WidgetCard>
    )
}
```

`ProgressBar` prints its percentage from `current / total`, so capping `current` at `expected` keeps it at "100%" for over-delivering trainees, while the label still shows the real "5 / 4".

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/trainer-dashboard/consistency-ranking.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx`
Expected: PASS. If `rows[3]` "4" matches too loosely (the label "1 / 12" contains no 4, the rank does), keep it; if it is ambiguous, assert on the rank `span` instead.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trainer-dashboard/consistency-ranking.ts src/app/trainer/dashboard/_widgets/ConsistencyRankingWidget.tsx tests/unit/trainer-dashboard/consistency-ranking.test.ts tests/unit/trainer-dashboard/widgets-phase2.test.tsx
git commit -m "feat(trainer-home): add consistency ranking widget"
```

---

### Task 12: Final layout, E2E, CHANGELOG, verification

**Files:**
- Modify: `src/app/trainer/dashboard/page.tsx` (imports and grid only)
- Modify: `tests/e2e/trainer-dashboard.spec.ts`
- Modify: `implementation-docs/CHANGELOG.md` (our entry only)

**Interfaces:**
- Consumes: Tasks 7–11.
- Produces: the final home, matching the spec layout.

- [ ] **Step 1: Switch `page.tsx` to the final grid**

Add the imports next to the existing widget imports:

```tsx
import ActivityFeedWidget from './_widgets/ActivityFeedWidget'
import ConsistencyRankingWidget from './_widgets/ConsistencyRankingWidget'
import NewRecordsWidget from './_widgets/NewRecordsWidget'
import WeeklyTrendWidget from './_widgets/WeeklyTrendWidget'
```

Replace the grid `<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">…</div>` with:

```tsx
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Slot span={2}>
                        <TodoTodayWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <NewRecordsWidget ctx={ctx} />
                    </Slot>
                    <Slot span={2}>
                        <RecentFeedbackWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <InactiveTraineesWidget ctx={ctx} />
                    </Slot>
                    <Slot span={2}>
                        <WeeklyTrendWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <ConsistencyRankingWidget ctx={ctx} />
                    </Slot>
                    <Slot span={3}>
                        <ActivityFeedWidget ctx={ctx} />
                    </Slot>
                </div>
```

- [ ] **Step 2: Extend the E2E region list**

In `tests/e2e/trainer-dashboard.spec.ts` replace the `for (const name of [...])` array with:

```ts
        for (const name of [
            /da fare oggi|to do today/i,
            /nuovi record|new records/i,
            /feedback recenti|recent feedback/i,
            /atleti inattivi|inactive athletes/i,
            /andamento ultime 8 settimane|last 8 weeks/i,
            /classifica costanza|consistency ranking/i,
            /attività recente|recent activity/i,
        ]) {
```

- [ ] **Step 3: Type-check, lint, dashboard tests**

Run: `npm run type-check && npm run lint && npx vitest run tests/unit/trainer-dashboard`
Expected: clean, all PASS.

- [ ] **Step 4: Check for emoji in the new code and strings**

Run: `grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/lib/trainer-dashboard src/app/trainer/dashboard public/locales/it/trainer.json public/locales/en/trainer.json | grep -i dashboard`
Expected: no output.

- [ ] **Step 5: E2E, if the environment allows**

Run: `npx playwright test tests/e2e/trainer-dashboard.spec.ts tests/e2e/trainer-subscription-renewals.spec.ts`
Expected: PASS, or "E2E not run: no DB access from WSL" in the report (same rule as Task 7).

- [ ] **Step 6: CHANGELOG entry for Phase 2**

Same technique as Task 7 Step 6. This time `HEAD` already contains the Phase 1 entry, so the new entry goes on top of it:

```bash
SCRATCH=/tmp/claude-1000/-mnt-c-dev-projects-zero-cento-project/3760ee0a-e73b-4ad2-b1f5-6bcd4c0288d5/scratchpad
git show HEAD:implementation-docs/CHANGELOG.md > "$SCRATCH/changelog-head.md"
python3 - "$SCRATCH/changelog-head.md" implementation-docs/CHANGELOG.md <<'EOF'
import sys
entry = (
    "### [3 Ottobre 2026] — Home trainer: Fase 2 (attività, record, andamento, costanza)\r\n"
    "\r\n"
    "**File modificati:** `src/app/trainer/dashboard/page.tsx`, `src/app/trainer/dashboard/_widgets/{ActivityFeed,NewRecords,WeeklyTrend,ConsistencyRanking}Widget.tsx` (nuovi), "
    "`src/app/trainer/dashboard/_widgets/WeeklyTrendChart.tsx` (nuovo), `src/lib/trainer-dashboard/{activity-feed,new-records,weekly-trend,consistency-ranking}.ts` (nuovi), "
    "`tests/unit/trainer-dashboard/*`, `tests/e2e/trainer-dashboard.spec.ts`, `implementation-docs/CHANGELOG.md`\r\n"
    "**Note:** Completa il redesign della home trainer. Feed delle sessioni degli ultimi 7 giorni raggruppate per giorno, con badge sui giorni con un nuovo record; "
    "nuovi record personali con il miglioramento rispetto al record precedente sullo stesso esercizio e numero di ripetizioni; grafico recharts delle ultime 8 settimane "
    "(barre = sessioni, linea = volume reps × kg delle serie completate); classifica costanza = sessioni delle ultime 4 settimane ÷ (allenamenti a settimana × settimane trascorse), "
    "con tetto al 100%. Layout finale a 3 colonne desktop come da spec.\r\n"
)
anchor = b"### Changed\r\n"
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    if anchor not in data:
        sys.exit(f"{path}: anchor '### Changed' (CRLF) not found")
    data = data.replace(anchor, anchor + entry.encode("utf-8"), 1)
    open(path, "wb").write(data)
EOF
blob=$(git hash-object -w "$SCRATCH/changelog-head.md")
git update-index --cacheinfo 100644,"$blob",implementation-docs/CHANGELOG.md
git diff --cached --stat implementation-docs/CHANGELOG.md
```

Expected: `1 file changed, 4 insertions(+)`.

- [ ] **Step 7: Full unit suite with coverage, then build**

Run: `npm run test:unit -- --coverage`
Expected: all PASS, thresholds hold. If coverage rose, raise the floor of the group that rose in `vitest.config.ts` in this same commit (never lower it), as the testing standards require.

Run: `npm run build`
Expected: success. Then `git status --short package-lock.json` and restore it if the build rewrote it.

- [ ] **Step 8: Commit**

```bash
git add src/app/trainer/dashboard/page.tsx tests/e2e/trainer-dashboard.spec.ts
# only if Step 7 raised a floor:
# git add vitest.config.ts
git commit -m "feat(trainer-home): complete home layout with activity, records, trend and ranking (phase 2)"
git status --short
```

Expected `git status`: only the user's pre-existing changes (` M implementation-docs/CHANGELOG.md`, ` M src/app/trainer/trainees/[id]/_content.tsx`).

Nothing is pushed or merged: integrating into `development` follows `git-pr-workflow` and happens only when the user asks.
