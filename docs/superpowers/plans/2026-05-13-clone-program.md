# Clone Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer start a new program from an existing one by pre-filling the wizard and copying the source program's `WorkoutSkeleton` rows on submit. No DB writes happen on Clone click.

**Architecture:** Add a `Clone` action icon to every program row in `/trainer/programs` and the programs tab of `/trainer/trainees/[id]`. The button navigates to `/trainer/programs/new?cloneFromProgramId=<id>`. The new-program page server-fetches the source and passes it to `NewProgramContent`, which pre-fills trainee/workoutsPerWeek (locked)/isSbdProgram and shows a banner. On submit, `POST /api/programs` accepts `cloneFromProgramId` and copies the skeleton inside the existing program-create flow.

**Tech Stack:** Next.js 15 App Router · React Server Components · Prisma · Zod · Tailwind · Vitest (jsdom) · react-i18next · lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-13-clone-program-design.md`

---

## Files touched

**Create:**
- `tests/integration/programs-clone.test.ts` — API clone branch coverage

**Modify:**
- `src/schemas/program.ts` — add `cloneFromProgramId` to `createProgramSchema`
- `src/app/api/programs/route.ts` — extend POST to copy skeleton when `cloneFromProgramId` is provided
- `src/components/ActionIconButton.tsx` — add `clone` variant
- `src/app/trainer/programs/_content.tsx` — render Clone button in both action branches
- `src/app/trainer/trainees/[id]/_content.tsx` — render Clone button in programs tab row
- `src/app/trainer/programs/new/page.tsx` — read `cloneFromProgramId`, fetch source, pass `cloneSource`
- `src/app/trainer/programs/new/NewProgramContent.tsx` — accept `cloneSource`, prefill, lock field, render banner, include id in POST body
- `tests/integration/programs.test.ts` — extend with `cloneFromProgramId` happy-path + error cases (or use new `programs-clone.test.ts` file — see Task 2)
- `tests/unit/program-schema.test.ts` — schema unit tests (create if missing)
- `tests/unit/NewProgramContent.test.tsx` — wizard component tests (create)
- `public/locales/en/trainer.json`, `public/locales/it/trainer.json` — new program keys
- `public/locales/en/errors.json`, `public/locales/it/errors.json` — new API error keys (folder confirmed: `errors.json`)
- `implementation-docs/CHANGELOG.md` — feature entry

---

## Task 1 — Schema: add `cloneFromProgramId`

**Files:**
- Modify: `src/schemas/program.ts`
- Create or modify: `tests/unit/program-schema.test.ts`

- [ ] **Step 1: Write the failing test**

If `tests/unit/program-schema.test.ts` does not exist, create it with the content below. If it exists, append the new `describe` block.

```ts
import { describe, it, expect } from 'vitest'
import { createProgramSchema } from '@/schemas/program'

describe('createProgramSchema — cloneFromProgramId', () => {
    const base = {
        title: 'Block A',
        traineeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        isSbdProgram: false,
        durationWeeks: 4,
        workoutsPerWeek: 3,
    }

    it('accepts payload without cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse(base)
        expect(result.success).toBe(true)
    })

    it('accepts a valid uuid for cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse({
            ...base,
            cloneFromProgramId: '00000000-0000-0000-0000-000000000001',
        })
        expect(result.success).toBe(true)
    })

    it('rejects a non-uuid cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse({
            ...base,
            cloneFromProgramId: 'not-a-uuid',
        })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/program-schema.test.ts -t "cloneFromProgramId"`

Expected: failures because `cloneFromProgramId` is not part of the schema (the non-uuid case will pass — that's OK; the two acceptance cases prove existence).

- [ ] **Step 3: Add field to schema**

Edit `src/schemas/program.ts` — add the field at the end of the object passed to `z.object` in `createProgramSchema`:

```ts
export const createProgramSchema = z.object({
    title: z
        .string()
        .min(3, 'validation.titleTooShort')
        .max(100, 'validation.titleTooLong'),
    traineeId: z.string().uuid('validation.invalidTraineeId'),
    isSbdProgram: z.boolean().default(false),
    durationWeeks: z
        .number()
        .int('validation.durationInteger')
        .min(1, 'validation.minWeeks')
        .max(52, 'validation.maxWeeks'),
    workoutsPerWeek: z
        .number()
        .int('validation.workoutsInteger')
        .min(1, 'validation.minWorkouts')
        .max(7, 'validation.maxWorkouts'),
    cloneFromProgramId: z.string().uuid('validation.invalidCloneSourceId').optional(),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/program-schema.test.ts -t "cloneFromProgramId"`

Expected: all three cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/program.ts tests/unit/program-schema.test.ts
git commit -m "feat(programs): accept optional cloneFromProgramId in createProgramSchema"
```

---

## Task 2 — API: clone branch happy path

**Files:**
- Modify: `src/app/api/programs/route.ts`
- Create: `tests/integration/programs-clone.test.ts`

Rationale for a new test file: keeps the existing `tests/integration/programs.test.ts` mock surface minimal. The new file mocks only what the clone branch needs (program findUnique twice, skeleton findMany/createMany, transaction).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/programs-clone.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        trainerTrainee: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        workoutSkeleton: {
            findMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/programs/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TRAINEE_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const SOURCE_PROGRAM_ID = '00000000-0000-0000-0000-000000000099'
const EX_1 = '00000000-0000-0000-0000-000000000001'
const EX_2 = '00000000-0000-0000-0000-000000000002'

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/programs — clone branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: TRAINEE_ID,
            role: 'trainee',
        } as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
        } as any)
    })

    it('clones skeleton rows in the same transaction as program creation', async () => {
        // Source program owned by the same trainer, same workoutsPerWeek
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
        } as any)

        const skeletonCreateMany = vi.fn().mockResolvedValue({ count: 2 })
        const skeletonFindMany = vi.fn().mockResolvedValue([
            { dayIndex: 0, order: 0, exerciseId: EX_1 },
            { dayIndex: 1, order: 0, exerciseId: EX_2 },
        ])
        const programCreate = vi.fn().mockResolvedValue({
            id: 'new-prog-id',
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [],
        })

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
            fn({
                trainingProgram: { create: programCreate },
                workoutSkeleton: {
                    findMany: skeletonFindMany,
                    createMany: skeletonCreateMany,
                },
            })
        )

        const res = await POST(
            makePostRequest({
                title: 'Block B',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
        expect(programCreate).toHaveBeenCalledOnce()
        expect(skeletonFindMany).toHaveBeenCalledWith({
            where: { programId: SOURCE_PROGRAM_ID },
            select: { dayIndex: true, order: true, exerciseId: true },
        })
        expect(skeletonCreateMany).toHaveBeenCalledWith({
            data: [
                { programId: 'new-prog-id', dayIndex: 0, order: 0, exerciseId: EX_1 },
                { programId: 'new-prog-id', dayIndex: 1, order: 0, exerciseId: EX_2 },
            ],
        })
    })

    it('creates program with empty skeleton when source has no rows', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
        } as any)

        const skeletonCreateMany = vi.fn()
        const programCreate = vi.fn().mockResolvedValue({
            id: 'new-prog-id',
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [],
        })

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
            fn({
                trainingProgram: { create: programCreate },
                workoutSkeleton: {
                    findMany: vi.fn().mockResolvedValue([]),
                    createMany: skeletonCreateMany,
                },
            })
        )

        const res = await POST(
            makePostRequest({
                title: 'Block C',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
        expect(skeletonCreateMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/programs-clone.test.ts`

Expected: failures because the route does not yet handle `cloneFromProgramId`.

- [ ] **Step 3: Refactor POST to use a transaction and add the clone branch**

Edit `src/app/api/programs/route.ts`. Replace the `const program = await prisma.trainingProgram.create({ ... })` block at the end of `POST` with a transaction that does program creation and (when clone is requested) skeleton copy.

Insert the clone-source lookup and validation BEFORE the create call, after `actualTrainerId` is resolved. Full replacement region (everything from the comment `// Create program with nested weeks and workouts` through `return apiSuccess({ program }, 201)`):

```ts
        // Create program with nested weeks and workouts
        const weeksData = []
        for (let i = 1; i <= durationWeeks; i++) {
            const workoutsData = []
            for (let j = 1; j <= workoutsPerWeek; j++) {
                workoutsData.push({ dayIndex: j })
            }
            weeksData.push({
                weekNumber: i,
                weekType: 'volume' as const,
                workouts: { create: workoutsData },
            })
        }

        // Get trainer ID from relation or use session user
        let actualTrainerId = session.user.id
        if (session.user.role === 'admin') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: { traineeId },
            })
            if (trainerRelation) {
                actualTrainerId = trainerRelation.trainerId
            }
        }

        // Clone-source validation (when cloning)
        const cloneFromProgramId = validation.data.cloneFromProgramId
        if (cloneFromProgramId) {
            const source = await prisma.trainingProgram.findUnique({
                where: { id: cloneFromProgramId },
                select: { id: true, trainerId: true, workoutsPerWeek: true },
            })

            if (!source) {
                return apiError(
                    'NOT_FOUND',
                    'Source program not found',
                    404,
                    undefined,
                    'program.cloneSourceNotFound'
                )
            }

            if (session.user.role === 'trainer' && source.trainerId !== session.user.id) {
                return apiError(
                    'FORBIDDEN',
                    'Cannot clone another trainer\'s program',
                    403,
                    undefined,
                    'program.cloneDenied'
                )
            }

            if (source.workoutsPerWeek !== workoutsPerWeek) {
                return apiError(
                    'VALIDATION_ERROR',
                    'workoutsPerWeek must match the source program',
                    400,
                    undefined,
                    'validation.workoutsPerWeekMismatchWithClone'
                )
            }
        }

        const program = await prisma.$transaction(async (tx) => {
            const created = await tx.trainingProgram.create({
                data: {
                    title,
                    trainerId: actualTrainerId,
                    traineeId,
                    isSbdProgram,
                    durationWeeks,
                    workoutsPerWeek,
                    status: 'draft',
                    weeks: { create: weeksData },
                },
                include: {
                    trainer: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    trainee: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    weeks: {
                        include: { workouts: true },
                        orderBy: { weekNumber: 'asc' },
                    },
                },
            })

            if (cloneFromProgramId) {
                const sourceRows = await tx.workoutSkeleton.findMany({
                    where: { programId: cloneFromProgramId },
                    select: { dayIndex: true, order: true, exerciseId: true },
                })

                if (sourceRows.length > 0) {
                    await tx.workoutSkeleton.createMany({
                        data: sourceRows.map((row) => ({
                            programId: created.id,
                            dayIndex: row.dayIndex,
                            order: row.order,
                            exerciseId: row.exerciseId,
                        })),
                    })
                }
            }

            return created
        })

        logger.info(
            {
                programId: program.id,
                trainerId: program.trainerId,
                traineeId: program.traineeId,
                clonedFrom: cloneFromProgramId ?? null,
            },
            'Program created successfully'
        )

        return apiSuccess({ program }, 201)
```

- [ ] **Step 4: Run new test file to verify it passes**

Run: `npx vitest run tests/integration/programs-clone.test.ts`

Expected: both `clones skeleton rows` and `creates program with empty skeleton` pass.

- [ ] **Step 5: Run existing programs test to verify no regression**

Run: `npx vitest run tests/integration/programs.test.ts`

Expected: all existing POST tests still pass. The mocks in that file don't model `$transaction`-with-args for the create path, so update if a test now relies on direct `prisma.trainingProgram.create`. If a test fails, replace `vi.mocked(prisma.trainingProgram.create)` setups with the same `$transaction` mock pattern used in the new file, OR (preferred, minimal change) extend the existing `$transaction` mock at the top of `programs.test.ts` to also expose `trainingProgram.create` and `workoutSkeleton` on the tx object.

If you must edit `programs.test.ts`, update the top-level `$transaction` mock factory in `vi.mock('@/lib/prisma', ...)` to look like:

```ts
$transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
    const tx = {
        trainingProgram: {
            create: vi.fn().mockImplementation((args: any) => prisma.trainingProgram.create(args)),
        },
        workoutExercise: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        workoutSkeleton: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
    }
    return fn(tx)
}),
```

Re-run the suite until green.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/programs/route.ts tests/integration/programs-clone.test.ts tests/integration/programs.test.ts
git commit -m "feat(api): clone WorkoutSkeleton rows when cloneFromProgramId provided

POST /api/programs now copies skeleton rows from a source program in the
same transaction as program creation. Trainer must own the source;
workoutsPerWeek must match."
```

---

## Task 3 — API: clone source not found → 404

**Files:**
- Modify: `tests/integration/programs-clone.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('POST /api/programs — clone branch', ...)`:

```ts
    it('returns 404 when cloneFromProgramId is unknown', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)

        const res = await POST(
            makePostRequest({
                title: 'Block D',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: '00000000-0000-0000-0000-0000000000aa',
            })
        )
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.cloneSourceNotFound')
    })
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/programs-clone.test.ts -t "404"`

Expected: PASS (the route already returns 404 from Task 2 — this test only locks in the contract).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/programs-clone.test.ts
git commit -m "test(api): cover 404 when clone source program missing"
```

---

## Task 4 — API: clone RBAC → 403

**Files:**
- Modify: `tests/integration/programs-clone.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the same describe block:

```ts
    it('returns 403 when trainer does not own the source program', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'other-trainer-uuid',
            workoutsPerWeek: 3,
        } as any)

        const res = await POST(
            makePostRequest({
                title: 'Block E',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.cloneDenied')
    })
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/programs-clone.test.ts -t "403"`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/programs-clone.test.ts
git commit -m "test(api): cover 403 when trainer clones another trainer's program"
```

---

## Task 5 — API: workoutsPerWeek mismatch → 400

**Files:**
- Modify: `tests/integration/programs-clone.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
    it('returns 400 when workoutsPerWeek differs from source', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 4, // source has 4
        } as any)

        const res = await POST(
            makePostRequest({
                title: 'Block F',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3, // body has 3 — mismatch
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.workoutsPerWeekMismatchWithClone')
    })
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/programs-clone.test.ts -t "400"`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/programs-clone.test.ts
git commit -m "test(api): cover 400 on workoutsPerWeek mismatch with clone source"
```

---

## Task 6 — ActionIconButton: add `clone` variant

**Files:**
- Modify: `src/components/ActionIconButton.tsx`

There is no existing unit test for `ActionIconButton`, and the variant addition is mechanical. Verification is visual (Tasks 7–8) plus type-check.

- [ ] **Step 1: Add `clone` to the variant union and config**

Edit `src/components/ActionIconButton.tsx`:

1. Change the import line to add `Copy`:

```ts
import Link from 'next/link'
import { FileEdit, Eye, FlaskConical, Trash2, Loader2, UserCheck, UserX, Copy, type LucideIcon } from 'lucide-react'
```

2. Extend `ActionVariant`:

```ts
export type ActionVariant = 'edit' | 'view' | 'view-test' | 'delete' | 'activate' | 'deactivate' | 'clone'
```

3. Add the `clone` entry to `VARIANT_CONFIG`:

```ts
const VARIANT_CONFIG: Record<ActionVariant, { Icon: LucideIcon; activeClass: string }> = {
    edit: { Icon: FileEdit, activeClass: 'bg-green-600 hover:bg-green-700' },
    view: { Icon: Eye, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    'view-test': { Icon: FlaskConical, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    delete: { Icon: Trash2, activeClass: 'bg-red-600 hover:bg-red-700' },
    activate: { Icon: UserCheck, activeClass: 'bg-green-600 hover:bg-green-700' },
    deactivate: { Icon: UserX, activeClass: 'bg-red-600 hover:bg-red-700' },
    clone: { Icon: Copy, activeClass: 'bg-indigo-600 hover:bg-indigo-700' },
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActionIconButton.tsx
git commit -m "feat(components): add clone variant to ActionIconButton"
```

---

## Task 7 — Trainer programs list: render Clone button

**Files:**
- Modify: `src/app/trainer/programs/_content.tsx`

- [ ] **Step 1: Add the Clone button to BOTH `InlineActions` branches**

In the draft branch (around line 381), insert a `<ActionIconButton variant="clone" ... />` AFTER the `view` button and BEFORE the `delete` button:

```tsx
<InlineActions>
    <ActionIconButton
        variant="edit"
        label={t('programs.editProgramAction')}
        href={`/trainer/programs/${program.id}/edit`}
    />
    <ActionIconButton
        variant="view"
        label={t('programs.viewProgram')}
        href={`/trainer/programs/${program.id}`}
    />
    <ActionIconButton
        variant="clone"
        label={t('programs.cloneProgram')}
        href={`/trainer/programs/new?cloneFromProgramId=${program.id}`}
    />
    <ActionIconButton
        variant="delete"
        label={t('programs.delete')}
        onClick={() =>
            handleDelete(program.id, program.title)
        }
    />
</InlineActions>
```

In the active/completed branch (around line 401), insert a `clone` button AFTER `view` and BEFORE `view-test`:

```tsx
<InlineActions>
    <ActionIconButton
        variant="view"
        label={t('programs.viewProgram')}
        href={`/trainer/programs/${program.id}`}
    />
    <ActionIconButton
        variant="clone"
        label={t('programs.cloneProgram')}
        href={`/trainer/programs/new?cloneFromProgramId=${program.id}`}
    />
    <ActionIconButton
        variant="view-test"
        label={testsCompleted ? t('programs.viewTests') : t('programs.testsButtonDisabledTooltip')}
        href={testsCompleted ? `/trainer/programs/${program.id}/tests?backContext=programs` : undefined}
        disabled={!testsCompleted}
    />
</InlineActions>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: no errors. (The translation key won't exist yet — that's fine; `t()` returns the key string at runtime, the type stays `string`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/_content.tsx
git commit -m "feat(trainer): add Clone action button to programs list rows"
```

---

## Task 8 — Trainee detail programs tab: render Clone button

**Files:**
- Modify: `src/app/trainer/trainees/[id]/_content.tsx`

- [ ] **Step 1: Add the Clone button in the programs tab row**

Find the `InlineActions` block in the programs tab (around line 753). Insert the clone button AFTER `view` and BEFORE the draft-only `edit`:

```tsx
<InlineActions>
    <ActionIconButton
        variant="view"
        label={t('athletes.viewProgram')}
        href={`/trainer/programs/${program.id}?backContext=trainee&traineeId=${traineeId}`}
    />
    <ActionIconButton
        variant="clone"
        label={t('programs.cloneProgram')}
        href={`/trainer/programs/new?cloneFromProgramId=${program.id}&traineeId=${traineeId}`}
    />
    {program.status === 'draft' && (
        <ActionIconButton
            variant="edit"
            label={t('common:common.edit')}
            href={`/trainer/programs/${program.id}/edit?backContext=trainee&traineeId=${traineeId}`}
        />
    )}
</InlineActions>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/trainees/[id]/_content.tsx
git commit -m "feat(trainer): add Clone action button to trainee programs tab"
```

---

## Task 9 — New program page: load clone source

**Files:**
- Modify: `src/app/trainer/programs/new/page.tsx`

- [ ] **Step 1: Read current page.tsx to confirm the existing data-load shape**

Run: `sed -n '1,80p' src/app/trainer/programs/new/page.tsx`

Expected output reveals how `initialTraineeId` is read from `searchParams` and how trainees are fetched. Mirror that shape for the clone source.

- [ ] **Step 2: Extend the page server component**

Modify the file. Concrete changes:

1. Read `cloneFromProgramId` from `searchParams` alongside `traineeId`.
2. If `cloneFromProgramId` is a valid uuid pattern, call `prisma.trainingProgram.findUnique` selecting `{ id, title, traineeId, workoutsPerWeek, isSbdProgram, trainerId }`.
3. Verify the requester owns the source (re-use the auth helper already used in the file — likely `requireRole(['admin', 'trainer'])` followed by a `trainerId` check, OR `requireTrainerProgramOwnership(cloneFromProgramId)` if it does not throw on admin; pick whichever matches the existing pattern after reading the file).
4. If the source is missing or not owned, pass `cloneSource={null}` AND set a `cloneError` flag, which `NewProgramContent` will show as an error banner.
5. Pass `cloneSource` (shape `{ id, title, traineeId, workoutsPerWeek, isSbdProgram }` or `null`) and `cloneError` (`'notFound' | 'forbidden' | null`) as props.

Pseudo-diff for the relevant block (adapt to the file's actual structure):

```tsx
const cloneFromParam = searchParams?.cloneFromProgramId
const cloneFromProgramId =
    typeof cloneFromParam === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cloneFromParam)
        ? cloneFromParam
        : null

let cloneSource: {
    id: string
    title: string
    traineeId: string
    workoutsPerWeek: number
    isSbdProgram: boolean
} | null = null
let cloneError: 'notFound' | 'forbidden' | null = null

if (cloneFromProgramId) {
    const source = await prisma.trainingProgram.findUnique({
        where: { id: cloneFromProgramId },
        select: {
            id: true,
            title: true,
            traineeId: true,
            workoutsPerWeek: true,
            isSbdProgram: true,
            trainerId: true,
        },
    })

    if (!source) {
        cloneError = 'notFound'
    } else if (session.user.role === 'trainer' && source.trainerId !== session.user.id) {
        cloneError = 'forbidden'
    } else {
        cloneSource = {
            id: source.id,
            title: source.title,
            traineeId: source.traineeId,
            workoutsPerWeek: source.workoutsPerWeek,
            isSbdProgram: source.isSbdProgram,
        }
    }
}

return (
    <NewProgramContent
        trainees={trainees}
        initialTraineeId={cloneSource?.traineeId ?? initialTraineeId}
        cloneSource={cloneSource}
        cloneError={cloneError}
    />
)
```

(Imports: ensure `prisma` from `@/lib/prisma` is imported; reuse the existing `session` variable from the page's auth call.)

- [ ] **Step 3: Type-check**

Run: `npm run type-check`

Expected: error reported on `NewProgramContent` props (`cloneSource`/`cloneError` don't exist yet). That confirms the page is wired up correctly; the component is updated in Task 10.

- [ ] **Step 4: Do NOT commit yet**

The page-level change is meaningless without Task 10. Continue.

---

## Task 10 — NewProgramContent: prefill, lock, banner, submit body

**Files:**
- Modify: `src/app/trainer/programs/new/NewProgramContent.tsx`
- Create: `tests/unit/NewProgramContent.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/NewProgramContent.test.tsx`. Use existing test patterns from `tests/unit/` for jsdom + react-testing-library imports — check one neighbor file (e.g. `tests/unit/AutocompleteSearch.test.tsx`) to confirm the import style and any global setup. Then:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}))

import NewProgramContent from '@/app/trainer/programs/new/NewProgramContent'

const trainees = [
    { id: 't-1', firstName: 'Mario', lastName: 'Atleta' },
    { id: 't-2', firstName: 'Luigi', lastName: 'Plumber' },
]

const cloneSource = {
    id: 'src-1',
    title: 'Block A',
    traineeId: 't-2',
    workoutsPerWeek: 4,
    isSbdProgram: true,
}

describe('NewProgramContent — clone source prefill', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { program: { id: 'new-1' } } }),
        }) as any
    })

    it('prefills trainee, isSbdProgram, and workoutsPerWeek (locked)', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-2"
                cloneSource={cloneSource}
                cloneError={null}
            />
        )

        const traineeSelect = screen.getByRole('combobox') as HTMLSelectElement
        expect(traineeSelect.value).toBe('t-2')

        const sbdCheckbox = screen.getByRole('checkbox') as HTMLInputElement
        expect(sbdCheckbox.checked).toBe(true)

        const workoutsInput = screen.getByDisplayValue('4') as HTMLInputElement
        expect(workoutsInput).toBeDisabled()
    })

    it('renders the clone banner with the source title', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-2"
                cloneSource={cloneSource}
                cloneError={null}
            />
        )

        expect(screen.getByText(/programs\.cloneFromBanner/i)).toBeInTheDocument()
    })

    it('includes cloneFromProgramId in the POST body on submit', async () => {
        const fetchSpy = global.fetch as any

        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-2"
                cloneSource={cloneSource}
                cloneError={null}
            />
        )

        const titleInput = screen.getByPlaceholderText('programs.programNamePlaceholder')
        fireEvent.change(titleInput, { target: { value: 'Block B' } })

        const submitBtn = screen.getByText('programs.nextConfigureExercises')
        fireEvent.click(submitBtn.closest('button')!)

        await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
        expect(body.cloneFromProgramId).toBe('src-1')
        expect(body.workoutsPerWeek).toBe(4)
        expect(body.isSbdProgram).toBe(true)
    })

    it('renders an error banner when cloneError is set', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId=""
                cloneSource={null}
                cloneError="notFound"
            />
        )

        expect(screen.getByText(/programs\.cloneSourceErrorNotFound/i)).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/NewProgramContent.test.tsx`

Expected: failures because `NewProgramContent` doesn't accept `cloneSource`/`cloneError` yet.

- [ ] **Step 3: Update the component**

Edit `src/app/trainer/programs/new/NewProgramContent.tsx`. Concrete changes:

1. Extend the props interface:

```tsx
interface CloneSource {
    id: string
    title: string
    traineeId: string
    workoutsPerWeek: number
    isSbdProgram: boolean
}

interface NewProgramContentProps {
    trainees: Trainee[]
    initialTraineeId: string
    cloneSource?: CloneSource | null
    cloneError?: 'notFound' | 'forbidden' | null
}
```

2. Update the destructure and initial state in the component:

```tsx
export default function NewProgramContent({
    trainees,
    initialTraineeId,
    cloneSource = null,
    cloneError = null,
}: NewProgramContentProps) {
    // ...

    const [title, setTitle] = useState('')
    const [traineeId, setTraineeId] = useState(cloneSource?.traineeId ?? initialTraineeId)
    const [isSbdProgram, setIsSbdProgram] = useState(cloneSource?.isSbdProgram ?? false)
    const [durationWeeks, setDurationWeeks] = useState(4)
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(cloneSource?.workoutsPerWeek ?? 3)
```

3. Add `cloneFromProgramId` to the POST body:

```tsx
const res = await fetch('/api/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title,
        traineeId,
        isSbdProgram,
        durationWeeks,
        workoutsPerWeek,
        ...(cloneSource ? { cloneFromProgramId: cloneSource.id } : {}),
    }),
})
```

4. Above the form (after the step indicator, before `<div className="mb-8">` heading block), insert a clone banner and an error banner:

```tsx
{cloneError && (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
        {cloneError === 'notFound'
            ? t('programs.cloneSourceErrorNotFound')
            : t('programs.cloneSourceErrorForbidden')}
    </div>
)}
{cloneSource && (
    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-lg mb-6 flex items-center justify-between gap-4">
        <span className="text-sm">
            <Trans
                i18nKey="trainer:programs.cloneFromBanner"
                values={{ title: cloneSource.title }}
                components={{ b: <span className="font-semibold" /> }}
            />
        </span>
        <Link
            href="/trainer/programs/new"
            className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline"
        >
            {t('programs.cloneCancelLink')}
        </Link>
    </div>
)}
```

5. Disable workouts-per-week input and chip buttons when `cloneSource` is present:

```tsx
<Input
    type="number"
    min="1"
    max="7"
    value={workoutsPerWeek}
    onChange={(e) => {
        const val = e.target.value.trim()
        if (val === '') {
            setWorkoutsPerWeek(3)
        } else {
            const parsed = parseInt(val, 10)
            if (!isNaN(parsed)) {
                setWorkoutsPerWeek(parsed)
            }
        }
    }}
    disabled={loading || !!cloneSource}
    readOnly={!!cloneSource}
    inputSize="md"
    required
/>
```

And for the chip buttons row:

```tsx
{[2, 3, 4].map((workouts) => (
    <button
        key={workouts}
        type="button"
        onClick={() => setWorkoutsPerWeek(workouts)}
        disabled={loading || !!cloneSource}
        className={`px-3 py-1 text-sm font-semibold rounded ${workoutsPerWeek === workouts
            ? 'bg-brand-primary text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
        {workouts}
    </button>
))}
```

6. Add a helper text below the workouts-per-week field when cloning:

```tsx
{cloneSource && (
    <p className="text-xs text-gray-500 mt-1">
        {t('programs.workoutsPerWeekLockedByClone')}
    </p>
)}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npx vitest run tests/unit/NewProgramContent.test.tsx`

Expected: all four cases pass.

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`

Expected: no errors (page.tsx props now match).

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/new/page.tsx src/app/trainer/programs/new/NewProgramContent.tsx tests/unit/NewProgramContent.test.tsx
git commit -m "feat(trainer): prefill new-program wizard from clone source

- page.tsx reads cloneFromProgramId, fetches source, passes cloneSource
  and cloneError props to NewProgramContent.
- NewProgramContent prefills trainee/isSbdProgram/workoutsPerWeek (the
  latter locked), shows a clone banner with a 'Start blank instead'
  link, surfaces clone-source errors, and sends cloneFromProgramId in
  the POST body."
```

---

## Task 11 — i18n keys

**Files:**
- Modify: `public/locales/en/trainer.json`, `public/locales/it/trainer.json`
- Modify: `public/locales/en/errors.json`, `public/locales/it/errors.json`

If `errors.json` does not group keys exactly as the spec mentions (`program.cloneDenied` etc.), open one existing key like `program.notFound` to confirm the nesting style and follow it.

- [ ] **Step 1: Add keys to `public/locales/en/trainer.json`**

Inside the `programs` group, add:

```json
"cloneProgram": "Clone program",
"cloneFromBanner": "Cloning skeleton from <b>{{title}}</b>.",
"cloneCancelLink": "Start blank instead",
"workoutsPerWeekLockedByClone": "Locked: must match the source program.",
"cloneSourceErrorNotFound": "The source program could not be found.",
"cloneSourceErrorForbidden": "You do not have access to that source program."
```

- [ ] **Step 2: Add the same keys (translated) to `public/locales/it/trainer.json`**

```json
"cloneProgram": "Clona programma",
"cloneFromBanner": "Sto clonando lo scheletro da <b>{{title}}</b>.",
"cloneCancelLink": "Ricomincia da zero",
"workoutsPerWeekLockedByClone": "Bloccato: deve corrispondere al programma di origine.",
"cloneSourceErrorNotFound": "Programma di origine non trovato.",
"cloneSourceErrorForbidden": "Non hai accesso a quel programma di origine."
```

- [ ] **Step 3: Add API error keys to `public/locales/en/errors.json`**

Within the appropriate group (mirror the structure of `program.notFound`):

```json
"program.cloneDenied": "You cannot clone another trainer's program.",
"program.cloneSourceNotFound": "Source program not found.",
"validation.workoutsPerWeekMismatchWithClone": "Workouts per week must match the source program."
```

- [ ] **Step 4: Add Italian translations to `public/locales/it/errors.json`**

```json
"program.cloneDenied": "Non puoi clonare il programma di un altro trainer.",
"program.cloneSourceNotFound": "Programma di origine non trovato.",
"validation.workoutsPerWeekMismatchWithClone": "I giorni di allenamento a settimana devono corrispondere al programma di origine."
```

- [ ] **Step 5: JSON-lint**

Run: `node -e "['en/trainer','it/trainer','en/errors','it/errors'].forEach(p => JSON.parse(require('fs').readFileSync('public/locales/' + p + '.json', 'utf8')))"`

Expected: no output (no parse errors).

- [ ] **Step 6: Commit**

```bash
git add public/locales/en/trainer.json public/locales/it/trainer.json public/locales/en/errors.json public/locales/it/errors.json
git commit -m "i18n: add clone-program copy and error keys"
```

---

## Task 12 — Manual smoke + CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Run all tests**

Run: `npm run test:unit -- --run`

Expected: all green. Fix any failure surfaced by the new code before continuing.

- [ ] **Step 2: Run type-check and lint**

Run in parallel:
- `npm run type-check`
- `npm run lint`

Expected: clean.

- [ ] **Step 3: Manual smoke**

Start the dev server: `npm run dev` (URL: http://localhost:3000).

Verify, signed in as a trainer with at least two programs (any status):

1. `/trainer/programs` — every row shows the new Clone button (clone icon, indigo).
2. Click Clone on a row. URL becomes `/trainer/programs/new?cloneFromProgramId=<id>`. The wizard renders with:
   - Title empty
   - Trainee select pre-set to the source's trainee
   - "SBD program" checkbox matches the source
   - Duration field shows `4`, editable
   - Workouts-per-week input is disabled and shows the source's value; chip buttons are disabled; helper text shown
   - Blue banner above the form: "Cloning skeleton from **<sourceTitle>**." with a "Start blank instead" link that, when clicked, drops the clone query param and resets the form.
3. Adjust duration to 6, submit. Land on `/trainer/programs/<newId>/edit`.
4. Open step 2 (structure). The skeleton rows from the source program appear as draft rows. Save them.
5. `/trainer/trainees/<traineeId>` programs tab — every program row shows the Clone button; clicking it preserves the trainee context query param.

If anything diverges, fix before continuing.

- [ ] **Step 4: Update CHANGELOG**

Append to `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-05-13 — Clone program

Trainers can clone an existing program's skeleton from the action menu on the trainer programs list and the trainee detail programs tab. Clicking Clone navigates to the new-program wizard with trainee, workouts-per-week (locked), and SBD flag pre-filled. On submit, `POST /api/programs` accepts `cloneFromProgramId` and copies `WorkoutSkeleton` rows in the same transaction. No DB writes happen on click.
```

- [ ] **Step 5: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs(changelog): clone program feature"
```

---

## Self-Review

**Spec coverage:**
- Entry points (programs list + trainee detail tab) → Tasks 7, 8 ✓
- Clone click does NOT write to DB → enforced by Tasks 7/8 (just a `<Link>`); confirmed in Task 9 (page.tsx only reads) ✓
- Step 1 prefill (trainee, workoutsPerWeek locked, isSbdProgram, durationWeeks=4, title empty) → Task 10 ✓
- Banner with source title + "Start blank instead" → Task 10 ✓
- Available on all program statuses → Task 7 covers both branches ✓
- Schema with optional `cloneFromProgramId` → Task 1 ✓
- POST clone branch (transaction, copy skeleton) → Task 2 ✓
- 404 / 403 / 400 errors → Tasks 3, 4, 5 ✓
- Atomicity → covered by the `$transaction` wrapping in Task 2 ✓
- Empty source skeleton → Task 2 (second test) ✓
- i18n keys → Task 11 ✓
- CHANGELOG → Task 12 ✓
- E2E intentionally skipped per spec ✓

**Placeholder scan:** None. All steps contain runnable commands or full code blocks.

**Type consistency:**
- `cloneFromProgramId` (camelCase) — used the same way in schema, route, page, content, banner, error keys.
- `cloneSource` shape (`id, title, traineeId, workoutsPerWeek, isSbdProgram`) — defined in Task 9 page.tsx and matches the prop in Task 10.
- `cloneError` values (`'notFound' | 'forbidden' | null`) — same in page.tsx and component test.
- i18n keys (`programs.cloneProgram`, `programs.cloneFromBanner`, `programs.cloneCancelLink`, `programs.workoutsPerWeekLockedByClone`, `programs.cloneSourceErrorNotFound`, `programs.cloneSourceErrorForbidden`, `program.cloneDenied`, `program.cloneSourceNotFound`, `validation.workoutsPerWeekMismatchWithClone`) — referenced identically across UI, API, and locale files.
