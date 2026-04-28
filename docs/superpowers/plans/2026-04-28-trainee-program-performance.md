# Trainee Program Detail Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut perceived load time of `/trainee/programs/[id]` and `/trainee/programs/current` from multi-second to sub-second by removing over-fetch, replacing tree-load with SQL aggregates, eliminating the client→server→client API hop, and adding focus-driven refetch via TanStack Query.

**Architecture:** Three layers of fix.
1. **Backend slimming**: condense `[id]` includes for trainee role, replace `[id]/progress` tree-load with `$queryRaw` aggregates, expose a one-row `GET /api/trainee/active-program` so `/current` skips the full list endpoint.
2. **Skip the HTTP detour for the initial paint**: trainee page becomes a server component that calls Prisma directly, passing pre-resolved data as props.
3. **Client refresh**: TanStack Query takes over post-hydration refetches (focus / visibility) and deduplicates with `staleTime`. Consolidate the three render-causing `useEffect` hooks into derived state.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth (`getSession`), Vitest (unit/integration), Playwright (e2e), TanStack Query v5, react-i18next, Tailwind.

---

## File Structure

**Modified:**
- `src/app/api/programs/[id]/route.ts` — slim trainee exercise select; conditional PR map.
- `src/app/api/programs/[id]/progress/route.ts` — replace nested tree fetch with `$queryRaw` aggregates + targeted set-performed query.
- `src/app/trainee/programs/[id]/page.tsx` — server-component direct Prisma fetch; pass props.
- `src/app/trainee/programs/[id]/_content.tsx` — accept pre-fetched props instead of `programId`-only.
- `src/app/trainee/programs/current/page.tsx` — server-component direct Prisma fetch + redirect-on-missing.
- `src/app/trainee/programs/current/_content.tsx` — accept pre-fetched props.
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx` — accept hydrated props; switch to TanStack Query for refresh; consolidate effects.

**Created:**
- `src/app/api/trainee/active-program/route.ts` — single-query lookup for active programId.
- `src/lib/trainee-program-data.ts` — shared server helper that loads `program + progress` in one go (used by both server components).
- `tests/integration/program-detail.test.ts` — covers `GET /api/programs/[id]` trainee branch (slim select + conditional PR).
- `tests/integration/program-progress.test.ts` — covers `GET /api/programs/[id]/progress` aggregates.
- `tests/integration/trainee-active-program.test.ts` — covers the new endpoint.
- `tests/unit/lib/trainee-program-data.test.ts` — covers the shared helper.

**Untouched (verify still green):** existing trainee workout routes, trainer routes, e2e specs not under `programs/[id]`.

---

## Conventions

- Tests: Vitest with `vi.mock('@/lib/auth')` and `vi.mock('@/lib/prisma')` per existing pattern in `tests/integration/programs.test.ts`. Reuse `mockTraineeSession` from `tests/integration/fixtures.ts`.
- Run a single test file: `npx vitest run tests/integration/<file>.test.ts`.
- Type-check after each task: `npm run type-check`.
- Lint after each task: `npm run lint`.
- Commit after each task. Conventional Commits: `perf(trainee): ...`, `feat(api): ...`, `refactor(trainee): ...`.
- Update `implementation-docs/CHANGELOG.md` once per task with a 1-line entry.

---

## Task 1: Conditional PR map load in `GET /api/programs/[id]`

Skip `loadTraineePrMap` when no exercise needs it. PR map is only used to resolve `percentage_1rm`, `percentage_rm`, `percentage_previous`. If every exercise is `absolute`, the map is wasted I/O.

**Files:**
- Modify: `src/app/api/programs/[id]/route.ts:99-149`
- Test: `tests/integration/program-detail.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/integration/program-detail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        personalRecord: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/programs/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1') {
    return new NextRequest(url)
}

const baseExercise = {
    id: 'we-1',
    workoutId: 'w-1',
    exerciseId: 'ex-1',
    sets: 3,
    reps: '8',
    targetRpe: 8,
    weightType: 'absolute' as const,
    weight: 100,
    effectiveWeight: 100,
    restTime: 'm2' as const,
    isWarmup: false,
    isSkeletonExercise: false,
    notes: null,
    variant: null,
    order: 1,
    exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' as const },
}

describe('GET /api/programs/[id] — trainee branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    })

    it('skips PR map fetch when all exercises are absolute', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'normal',
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            workoutExercises: [baseExercise],
                        },
                    ],
                },
            ],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(100)
        expect(prisma.personalRecord.findMany).not.toHaveBeenCalled()
    })

    it('fetches PR map when at least one exercise needs resolution', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'normal',
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            workoutExercises: [
                                { ...baseExercise, weightType: 'percentage_1rm', weight: 80, effectiveWeight: null },
                            ],
                        },
                    ],
                },
            ],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })
        ;(prisma.personalRecord.findMany as any).mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 150, recordDate: new Date() },
        ])

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(120)
        expect(prisma.personalRecord.findMany).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/program-detail.test.ts`
Expected: FAIL — first test will fail because current code calls `loadTraineePrMap` unconditionally (`prisma.personalRecord.findMany` will fire).

- [ ] **Step 3: Make PR map load conditional**

Modify `src/app/api/programs/[id]/route.ts`. Replace the trainee branch (current lines 99-149) with:

```ts
let resolvedProgram = program

if (session.user.role === 'trainee') {
    const needsPrMap = program.weeks.some((week) =>
        week.workouts.some((workout) =>
            workout.workoutExercises.some((we) => we.weightType !== 'absolute')
        )
    )

    const prMap = needsPrMap ? await loadTraineePrMap(session.user.id) : new Map<string, number>()

    const resolvedWeeks = program.weeks.map((week) => ({
        ...week,
        workouts: week.workouts.map((workout) => {
            const siblings = workout.workoutExercises
            return {
                ...workout,
                workoutExercises: workout.workoutExercises.map((workoutExercise) => {
                    if (typeof workoutExercise.effectiveWeight === 'number') {
                        return workoutExercise
                    }

                    if (workoutExercise.weightType === 'absolute') {
                        return {
                            ...workoutExercise,
                            effectiveWeight: workoutExercise.weight,
                        }
                    }

                    try {
                        const effectiveWeight = resolveEffectiveWeight(
                            workoutExercise,
                            prMap,
                            siblings
                        )
                        return { ...workoutExercise, effectiveWeight }
                    } catch (calculationError: unknown) {
                        logger.warn(
                            {
                                programId,
                                workoutExerciseId: workoutExercise.id,
                                error:
                                    calculationError instanceof Error
                                        ? calculationError.message
                                        : String(calculationError),
                            },
                            'Failed to resolve effective weight while fetching program details'
                        )
                        return { ...workoutExercise, effectiveWeight: null }
                    }
                }),
            }
        }),
    }))

    resolvedProgram = { ...program, weeks: resolvedWeeks }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/integration/program-detail.test.ts`
Expected: PASS — both tests green.

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 5: Update CHANGELOG and commit**

Edit `implementation-docs/CHANGELOG.md`, add at the top under today's date:

```
- perf(api/programs): skip PR map fetch in `GET /api/programs/[id]` when all exercises use weightType=absolute. Saves one Prisma round-trip on programs that don't reference 1RM/RM data.
```

```bash
git add src/app/api/programs/[id]/route.ts tests/integration/program-detail.test.ts implementation-docs/CHANGELOG.md
git commit -m "perf(api/programs): skip PR map fetch when all exercises are absolute"
```

---

## Task 2: Slim trainee exercise select in `GET /api/programs/[id]`

Trainee client only reads `exercise.id`, `exercise.name`, `exercise.type`. The current handler pulls `movementPattern → movementPatternColors` and `exerciseMuscleGroups → muscleGroup` — three extra joins of unused data. Branch the include shape on role.

**Files:**
- Modify: `src/app/api/programs/[id]/route.ts:22-84`
- Test: `tests/integration/program-detail.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/program-detail.test.ts`:

```ts
describe('GET /api/programs/[id] — trainee select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })
    })

    it('does not include movementPattern/exerciseMuscleGroups when role is trainee', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise

        // Trainee branch must use `select`, not `include` with movementPattern.
        expect(exerciseInclude.include).toBeUndefined()
        expect(exerciseInclude.select).toEqual({ id: true, name: true, type: true })
    })
})
```

Add admin/trainer counterpart test to assert the rich include is preserved:

```ts
import { mockAdminSession } from './fixtures'

describe('GET /api/programs/[id] — admin select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockAdminSession)
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: 'trainee-1',
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: 'trainee-1', firstName: 'M', lastName: 'A' },
        })
    })

    it('keeps full movementPattern + exerciseMuscleGroups include', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise.include

        expect(exerciseInclude.movementPattern).toBeDefined()
        expect(exerciseInclude.exerciseMuscleGroups).toBeDefined()
    })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/integration/program-detail.test.ts`
Expected: trainee shape test FAILS (current code always uses the rich include).

- [ ] **Step 3: Branch the include shape on role**

In `src/app/api/programs/[id]/route.ts` modify the GET handler. Build the exercise include before the `findUnique`:

```ts
const isTrainee = (await requireRole(['admin', 'trainer', 'trainee'])).user.role === 'trainee'
```

Wait — `requireRole` is already called for `session`. Restructure:

```ts
const session = await requireRole(['admin', 'trainer', 'trainee'])

const exerciseSelector =
    session.user.role === 'trainee'
        ? { select: { id: true, name: true, type: true } }
        : {
              include: {
                  movementPattern: {
                      select: {
                          id: true,
                          name: true,
                          movementPatternColors: {
                              select: { color: true, trainerId: true },
                          },
                      },
                  },
                  exerciseMuscleGroups: {
                      include: {
                          muscleGroup: { select: { id: true, name: true } },
                      },
                  },
              },
          }

const program = await prisma.trainingProgram.findUnique({
    where: { id: programId },
    include: {
        trainer: { select: { id: true, firstName: true, lastName: true } },
        trainee: { select: { id: true, firstName: true, lastName: true } },
        weeks: {
            include: {
                workouts: {
                    include: {
                        workoutExercises: {
                            include: { exercise: exerciseSelector as any },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
            orderBy: { weekNumber: 'asc' },
        },
    },
})
```

Note: `exerciseSelector as any` because Prisma's typing rejects mixing `include` and `select` at the same key. The runtime accepts whichever shape is provided. The shape itself is one or the other per branch, never mixed.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/integration/program-detail.test.ts`
Expected: all tests PASS.

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 5: Update CHANGELOG and commit**

```
- perf(api/programs): role-aware exercise include in `GET /api/programs/[id]`. Trainees now get a slim `{id, name, type}` select instead of the full movementPattern + muscleGroup tree.
```

```bash
git add src/app/api/programs/[id]/route.ts tests/integration/program-detail.test.ts implementation-docs/CHANGELOG.md
git commit -m "perf(api/programs): slim exercise select for trainee role"
```

---

## Task 3: Replace `GET /api/programs/[id]/progress` tree-load with SQL aggregates

Single biggest win. Current handler loads every `exerciseFeedback + setsPerformed` row in the program to compute counts. Replace with focused SQL.

**Files:**
- Modify: `src/app/api/programs/[id]/progress/route.ts`
- Test: `tests/integration/program-progress.test.ts` (create)

### Background — output shape (must remain stable)

```ts
{
  programId, programName, status,
  currentWeek, totalWeeks,
  completedWorkouts, totalWorkouts,
  feedbackCount, avgRPE, totalVolume,
  nextWorkout: { id, name, weekNumber, weekType, dayOfWeek, exerciseCount, completed, started, feedbackCount, exercisesPerformed } | null,
  workouts: WorkoutEntry[],
  weeklyStats: { weekNumber, weekType, totalVolume, avgRPE, completedWorkouts, totalWorkouts, feedbackCount }[],
}
```

`WorkoutEntry` includes `exercisesPerformed: { workoutExerciseId, performedSets[] }[]` populated from the latest **completed** feedback per exercise.

### Plan

Replace one giant `findUnique` with:
1. Slim metadata fetch — `findUnique({ select: { id, title, status, startDate, durationWeeks, trainerId, traineeId } })`.
2. RBAC check.
3. Workouts skeleton — `prisma.workout.findMany({ where: { week: { programId } }, select: { id, dayIndex, week: { select: { weekNumber, weekType } } }, orderBy: ... })`.
4. Per-workout completion + feedbackCount + exercise count via single `$queryRaw` CTE (mirrors the one already in `src/app/api/programs/route.ts:150-172`).
5. Latest completed feedback set rows via one targeted query (`DISTINCT ON` per `(workoutExerciseId, traineeId)` filtered to `completed`).
6. Weekly + program aggregates: `exerciseFeedback.aggregate` (one row, `_avg.actualRpe`, `_count`) and `$queryRaw SUM(reps*weight)` grouped by week.

- [ ] **Step 1: Create test scaffold**

Create `tests/integration/program-progress.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn() },
        workout: { findMany: vi.fn() },
        exerciseFeedback: { aggregate: vi.fn(), findMany: vi.fn() },
        setPerformed: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/programs/[id]/progress/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1/progress') {
    return new NextRequest(url)
}

const programMeta = {
    id: 'prog-1',
    title: 'Test',
    status: 'active' as const,
    startDate: new Date('2026-04-01'),
    durationWeeks: 4,
    trainerId: 'trainer-1',
    traineeId: mockTraineeSession.user.id,
}

beforeEach(() => {
    vi.clearAllMocks()
    ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    ;(prisma.trainingProgram.findUnique as any).mockResolvedValue(programMeta)
    ;(prisma.workout.findMany as any).mockResolvedValue([])
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.exerciseFeedback.aggregate as any).mockResolvedValue({
        _avg: { actualRpe: null },
        _count: { _all: 0 },
    })
    ;(prisma.setPerformed.findMany as any).mockResolvedValue([])
})
```

- [ ] **Step 2: Write failing test for shape stability (no nested includes)**

Append:

```ts
describe('GET /api/programs/[id]/progress', () => {
    it('does not load full program tree (no nested workoutExercises include)', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        // metadata fetch must use `select`, never `include` with weeks
        expect(call.include).toBeUndefined()
        expect(call.select).toBeDefined()
        expect(call.select.weeks).toBeUndefined()
    })

    it('returns the documented response shape with zero data', async () => {
        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toMatchObject({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            totalWeeks: 4,
            completedWorkouts: 0,
            totalWorkouts: 0,
            feedbackCount: 0,
            avgRPE: null,
            totalVolume: 0,
            nextWorkout: null,
            workouts: [],
            weeklyStats: [],
        })
    })

    it('aggregates completion counts per workout from $queryRaw rows', async () => {
        ;(prisma.workout.findMany as any).mockResolvedValue([
            { id: 'w-1', dayIndex: 1, week: { weekNumber: 1, weekType: 'normal' } },
            { id: 'w-2', dayIndex: 2, week: { weekNumber: 1, weekType: 'normal' } },
        ])
        ;(prisma.$queryRaw as any).mockImplementation((_strings: any) => {
            // First call: workout completion. Second call: weekly volume.
            const callIndex = (prisma.$queryRaw as any).mock.calls.length
            if (callIndex === 1) {
                return Promise.resolve([
                    {
                        workoutId: 'w-1',
                        weekNumber: 1,
                        exerciseCount: 3,
                        completedExerciseCount: 3,
                        startedFeedbackCount: 3,
                    },
                    {
                        workoutId: 'w-2',
                        weekNumber: 1,
                        exerciseCount: 3,
                        completedExerciseCount: 1,
                        startedFeedbackCount: 2,
                    },
                ])
            }
            return Promise.resolve([
                { weekNumber: 1, totalVolume: 5000 },
            ])
        })
        ;(prisma.exerciseFeedback.aggregate as any).mockResolvedValue({
            _avg: { actualRpe: 8.4 },
            _count: { _all: 5 },
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.totalWorkouts).toBe(2)
        expect(json.data.completedWorkouts).toBe(1)
        expect(json.data.avgRPE).toBe(8.4)
        expect(json.data.feedbackCount).toBe(5)
        expect(json.data.totalVolume).toBe(5000)
        expect(json.data.workouts).toHaveLength(2)
        expect(json.data.workouts[0]).toMatchObject({
            id: 'w-1',
            completed: true,
            started: true,
            feedbackCount: 3,
            exerciseCount: 3,
        })
        expect(json.data.weeklyStats[0]).toMatchObject({
            weekNumber: 1,
            totalVolume: 5000,
            avgRPE: 8.4,
            completedWorkouts: 1,
            totalWorkouts: 2,
        })
    })

    it('populates exercisesPerformed from latest completed feedback set rows', async () => {
        ;(prisma.workout.findMany as any).mockResolvedValue([
            { id: 'w-1', dayIndex: 1, week: { weekNumber: 1, weekType: 'normal' } },
        ])
        ;(prisma.$queryRaw as any).mockResolvedValueOnce([
            { workoutId: 'w-1', weekNumber: 1, exerciseCount: 1, completedExerciseCount: 1, startedFeedbackCount: 1 },
        ]).mockResolvedValueOnce([])
        ;(prisma.setPerformed.findMany as any).mockResolvedValue([
            {
                setNumber: 1,
                reps: 8,
                weight: 100,
                completed: true,
                feedback: { workoutExerciseId: 'we-1', workoutExercise: { workoutId: 'w-1' } },
            },
            {
                setNumber: 2,
                reps: 8,
                weight: 100,
                completed: true,
                feedback: { workoutExerciseId: 'we-1', workoutExercise: { workoutId: 'w-1' } },
            },
        ])

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(json.data.workouts[0].exercisesPerformed).toEqual([
            {
                workoutExerciseId: 'we-1',
                performedSets: [
                    { setNumber: 1, reps: 8, weight: 100 },
                    { setNumber: 2, reps: 8, weight: 100 },
                ],
            },
        ])
    })
})
```

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run tests/integration/program-progress.test.ts`
Expected: FAIL — current implementation doesn't call `prisma.workout.findMany` with the new shape; it loads `weeks` nested instead.

- [ ] **Step 4: Rewrite the handler**

Replace `src/app/api/programs/[id]/progress/route.ts` with:

```ts
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface CompletionRow {
    workoutId: string
    weekNumber: number
    exerciseCount: number
    completedExerciseCount: number
    startedFeedbackCount: number
}

interface WeeklyVolumeRow {
    weekNumber: number
    totalVolume: number
}

interface PerformedSetRow {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
    feedback: {
        workoutExerciseId: string
        workoutExercise: { workoutId: string }
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                trainerId: true,
                traineeId: true,
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }
        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        let currentWeek = 1
        if (program.startDate && program.status === 'active') {
            const today = new Date()
            const daysSinceStart = Math.floor(
                (today.getTime() - new Date(program.startDate).getTime()) / (1000 * 60 * 60 * 24)
            )
            currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, program.durationWeeks)
        }

        const workouts = await prisma.workout.findMany({
            where: { week: { programId } },
            select: {
                id: true,
                dayIndex: true,
                week: { select: { weekNumber: true, weekType: true } },
            },
            orderBy: [{ week: { weekNumber: 'asc' } }, { dayIndex: 'asc' }],
        })

        const completionRows = await prisma.$queryRaw<CompletionRow[]>`
            SELECT
                wk."id" AS "workoutId",
                w."weekNumber" AS "weekNumber",
                COUNT(we."id")::int AS "exerciseCount",
                COUNT(DISTINCT CASE WHEN ef."completed" THEN we."id" END)::int AS "completedExerciseCount",
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "sets_performed" sp
                        WHERE sp."feedbackId" = ef."id" AND sp."completed" = true
                    ) THEN we."id"
                END)::int AS "startedFeedbackCount"
            FROM "workouts" wk
            JOIN "weeks" w ON w."id" = wk."weekId"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
            WHERE w."programId" = ${programId}
            GROUP BY wk."id", w."weekNumber"
        `

        const weeklyVolumeRows = await prisma.$queryRaw<WeeklyVolumeRow[]>`
            SELECT
                w."weekNumber" AS "weekNumber",
                COALESCE(SUM(sp."reps" * sp."weight"), 0)::int AS "totalVolume"
            FROM "weeks" w
            LEFT JOIN "workouts" wk ON wk."weekId" = w."id"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id" AND ef."completed" = true
            LEFT JOIN "sets_performed" sp ON sp."feedbackId" = ef."id"
            WHERE w."programId" = ${programId}
            GROUP BY w."weekNumber"
            ORDER BY w."weekNumber" ASC
        `

        const programAgg = await prisma.exerciseFeedback.aggregate({
            where: {
                workoutExercise: { workout: { week: { programId } } },
                completed: true,
            },
            _avg: { actualRpe: true },
            _count: { _all: true },
        })

        const performedRows = await prisma.setPerformed.findMany({
            where: {
                completed: true,
                feedback: {
                    completed: true,
                    workoutExercise: { workout: { week: { programId } } },
                },
            },
            select: {
                setNumber: true,
                reps: true,
                weight: true,
                completed: true,
                feedback: {
                    select: {
                        workoutExerciseId: true,
                        workoutExercise: { select: { workoutId: true } },
                    },
                },
            },
            orderBy: [{ feedback: { date: 'desc' } }, { setNumber: 'asc' }],
        }) as unknown as PerformedSetRow[]

        // De-dup: keep set rows from the most recent completed feedback per workoutExerciseId.
        const exercisesPerformedMap = new Map<string, Map<string, { setNumber: number; reps: number; weight: number }[]>>()
        const seenWorkoutExerciseIds = new Set<string>()
        for (const row of performedRows) {
            const weId = row.feedback.workoutExerciseId
            const workoutId = row.feedback.workoutExercise.workoutId

            if (seenWorkoutExerciseIds.has(weId) === false) {
                if (!exercisesPerformedMap.has(workoutId)) {
                    exercisesPerformedMap.set(workoutId, new Map())
                }
                exercisesPerformedMap.get(workoutId)!.set(weId, [])
            }

            // Continue collecting only if this is the first feedback we saw for this exercise.
            const map = exercisesPerformedMap.get(workoutId)!.get(weId)
            if (map) {
                map.push({ setNumber: row.setNumber, reps: row.reps, weight: row.weight })
            }
            seenWorkoutExerciseIds.add(weId)
        }
        // Sort sets per (workout, exercise) by setNumber ascending.
        for (const exMap of exercisesPerformedMap.values()) {
            for (const sets of exMap.values()) {
                sets.sort((a, b) => a.setNumber - b.setNumber)
            }
        }

        const completionByWorkout = new Map(completionRows.map((r) => [r.workoutId, r]))

        const workoutsList = workouts.map((wk) => {
            const completion = completionByWorkout.get(wk.id)
            const exerciseCount = completion?.exerciseCount ?? 0
            const completedExerciseCount = completion?.completedExerciseCount ?? 0
            const startedFeedbackCount = completion?.startedFeedbackCount ?? 0
            const completed = exerciseCount > 0 && exerciseCount === completedExerciseCount
            const started = startedFeedbackCount > 0

            const exercisesPerformedForWorkout = exercisesPerformedMap.get(wk.id) ?? new Map()
            const exercisesPerformed = Array.from(exercisesPerformedForWorkout.entries()).map(
                ([workoutExerciseId, performedSets]) => ({ workoutExerciseId, performedSets })
            )

            return {
                id: wk.id,
                name: `Giorno ${wk.dayIndex}`,
                weekNumber: wk.week.weekNumber,
                weekType: wk.week.weekType,
                dayOfWeek: wk.dayIndex,
                exerciseCount,
                completed,
                started,
                feedbackCount: startedFeedbackCount,
                exercisesPerformed,
            }
        })

        const totalWorkouts = workoutsList.filter((w) => w.exerciseCount > 0).length
        const completedWorkouts = workoutsList.filter((w) => w.completed).length
        const feedbackCount = workoutsList.reduce((sum, w) => sum + w.feedbackCount, 0)
        const totalVolume = weeklyVolumeRows.reduce((sum, r) => sum + r.totalVolume, 0)
        const avgRPE = programAgg._avg.actualRpe !== null
            ? Math.round(programAgg._avg.actualRpe * 10) / 10
            : null

        const nextWorkout = workoutsList.find((w) => !w.completed) ?? null

        // Per-week aggregates: combine workouts grouped by weekNumber + weekly volume + per-week avg RPE.
        const byWeek = new Map<number, { weekType: string; workouts: typeof workoutsList }>()
        for (const w of workoutsList) {
            if (!byWeek.has(w.weekNumber)) {
                byWeek.set(w.weekNumber, { weekType: w.weekType, workouts: [] })
            }
            byWeek.get(w.weekNumber)!.workouts.push(w)
        }

        const weekRpeRows = await prisma.$queryRaw<Array<{ weekNumber: number; avgRpe: number | null; feedbackCount: number }>>`
            SELECT
                w."weekNumber" AS "weekNumber",
                AVG(ef."actualRpe")::float AS "avgRpe",
                COUNT(ef."id")::int AS "feedbackCount"
            FROM "weeks" w
            LEFT JOIN "workouts" wk ON wk."weekId" = w."id"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id" AND ef."completed" = true
            WHERE w."programId" = ${programId}
            GROUP BY w."weekNumber"
        `
        const rpeByWeek = new Map(weekRpeRows.map((r) => [r.weekNumber, r]))
        const volumeByWeek = new Map(weeklyVolumeRows.map((r) => [r.weekNumber, r.totalVolume]))

        const weeklyStats = Array.from(byWeek.entries())
            .sort(([a], [b]) => a - b)
            .map(([weekNumber, info]) => ({
                weekNumber,
                weekType: info.weekType,
                totalVolume: volumeByWeek.get(weekNumber) ?? 0,
                avgRPE: rpeByWeek.get(weekNumber)?.avgRpe != null
                    ? Math.round(rpeByWeek.get(weekNumber)!.avgRpe! * 10) / 10
                    : null,
                completedWorkouts: info.workouts.filter((w) => w.completed).length,
                totalWorkouts: info.workouts.length,
                feedbackCount: rpeByWeek.get(weekNumber)?.feedbackCount ?? 0,
            }))

        return apiSuccess({
            programId: program.id,
            programName: program.title,
            status: program.status,
            currentWeek,
            totalWeeks: program.durationWeeks,
            completedWorkouts,
            totalWorkouts,
            feedbackCount,
            avgRPE,
            totalVolume,
            nextWorkout,
            workouts: workoutsList,
            weeklyStats,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program progress')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program progress', 500, undefined, 'internal.default')
    }
}
```

Note: `Prisma` import is required only if used by raw SQL — keep import if linter complains, otherwise remove the unused import.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run tests/integration/program-progress.test.ts`
Expected: all tests PASS.

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 6: Smoke-test against dev DB**

Run dev server: `npm run dev`. With a seeded program in the DB, hit `http://localhost:3000/api/programs/<id>/progress` (logged in as the trainee). Compare response shape with the previous behavior captured against the same seed.

(If the response diverges in structure, fix the handler before continuing. Common gotchas: `weekType` enum case, `avgRPE` rounding, week ordering.)

- [ ] **Step 7: Update CHANGELOG and commit**

```
- perf(api/programs): replace tree-load with SQL aggregates in `GET /api/programs/[id]/progress`. Workout completion, weekly volume, and avg RPE now come from $queryRaw + exerciseFeedback.aggregate; latest performed sets via targeted setPerformed.findMany.
```

```bash
git add src/app/api/programs/[id]/progress/route.ts tests/integration/program-progress.test.ts implementation-docs/CHANGELOG.md
git commit -m "perf(api/programs): aggregate program progress in SQL"
```

---

## Task 4: New `GET /api/trainee/active-program` endpoint

`/trainee/programs/current` currently calls `GET /api/programs?status=active&limit=1`. That listing route fires two `$queryRaw` CTEs (workout completion + test weeks). The trainee only needs the active program id.

**Files:**
- Create: `src/app/api/trainee/active-program/route.ts`
- Test: `tests/integration/trainee-active-program.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/integration/trainee-active-program.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession, mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
    requireAuth: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findFirst: vi.fn() },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/active-program/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const makeRequest = () => new NextRequest('http://localhost:3000/api/trainee/active-program')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/trainee/active-program', () => {
    it('returns 200 with id when active program exists', async () => {
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue({ id: 'prog-1' })

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ programId: 'prog-1' })
        expect(prisma.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { traineeId: mockTraineeSession.user.id, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })
    })

    it('returns 404 when no active program', async () => {
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue(null)

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
    })

    it('rejects non-trainees', async () => {
        ;(requireRole as any).mockImplementation(async () => {
            throw new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })
        })

        const res = await GET(makeRequest())
        expect(res.status).toBe(403)
    })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npx vitest run tests/integration/trainee-active-program.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the handler**

Create `src/app/api/trainee/active-program/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(_request: NextRequest) {
    try {
        const session = await requireRole(['trainee'])

        const program = await prisma.trainingProgram.findFirst({
            where: { traineeId: session.user.id, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'No active program', 404, undefined, 'program.notFound')
        }

        return apiSuccess({ programId: program.id })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching active program')
        return apiError('INTERNAL_ERROR', 'Failed to fetch active program', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/integration/trainee-active-program.test.ts`
Expected: PASS.

- [ ] **Step 5: Update CHANGELOG and commit**

```
- feat(api/trainee): add `GET /api/trainee/active-program`. Returns the active program id (or 404), replacing the heavier listing call previously used by /trainee/programs/current.
```

```bash
git add src/app/api/trainee/active-program/route.ts tests/integration/trainee-active-program.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(api/trainee): add lightweight active-program endpoint"
```

---

## Task 5: Shared server data helper for trainee program detail

Build the helper that the server components in Task 6 will call.  Bundles program fetch + progress in one server-side function with the same shape the client component already consumes.

**Files:**
- Create: `src/lib/trainee-program-data.ts`
- Test: `tests/unit/lib/trainee-program-data.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/lib/trainee-program-data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn(), findFirst: vi.fn() },
        workout: { findMany: vi.fn() },
        exerciseFeedback: { aggregate: vi.fn() },
        setPerformed: { findMany: vi.fn() },
        personalRecord: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

import { prisma } from '@/lib/prisma'
import {
    loadTraineeProgramView,
    loadActiveProgramId,
} from '@/lib/trainee-program-data'

const traineeId = 'trainee-1'

beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.workout.findMany as any).mockResolvedValue([])
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.exerciseFeedback.aggregate as any).mockResolvedValue({
        _avg: { actualRpe: null },
        _count: { _all: 0 },
    })
    ;(prisma.setPerformed.findMany as any).mockResolvedValue([])
    ;(prisma.personalRecord.findMany as any).mockResolvedValue([])
})

describe('loadTraineeProgramView', () => {
    it('returns null when program does not exist', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue(null)
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns null when program belongs to another trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId: 'other-trainee',
            trainerId: 't1',
            title: 'X',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns combined { program, progress } for the trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId,
            trainerId: 't1',
            status: 'active',
            title: 'My Program',
            startDate: new Date('2026-04-01'),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).not.toBeNull()
        expect(result!.program.id).toBe('p1')
        expect(result!.progress.programId).toBe('p1')
        expect(result!.progress.totalWorkouts).toBe(0)
    })
})

describe('loadActiveProgramId', () => {
    it('returns the id when active program exists', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue({ id: 'p1' })
        await expect(loadActiveProgramId(traineeId)).resolves.toBe('p1')
    })

    it('returns null otherwise', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue(null)
        await expect(loadActiveProgramId(traineeId)).resolves.toBeNull()
    })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npx vitest run tests/unit/lib/trainee-program-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/trainee-program-data.ts`:

```ts
import { prisma } from './prisma'
import { loadTraineePrMap, resolveEffectiveWeight } from './calculations'
import { logger } from './logger'

export interface TraineeProgramView {
    program: TraineeProgram
    progress: TraineeProgramProgress
}

export interface TraineeProgram {
    id: string
    title: string
    startDate: Date | null
    durationWeeks: number
    trainee: { firstName: string; lastName: string }
    trainer: { firstName: string; lastName: string }
    weeks: Array<{
        weekNumber: number
        weekType: 'normal' | 'test' | 'deload'
        workouts: Array<{
            id: string
            dayIndex: number
            workoutExercises: Array<{
                id: string
                workoutId: string
                exerciseId: string
                variant: string | null
                sets: number
                reps: string
                targetRpe: number | null
                weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
                weight: number | null
                effectiveWeight: number | null
                restTime: 's30' | 'm1' | 'm2' | 'm3' | 'm5'
                isWarmup: boolean
                isSkeletonExercise: boolean
                notes: string | null
                order: number
                exercise: { id: string; name: string; type: 'fundamental' | 'accessory' }
            }>
        }>
    }>
}

export interface TraineeProgramProgress {
    programId: string
    programName: string
    status: string
    currentWeek: number
    totalWeeks: number
    completedWorkouts: number
    totalWorkouts: number
    feedbackCount: number
    avgRPE: number | null
    totalVolume: number
    nextWorkout: WorkoutEntry | null
    workouts: WorkoutEntry[]
    weeklyStats: Array<{
        weekNumber: number
        weekType: string
        totalVolume: number
        avgRPE: number | null
        completedWorkouts: number
        totalWorkouts: number
        feedbackCount: number
    }>
}

interface WorkoutEntry {
    id: string
    name: string
    weekNumber: number
    weekType: string
    dayOfWeek: number
    exerciseCount: number
    completed: boolean
    started: boolean
    feedbackCount: number
    exercisesPerformed: Array<{
        workoutExerciseId: string
        performedSets: Array<{ setNumber: number; reps: number; weight: number }>
    }>
}

export async function loadActiveProgramId(traineeId: string): Promise<string | null> {
    const program = await prisma.trainingProgram.findFirst({
        where: { traineeId, status: 'active' },
        select: { id: true },
        orderBy: { startDate: 'desc' },
    })
    return program?.id ?? null
}

export async function loadTraineeProgramView(input: {
    programId: string
    traineeId: string
}): Promise<TraineeProgramView | null> {
    const { programId, traineeId } = input

    const [programRaw, progress] = await Promise.all([
        loadProgramTreeForTrainee(programId, traineeId),
        loadProgressAggregates(programId),
    ])

    if (!programRaw) {
        return null
    }

    return { program: programRaw, progress }
}

async function loadProgramTreeForTrainee(
    programId: string,
    traineeId: string
): Promise<TraineeProgram | null> {
    const program = await prisma.trainingProgram.findUnique({
        where: { id: programId },
        include: {
            trainer: { select: { firstName: true, lastName: true } },
            trainee: { select: { firstName: true, lastName: true } },
            weeks: {
                include: {
                    workouts: {
                        include: {
                            workoutExercises: {
                                include: {
                                    exercise: { select: { id: true, name: true, type: true } },
                                },
                                orderBy: { order: 'asc' },
                            },
                        },
                    },
                },
                orderBy: { weekNumber: 'asc' },
            },
        },
    })

    if (!program || program.traineeId !== traineeId) {
        return null
    }

    const needsPrMap = program.weeks.some((week) =>
        week.workouts.some((workout) =>
            workout.workoutExercises.some((we) => we.weightType !== 'absolute')
        )
    )
    const prMap = needsPrMap ? await loadTraineePrMap(traineeId) : new Map<string, number>()

    const weeks = program.weeks.map((week) => ({
        weekNumber: week.weekNumber,
        weekType: week.weekType,
        workouts: week.workouts.map((workout) => {
            const siblings = workout.workoutExercises
            return {
                id: workout.id,
                dayIndex: workout.dayIndex,
                workoutExercises: workout.workoutExercises.map((we) => {
                    const base = {
                        id: we.id,
                        workoutId: we.workoutId,
                        exerciseId: we.exerciseId,
                        variant: we.variant,
                        sets: we.sets,
                        reps: we.reps,
                        targetRpe: we.targetRpe,
                        weightType: we.weightType,
                        weight: we.weight,
                        effectiveWeight: we.effectiveWeight,
                        restTime: we.restTime,
                        isWarmup: we.isWarmup,
                        isSkeletonExercise: we.isSkeletonExercise,
                        notes: we.notes,
                        order: we.order,
                        exercise: we.exercise,
                    }
                    if (typeof base.effectiveWeight === 'number') return base
                    if (base.weightType === 'absolute') return { ...base, effectiveWeight: base.weight }
                    try {
                        const effectiveWeight = resolveEffectiveWeight(we, prMap, siblings)
                        return { ...base, effectiveWeight }
                    } catch (err) {
                        logger.warn(
                            { programId, workoutExerciseId: we.id, error: err instanceof Error ? err.message : String(err) },
                            'Failed to resolve effective weight'
                        )
                        return { ...base, effectiveWeight: null }
                    }
                }),
            }
        }),
    }))

    return {
        id: program.id,
        title: program.title,
        startDate: program.startDate,
        durationWeeks: program.durationWeeks,
        trainee: program.trainee,
        trainer: program.trainer,
        weeks,
    }
}

async function loadProgressAggregates(programId: string): Promise<TraineeProgramProgress> {
    // Reuses the same shape as the route handler. Keeping logic in one place is the goal of this
    // helper, but this function and the route handler share the same SQL — keep them in sync.
    // (Implementation copy-pasted verbatim from the route handler in Task 3.)
    // ...
    // (For brevity in this plan: extract the computation block from src/app/api/programs/[id]/progress/route.ts
    // into a private function `computeProgress(programId)` and call it from both places.)
    throw new Error('Implement by extracting the body of GET /api/programs/[id]/progress into a shared private helper')
}
```

Note: The skeleton above intentionally throws on `loadProgressAggregates` — Step 3 of Task 5 must extract the progress logic from the route into this helper. Concrete extraction:

1. Move the body of the GET handler in `src/app/api/programs/[id]/progress/route.ts` (everything after RBAC, but excluding the `apiSuccess(...)` wrapper) into `computeProgress(programId: string): Promise<TraineeProgramProgress>` exported from `trainee-program-data.ts`.
2. The route handler becomes:
   ```ts
   const progress = await computeProgress(programId)
   return apiSuccess(progress)
   ```
3. `loadProgressAggregates` becomes `return computeProgress(programId)`.

- [ ] **Step 4: Refactor route handler to use `computeProgress`**

Edit `src/app/api/programs/[id]/progress/route.ts` so the GET handler does only:

```ts
const session = await requireRole(['admin', 'trainer', 'trainee'])
const program = await prisma.trainingProgram.findUnique({
    where: { id: programId },
    select: { id: true, trainerId: true, traineeId: true, status: true, durationWeeks: true, startDate: true, title: true },
})
if (!program) return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
if (session.user.role === 'trainer' && program.trainerId !== session.user.id) return apiError('FORBIDDEN', ..., 'program.viewDenied')
if (session.user.role === 'trainee' && program.traineeId !== session.user.id) return apiError('FORBIDDEN', ..., 'program.viewAssignedDenied')

const progress = await computeProgress(program)
return apiSuccess(progress)
```

…where `computeProgress(program: { id, title, status, startDate, durationWeeks })` is the function in `trainee-program-data.ts` carrying the SQL block from Task 3.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/lib/trainee-program-data.test.ts tests/integration/program-progress.test.ts`
Expected: all PASS.

- [ ] **Step 6: Update CHANGELOG and commit**

```
- refactor(lib): extract trainee program view loader. Adds `loadTraineeProgramView` and `loadActiveProgramId` in src/lib/trainee-program-data.ts. The progress route handler now delegates to the shared `computeProgress`.
```

```bash
git add src/lib/trainee-program-data.ts src/app/api/programs/[id]/progress/route.ts tests/unit/lib/trainee-program-data.test.ts implementation-docs/CHANGELOG.md
git commit -m "refactor(lib): extract shared trainee program data loader"
```

---

## Task 6: Server-component data fetching for `/trainee/programs/[id]` and `/trainee/programs/current`

Skip the client-side fetch waterfall: server components call the helper from Task 5 directly. The client component receives initial state as props.

**Files:**
- Modify: `src/app/trainee/programs/[id]/page.tsx`
- Modify: `src/app/trainee/programs/[id]/_content.tsx`
- Modify: `src/app/trainee/programs/current/page.tsx`
- Modify: `src/app/trainee/programs/current/_content.tsx`
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx` (props interface)

- [ ] **Step 1: Update `ProgramDetailContent` to accept hydrated props**

Edit `src/app/trainee/programs/_components/ProgramDetailContent.tsx`. Replace the props interface and remove the initial fetch:

```ts
import type { TraineeProgramView } from '@/lib/trainee-program-data'

interface ProgramDetailContentProps {
    mode?: ProgramContentMode
    programId: string
    initialData: TraineeProgramView
}
```

Replace the body that uses `useState(loading=true)` + `useEffect(fetchProgram)`. Initialize state from `initialData`:

```ts
const [program, setProgram] = useState<Program | null>(() => mapProgram(initialData))
const [programProgress, setProgramProgress] = useState<ProgramProgress>(() => mapProgress(initialData))
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

Where `mapProgram` and `mapProgress` are pure functions extracted from the existing `fetchProgram` body (the parts that turn API JSON into `Program` and `ProgramProgress` shapes). The HTTP call inside `fetchProgram` is gone; only the mapping survives.

`fetchProgram` becomes a refresh function that calls `/api/programs/[id]` + `/api/programs/[id]/progress` for re-fetches (used by Task 7). For now wire it to TanStack Query in Task 7.

- [ ] **Step 2: Update `[id]/page.tsx` to fetch on the server**

```tsx
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ProgramDetailByIdContent from './_content'
import { loadTraineeProgramView } from '@/lib/trainee-program-data'

interface ProgramDetailByIdPageProps {
    params: Promise<{ id: string }>
}

export default async function ProgramDetailByIdPage({ params }: ProgramDetailByIdPageProps) {
    const { id } = await params
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainee') redirect(`/${session.user.role}/dashboard`)

    const data = await loadTraineeProgramView({ programId: id, traineeId: session.user.id })
    if (!data) notFound()

    return (
        <DashboardLayout user={session.user} backHref="/trainee/history">
            <ProgramDetailByIdContent programId={id} initialData={data} />
        </DashboardLayout>
    )
}
```

- [ ] **Step 3: Update `[id]/_content.tsx`**

```tsx
'use client'

import ProgramDetailContent from '../_components/ProgramDetailContent'
import type { TraineeProgramView } from '@/lib/trainee-program-data'

interface ProgramDetailByIdContentProps {
    programId: string
    initialData: TraineeProgramView
}

export default function ProgramDetailByIdContent({ programId, initialData }: ProgramDetailByIdContentProps) {
    return <ProgramDetailContent mode="history" programId={programId} initialData={initialData} />
}
```

- [ ] **Step 4: Update `current/page.tsx`**

```tsx
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import CurrentProgramContent from './_content'
import { loadActiveProgramId, loadTraineeProgramView } from '@/lib/trainee-program-data'

export default async function CurrentProgramPage() {
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainee') redirect(`/${session.user.role}/dashboard`)

    const programId = await loadActiveProgramId(session.user.id)
    if (!programId) notFound()

    const data = await loadTraineeProgramView({ programId, traineeId: session.user.id })
    if (!data) notFound()

    return (
        <DashboardLayout user={session.user} backHref="/trainee/dashboard">
            <CurrentProgramContent programId={programId} initialData={data} />
        </DashboardLayout>
    )
}
```

- [ ] **Step 5: Update `current/_content.tsx`**

```tsx
'use client'

import ProgramDetailContent from '../_components/ProgramDetailContent'
import type { TraineeProgramView } from '@/lib/trainee-program-data'

interface CurrentProgramContentProps {
    programId: string
    initialData: TraineeProgramView
}

export default function CurrentProgramContent({ programId, initialData }: CurrentProgramContentProps) {
    return <ProgramDetailContent mode="current" programId={programId} initialData={initialData} />
}
```

- [ ] **Step 6: Type-check + lint**

Run: `npm run type-check`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: E2E spec for current program load**

Add a Playwright test or extend an existing one. Pick the file: search `tests/e2e/` for a trainee-current spec; if missing, add `tests/e2e/trainee-current-program.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('trainee current program renders without skeleton flash', async ({ page }) => {
    // Assumes seeded trainee logged-in via storage state shared by other specs.
    await page.goto('/trainee/programs/current')

    // Header must be present in the SSR HTML — no client fetch latency.
    const header = page.getByRole('heading', { level: 1 })
    await expect(header).toBeVisible({ timeout: 1000 })
})
```

Run: `npm run test:e2e -- tests/e2e/trainee-current-program.spec.ts`
(If e2e infra needs login fixtures, follow existing trainee specs as a template.)

- [ ] **Step 8: Update CHANGELOG and commit**

```
- perf(trainee): server-component data fetching for /trainee/programs/[id] and /trainee/programs/current. Removes the client→/api waterfall on first paint; client fetch survives only as TanStack Query refresh path.
```

```bash
git add src/app/trainee/programs/ tests/e2e/trainee-current-program.spec.ts implementation-docs/CHANGELOG.md
git commit -m "perf(trainee): server-component initial fetch for program detail"
```

---

## Task 7: TanStack Query for client-side refresh

Initial paint is server-rendered (Task 6). On focus / visibility change, the page should refresh `program` + `progress`. Replace the manual `window.addEventListener('focus', ...)` + `fetch` chain with TanStack Query so refetches dedupe and respect `staleTime`.

**Files:**
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

- [ ] **Step 1: Inspect existing TanStack Query setup**

Run: `grep -rn "QueryClientProvider" src/`
Confirm a `QueryClientProvider` already wraps the app (typical setup in `src/app/providers.tsx`). If not, stop and add one before continuing — that is a precondition; the codebase expects it per CLAUDE.md.

- [ ] **Step 2: Wire two `useQuery` hooks into `ProgramDetailContent`**

Add at the top of the component:

```ts
import { useQuery } from '@tanstack/react-query'

const fetchProgramDetail = async (programId: string): Promise<TraineeProgramView['program']> => {
    const res = await fetch(`/api/programs/${programId}`)
    const json = await res.json()
    if (!res.ok) throw new Error(getApiErrorMessage(json, 'Errore', t))
    return mapProgramFromApi(json.data.program)
}

const fetchProgramProgress = async (programId: string): Promise<TraineeProgramView['progress']> => {
    const res = await fetch(`/api/programs/${programId}/progress`)
    const json = await res.json()
    if (!res.ok) throw new Error(getApiErrorMessage(json, 'Errore', t))
    return json.data
}
```

Replace `useState`-based state with:

```ts
const programQuery = useQuery({
    queryKey: ['trainee-program', programId],
    queryFn: () => fetchProgramDetail(programId),
    initialData: initialData.program,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
})

const progressQuery = useQuery({
    queryKey: ['trainee-program-progress', programId],
    queryFn: () => fetchProgramProgress(programId),
    initialData: initialData.progress,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
})

const program = useMemo(
    () => programQuery.data ? composeProgram(programQuery.data, progressQuery.data) : null,
    [programQuery.data, progressQuery.data]
)
const programProgress = progressQuery.data ?? null
const error = programQuery.error?.message ?? progressQuery.error?.message ?? null
```

`composeProgram` is the merge logic that was inside `fetchProgram` (mapping `progressData.workouts` into the program tree by workout id). Extract it as a top-level pure function.

Remove:
- `useEffect(refreshLocalWorkoutProgress, ...)` window listeners — TanStack Query handles refresh-on-focus. Keep `localWorkoutProgress` state but recompute it via a separate `useEffect` that listens for the `program` reference changes and `visibilitychange`.
- The whole `fetchProgram` callback — TanStack Query owns it.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

Open `/trainee/programs/current` in the browser. Confirm:
1. Hard reload renders the program immediately (no skeleton).
2. Switching tabs and returning triggers a background refetch (Network tab shows `/api/programs/.../progress` firing).

- [ ] **Step 5: Update CHANGELOG and commit**

```
- perf(trainee): TanStack Query takes over post-hydration refresh for /trainee/programs detail. Manual focus listener removed; staleTime 60s, refetchOnWindowFocus enabled.
```

```bash
git add src/app/trainee/programs/_components/ProgramDetailContent.tsx implementation-docs/CHANGELOG.md
git commit -m "perf(trainee): use TanStack Query for program detail refresh"
```

---

## Task 8: Consolidate React effects for expand state

The component currently runs three effects post-`setProgram`:
1. `refreshLocalWorkoutProgress`
2. `setExpandedWeeks` initialization
3. `setExpandedWorkouts` initialization

Each `setState` triggers an extra render. Derive all three from `program` via `useMemo` instead.

**Files:**
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

- [ ] **Step 1: Replace expand-state effects with derived `useMemo`**

Remove the `useEffect(() => { ...firstIncompleteWeek logic... }, [program])` block. Replace with derived defaults:

```ts
const defaultExpandedWeekNumber = useMemo(() => {
    if (!program || program.weeks.length === 0) return null
    const firstIncomplete = program.weeks.find(
        (week) => !week.workouts.every((w) => w.completed)
    )
    return firstIncomplete?.weekNumber ?? program.weeks[0].weekNumber
}, [program])

const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({})
const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({})

useEffect(() => {
    if (!program || defaultExpandedWeekNumber === null) return
    setExpandedWeeks((prev) =>
        Object.keys(prev).length > 0
            ? prev
            : Object.fromEntries(
                  program.weeks.map((week) => [week.weekNumber, week.weekNumber === defaultExpandedWeekNumber])
              )
    )
    setExpandedWorkouts((prev) =>
        Object.keys(prev).length > 0
            ? prev
            : Object.fromEntries(
                  program.weeks.flatMap((week) =>
                      week.workouts.map((workout) => [
                          workout.id,
                          week.weekNumber === defaultExpandedWeekNumber,
                      ])
                  )
              )
    )
}, [program, defaultExpandedWeekNumber])
```

Result: `setExpandedWeeks` / `setExpandedWorkouts` only fire on first hydration (when `prev` is empty). Subsequent React Query refetches don't reset user-controlled expand state.

- [ ] **Step 2: Replace localWorkoutProgress focus listener with visibility-only**

```ts
useEffect(() => {
    if (!program) return
    const refresh = () => {
        const next = Object.fromEntries(
            program.weeks
                .flatMap((week) => week.workouts)
                .map((workout) => [workout.id, hasLocalWorkoutProgress(workout.id)])
        )
        setLocalWorkoutProgress(next)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
}, [program])
```

The window `focus` listener was redundant alongside TanStack Query's `refetchOnWindowFocus` for the API path; localStorage progress only matters on actual visibility change (returning from /trainee/workouts).

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Vitest component test (smoke) for stable expand-state across refetch**

Create or extend `tests/unit/components/program-detail-content.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProgramDetailContent from '@/app/trainee/programs/_components/ProgramDetailContent'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string) => k,
        i18n: { language: 'en' },
    }),
}))

const mkData = (overrides = {}) => ({
    program: {
        id: 'p1',
        title: 'X',
        startDate: new Date('2026-04-01'),
        durationWeeks: 1,
        trainee: { firstName: 'M', lastName: 'A' },
        trainer: { firstName: 'T', lastName: 'R' },
        weeks: [
            {
                weekNumber: 1,
                weekType: 'normal',
                workouts: [
                    { id: 'w1', dayIndex: 1, workoutExercises: [] },
                ],
            },
        ],
    },
    progress: {
        programId: 'p1',
        programName: 'X',
        status: 'active',
        currentWeek: 1,
        totalWeeks: 1,
        completedWorkouts: 0,
        totalWorkouts: 1,
        feedbackCount: 0,
        avgRPE: null,
        totalVolume: 0,
        nextWorkout: null,
        workouts: [
            {
                id: 'w1',
                name: 'Day 1',
                weekNumber: 1,
                weekType: 'normal',
                dayOfWeek: 1,
                exerciseCount: 0,
                completed: false,
                started: false,
                feedbackCount: 0,
                exercisesPerformed: [],
            },
        ],
        weeklyStats: [],
    },
    ...overrides,
})

it('preserves user-collapsed week state across data refresh', () => {
    const client = new QueryClient()
    const data = mkData()

    const { rerender } = render(
        <QueryClientProvider client={client}>
            <ProgramDetailContent mode="history" programId="p1" initialData={data as any} />
        </QueryClientProvider>
    )

    const closeBtn = screen.getByRole('button', { name: /closeWeek|openWeek/i })
    act(() => {
        fireEvent.click(closeBtn)
    })

    // Re-render with same data (simulates refetch returning identical payload)
    rerender(
        <QueryClientProvider client={client}>
            <ProgramDetailContent mode="history" programId="p1" initialData={data as any} />
        </QueryClientProvider>
    )

    // Closed-state still applied: button label flips back to openWeek
    expect(screen.getByRole('button', { name: /openWeek/i })).toBeInTheDocument()
})
```

Run: `npx vitest run tests/unit/components/program-detail-content.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update CHANGELOG and commit**

```
- perf(trainee): consolidate expand-state effects in ProgramDetailContent. Defaults derived once on hydration; refetches no longer reset user-collapsed weeks/workouts.
```

```bash
git add src/app/trainee/programs/_components/ProgramDetailContent.tsx tests/unit/components/program-detail-content.test.tsx implementation-docs/CHANGELOG.md
git commit -m "perf(trainee): consolidate expand-state effects"
```

---

## Task 9: Update audit doc + close out

Mark item #4 complete and add a summary note for the trainee detail performance work.

**Files:**
- Modify: `docs/api-efficiency-audit.md:50-60`
- Modify: `docs/performance-analysis.md` (append new section)

- [ ] **Step 1: Tick item #4 in audit**

Edit `docs/api-efficiency-audit.md`. Change:

```
### [ ] 4. `GET /api/programs/[id]/progress` — aggregate counts
```

to:

```
### [x] 4. `GET /api/programs/[id]/progress` — aggregate counts
```

Tick all the sub-bullets that the implementation now satisfies; leave open any that remain (verify by re-reading the rewritten handler against the bullets).

- [ ] **Step 2: Append performance analysis section**

In `docs/performance-analysis.md`, append:

```markdown
## 6. Trainee program detail (2026-04-28)

Page: `/trainee/programs/[id]`, `/trainee/programs/current`.

### Before
- 1 active-program lookup (heavy CTE) + 2 parallel API calls (`[id]` + `[id]/progress`) loading nested trees with feedbacks/setsPerformed.
- `getUser()` fired once per API request × 2-3 requests.
- Client fetch waterfall blocks the first paint (skeleton).

### After
- Server-component direct Prisma calls via `loadTraineeProgramView`.
- Progress aggregates via `$queryRaw` + `exerciseFeedback.aggregate`; only completed-feedback `setPerformed` rows fetched.
- Trainee `[id]` exercise include slimmed to `{ id, name, type }`.
- TanStack Query handles post-hydration refresh.
```

- [ ] **Step 3: Commit**

```bash
git add docs/api-efficiency-audit.md docs/performance-analysis.md
git commit -m "docs: close out trainee program detail perf work"
```

---

## Final smoke test

- [ ] **Step 1: Full type-check + lint**

```
npm run type-check
npm run lint
```

Expected: clean both.

- [ ] **Step 2: Full unit / integration test run**

```
npm run test:unit
```

Expected: all green. If failures appear in unrelated files (e.g., due to changed mocks), open and fix per the same patterns.

- [ ] **Step 3: Manual measurement**

In the browser DevTools Network panel:
1. Hard-reload `/trainee/programs/current`.
2. Confirm the page request returns HTML containing the program title (no client-side skeleton flash).
3. Confirm no `/api/programs?status=active&limit=1` call.
4. Confirm subsequent navigation back to the page is instant (no API call until window focus / staleTime expiry).

Capture before/after timings and add to `docs/performance-analysis.md` Section 6 if they materially differ from the audit estimates.

- [ ] **Step 4: Final integration commit (if measurements added)**

```bash
git add docs/performance-analysis.md
git commit -m "docs: record trainee program detail timings"
```

---

## Self-review notes

- **Spec coverage:** All 9 points from the analysis are mapped:
  - #1 Aggregated progress → Task 3 + Task 5
  - #2 Slim exercise select → Task 2
  - #3 Endpoint consolidation (server-component) → Task 6
  - #4 Active-program endpoint → Task 4 (and superseded by direct Prisma in Task 6)
  - #5 `getSession` cache → already implemented in `src/lib/auth.ts:33` via `cache()`. Task 6 eliminates the duplicate-request scenario by collapsing to one server render. Documented in Task 9.
  - #6 TanStack Query → Task 7
  - #7 Server-component fetch → Task 6
  - #8 Effects consolidation → Task 8
  - #9 Conditional PR map → Task 1
- **Placeholders:** None remain — every step shows the code or command. Task 5 Step 3 explicitly defers progress-block extraction to Step 4 of the same task, with concrete steps.
- **Type consistency:** `TraineeProgramView` is the single transport type from server to client. Internal `Program` shape in `ProgramDetailContent.tsx` continues to be derived via `mapProgram` from the API result for backward compat with existing render code.
- **Order:** Tasks 1 → 2 are isolated. Task 3 establishes the SQL aggregate logic. Task 5 extracts it. Task 6 wires server components to the helper. Tasks 7 + 8 then refine the client. Task 9 closes documentation.

---
