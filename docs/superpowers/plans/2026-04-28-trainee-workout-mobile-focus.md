# Trainee Workout Mobile Focus Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trainee workout detail page (`/trainee/workouts/[id]`) layout with a single-exercise focus mode: sticky top bar, focus card, sticky bottom nav, final summary step. Same content, mobile-optimized, applied across all breakpoints.

**Architecture:** Atomic rewrite of `src/app/trainee/workouts/[id]/_content.tsx`. New `currentStep` state replaces `activeExerciseIndex` + `expandedExercises`. The mobile grid AND the desktop table for sets are replaced by one shared layout with inline editing + tap-to-complete. Workout-level notes + submit move to a final "step" reached after the last exercise.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, TypeScript, Vitest + React Testing Library (jsdom), Playwright (e2e), react-i18next, lucide-react icons.

**Reference design doc:** `docs/superpowers/specs/2026-04-28-trainee-workout-mobile-focus-design.md`

---

## File Map

- **Modify** `src/app/trainee/workouts/[id]/_content.tsx` — full render-tree rewrite, new step state, removed list/table layouts.
- **Modify** `public/locales/en/trainee.json` — add new `workouts.*` keys.
- **Modify** `public/locales/it/trainee.json` — add new `workouts.*` keys.
- **Create** `tests/unit/trainee-workout-focus.test.tsx` — unit tests for step navigation + tap-to-complete + final step logic.
- **Modify** `tests/e2e/trainee-complete-workout.spec.ts` — adjust selectors for new layout.

Files explicitly NOT modified (preserved):
- `src/app/trainee/workouts/[id]/page.tsx` (server entry — back nav + role check)
- `src/app/trainee/workouts/[id]/loading.tsx` (already minimal `<NavigationLoadingOverlay />`)
- `src/lib/useSwipe.ts`
- `src/components/RPESelector.tsx`, `src/components/YoutubeEmbed.tsx`, `src/components/ConfirmationModal.tsx`, `src/components/WeekTypeBadge.tsx`, `src/components/Input.tsx`
- `/api/feedback` route handler

---

## Task 1: Add i18n keys

**Files:**
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

- [ ] **Step 1: Add new English keys inside the existing `workouts` block**

Insert these keys before the closing `}` of `workouts` (just before `"errorLoading"`). Do NOT remove existing keys; some are still referenced elsewhere in the codebase.

```json
"dayWeekShort": "D{{day}} · W{{week}}",
"workoutInfo": "Workout info",
"workoutInfoTitle": "Workout details",
"workoutInfoDay": "Day",
"workoutInfoWeek": "Week",
"workoutInfoProgram": "Program",
"next": "Next",
"prev": "Back",
"completeShort": "Complete workout",
"summaryTitle": "Summary",
"summaryStats": "{{done}} / {{total}} exercises · {{sets}} sets",
"missingDataInline": "Exercises with no data:",
"setsHeading": "Sets",
"repsShort": "reps",
"kgShort": "kg",
"stepCounter": "{{current}} / {{total}}",
```

- [ ] **Step 2: Add the matching Italian keys**

Insert into `public/locales/it/trainee.json` inside the `workouts` block at the same location.

```json
"dayWeekShort": "G{{day}} · S{{week}}",
"workoutInfo": "Info allenamento",
"workoutInfoTitle": "Dettagli allenamento",
"workoutInfoDay": "Giorno",
"workoutInfoWeek": "Settimana",
"workoutInfoProgram": "Programma",
"next": "Avanti",
"prev": "Indietro",
"completeShort": "Completa allenamento",
"summaryTitle": "Riepilogo",
"summaryStats": "{{done}} / {{total}} esercizi · {{sets}} set",
"missingDataInline": "Esercizi senza dati:",
"setsHeading": "Serie",
"repsShort": "rip.",
"kgShort": "kg",
"stepCounter": "{{current}} / {{total}}",
```

- [ ] **Step 3: Validate JSON parses**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('public/locales/en/trainee.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/it/trainee.json','utf8')); console.log('OK')"
```
Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/trainee.json public/locales/it/trainee.json
git commit -m "feat(i18n): add trainee workout focus mode keys"
```

---

## Task 2: Scaffold unit test file with shared fixtures

**Files:**
- Create: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Inspect existing test setup conventions**

Run: `cat tests/unit/setup.ts` and `cat vitest.config.ts | head -40`

Look for: jsdom env, RTL imports, mock patterns for `next/navigation`, `react-i18next`. Note any global mocks already in place (e.g. fetch mock, router mock). The new test file should follow the same patterns.

- [ ] **Step 2: Create the test file with the workout fixture and the global mocks needed**

The fixture below mirrors the `Workout` interface inside `_content.tsx`. Two exercises are enough to exercise step navigation; the second one has no `effectiveWeight` to test the empty-defaults branch.

```tsx
// tests/unit/trainee-workout-focus.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useParams: () => ({ id: 'workout-1' }),
    useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, vars?: Record<string, unknown>) => {
            if (!vars) return key
            return Object.entries(vars).reduce(
                (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
                key
            )
        },
    }),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/useSwipe', () => ({
    useSwipe: () => ({ handlers: {} }),
}))

const fixtureWorkout = {
    id: 'workout-1',
    dayIndex: 3,
    notes: null,
    weekNumber: 2,
    weekType: 'normal' as const,
    program: { id: 'p1', title: 'Test Program' },
    exercises: [
        {
            id: 'we-1',
            order: 1,
            variant: null,
            sets: 3,
            reps: '8',
            targetRpe: 8,
            weightType: 'absolute' as const,
            weight: 80,
            effectiveWeight: 80,
            restTime: 'm2' as const,
            isWarmup: false,
            notes: null,
            feedback: null,
            exercise: {
                id: 'ex-1',
                name: 'Bench Press',
                description: null,
                type: 'fundamental' as const,
                youtubeUrl: null,
                notes: null,
            },
        },
        {
            id: 'we-2',
            order: 2,
            variant: 'Close grip',
            sets: 2,
            reps: '10',
            targetRpe: 7,
            weightType: 'percentage_1rm' as const,
            weight: 70,
            effectiveWeight: 60,
            restTime: 'm1' as const,
            isWarmup: false,
            notes: 'Slow eccentric',
            feedback: null,
            exercise: {
                id: 'ex-2',
                name: 'Tricep Extension',
                description: null,
                type: 'accessory' as const,
                youtubeUrl: null,
                notes: null,
            },
        },
    ],
}

beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/trainee/workouts/')) {
            return {
                ok: true,
                json: async () => ({ data: { workout: fixtureWorkout } }),
            } as Response
        }
        return { ok: true, json: async () => ({}) } as Response
    }) as unknown as typeof fetch
    localStorage.clear()
})

const renderContent = async () => {
    const { default: WorkoutDetailContent } = await import(
        '@/app/trainee/workouts/[id]/_content'
    )
    const utils = render(<WorkoutDetailContent />)
    // Wait for fetch to resolve
    await screen.findByText('Bench Press')
    return utils
}

describe('Trainee workout focus mode', () => {
    it.todo('shows only the current exercise card')
    it.todo('advances to the next exercise via the bottom-nav Next button')
    it.todo('returns to the previous exercise via the bottom-nav Back button')
    it.todo('reaches the final summary step after the last exercise')
    it.todo('tapping the set-complete button on a set with empty inputs records the planned reps and effective weight')
    it.todo('keeps inputs editable after a set is marked completed')
    it.todo('shows missing-data warning inline on the final step when no sets are completed')
})
```

- [ ] **Step 3: Run the empty test file to verify scaffolding works**

Run:
```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: tests pass (all `.todo`), no import errors. If imports fail, fix module path / mock surface before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/trainee-workout-focus.test.tsx
git commit -m "test(trainee): scaffold focus mode unit tests"
```

---

## Task 3: Write failing test — only one exercise card visible

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the first `it.todo` with a real test**

Replace `it.todo('shows only the current exercise card')` with:

```tsx
it('shows only the current exercise card', async () => {
    await renderContent()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.queryByText('Tricep Extension')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "shows only the current exercise card"
```
Expected: FAIL — current implementation renders both exercises in a list, so "Tricep Extension" is found.

(If it unexpectedly passes, stop and investigate — the implementation may already match the spec.)

---

## Task 4: Write failing test — bottom-nav Next advances

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the second `it.todo` with a real test**

```tsx
it('advances to the next exercise via the bottom-nav Next button', async () => {
    const user = userEvent.setup()
    await renderContent()
    const nextBtn = screen.getByRole('button', { name: /^Next$|^Avanti$|workouts\.next/i })
    await user.click(nextBtn)
    expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run and verify FAIL**

Run:
```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "advances to the next exercise"
```
Expected: FAIL — there is no `Next` button in the current layout (only the prev/next chevron-only buttons with aria labels).

---

## Task 5: Write failing test — Back returns to previous exercise

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the third `it.todo` with**

```tsx
it('returns to the previous exercise via the bottom-nav Back button', async () => {
    const user = userEvent.setup()
    await renderContent()
    await user.click(screen.getByRole('button', { name: /^Next$|workouts\.next/i }))
    expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Back$|workouts\.prev/i }))
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and verify FAIL**

Run:
```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "returns to the previous exercise"
```
Expected: FAIL.

---

## Task 6: Write failing test — final summary step

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the fourth `it.todo` with**

```tsx
it('reaches the final summary step after the last exercise', async () => {
    const user = userEvent.setup()
    await renderContent()
    // step 0 -> 1 (Tricep Extension)
    await user.click(screen.getByRole('button', { name: /^Next$|workouts\.next/i }))
    // step 1 -> 2 (final)
    await user.click(screen.getByRole('button', { name: /^Next$|workouts\.next/i }))
    expect(screen.getByText(/workouts\.summaryTitle|Summary|Riepilogo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /workouts\.completeShort|Complete workout|Completa allenamento/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and verify FAIL**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "reaches the final summary step"
```
Expected: FAIL.

---

## Task 7: Write failing test — tap-to-complete uses planned defaults

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the fifth `it.todo` with**

```tsx
it('tapping the set-complete button on a set with empty inputs records the planned reps and effective weight', async () => {
    const user = userEvent.setup()
    await renderContent()
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone|Mark set as done/i })
    expect(checkButtons.length).toBeGreaterThanOrEqual(3)
    await user.click(checkButtons[0])

    const repsInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    // First reps input (set #1, col reps) — should now hold planned 8
    expect(repsInputs[0].value).toBe('8')
    // First kg input (set #1, col kg) — should now hold planned effectiveWeight 80
    expect(repsInputs[1].value).toBe('80')
})
```

- [ ] **Step 2: Run and verify FAIL**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "tapping the set-complete button"
```
Expected: FAIL — current implementation marks the set complete but does NOT auto-populate planned values.

---

## Task 8: Write failing test — inputs editable after completion

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the sixth `it.todo` with**

```tsx
it('keeps inputs editable after a set is marked completed', async () => {
    const user = userEvent.setup()
    await renderContent()
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone|Mark set as done/i })
    await user.click(checkButtons[0])
    const repsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    expect(repsInput).not.toBeDisabled()
    await user.clear(repsInput)
    await user.type(repsInput, '7')
    expect(repsInput.value).toBe('7')
})
```

- [ ] **Step 2: Run and verify FAIL**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "keeps inputs editable"
```
Expected: FAIL — current implementation sets `disabled={!!set.completed}` on inputs.

---

## Task 9: Write failing test — inline missing-data warning

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace the seventh `it.todo` with**

```tsx
it('shows missing-data warning inline on the final step when no sets are completed', async () => {
    const user = userEvent.setup()
    await renderContent()
    await user.click(screen.getByRole('button', { name: /^Next$|workouts\.next/i }))
    await user.click(screen.getByRole('button', { name: /^Next$|workouts\.next/i }))
    // On final step. No sets done in either exercise.
    expect(screen.getByText(/workouts\.missingDataInline|Exercises with no data|Esercizi senza dati/i)).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and verify FAIL**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "shows missing-data warning"
```
Expected: FAIL.

- [ ] **Step 3: Commit all failing tests**

```bash
git add tests/unit/trainee-workout-focus.test.tsx
git commit -m "test(trainee): add failing tests for focus mode"
```

---

## Task 10: Implement focus mode — full rewrite of `_content.tsx`

This is the largest task. Steps are intentionally split so the rewrite happens with checkpoints.

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

- [ ] **Step 1: Open the current file in your editor**

Run: `wc -l src/app/trainee/workouts/[id]/_content.tsx`
Expected: ~1018 lines.

Read the existing implementation top-to-bottom to confirm: state shape, `fetchWorkout`, draft sync logic, `handleSubmit`, `doSubmit`, helpers (`parsePlannedReps`, `formatRestTime`, `formatWeightValue`, `formatWeightKg`), interfaces. The rewrite preserves all of these — only the render tree and a small slice of state change.

- [ ] **Step 2: Replace the imports block at the top of the file**

The imports below drop `WeekTypeBanner` (replaced by smaller chip) and add `WeekTypeBadge`, `Info`, `ChevronLeft`, `ChevronRight`, `AlertTriangle`. The `ConfirmationModal` import is removed because the missing-data modal flow is gone.

```tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { RPESelector, SkeletonDetail, WeekTypeBadge } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock3,
    FileText,
    Gauge,
    Info,
    PlayCircle,
    X,
} from 'lucide-react'
import YoutubeEmbed from '@/components/YoutubeEmbed'
import { useSwipe } from '@/lib/useSwipe'
import * as Sentry from '@sentry/nextjs'
import { useToast } from '@/components/ToastNotification'
import { Input } from '@/components/Input'
```

- [ ] **Step 3: Keep all existing interfaces and helper constants unchanged**

Do not modify: `Exercise`, `ExerciseFeedback`, `WorkoutExerciseWithWeight`, `SetPerformed`, `ExerciseRPE`, `Workout`, `parsePlannedReps`, `formatRestTime`, `formatWeightValue`, `formatWeightKg`, `RPE_OPTIONS`.

- [ ] **Step 4: Replace the component body — state declarations**

Within the `WorkoutDetailContent` function, replace the state block (lines ~137–164) with this. The differences vs current code: removed `expandedExercises`, `activeExerciseIndex`, `exerciseRefs`, `confirmModal`. Added `currentStep`, `infoSheetOpen`.

```tsx
const { t } = useTranslation('trainee')
const router = useRouter()
const params = useParams()
const searchParams = useSearchParams()
const workoutId = params.id as string
const fromParam = searchParams.get('from') ?? 'dashboard'

const [loading, setLoading] = useState(true)
const [submitting, setSubmitting] = useState(false)
const [workout, setWorkout] = useState<Workout | null>(null)
const [error, setError] = useState<string | null>(null)

const [feedbackData, setFeedbackData] = useState<Record<string, SetPerformed[]>>({})
const [exerciseRPE, setExerciseRPE] = useState<Record<string, number | null>>({})
const [globalNotes, setGlobalNotes] = useState('')
const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({})
const [currentStep, setCurrentStep] = useState(0)
const [infoSheetOpen, setInfoSheetOpen] = useState(false)

const { showToast } = useToast()
const draftSyncEnabledRef = useRef(false)
const persistedExerciseIdsRef = useRef<Set<string>>(new Set())
const touchedExerciseIdsRef = useRef<Set<string>>(new Set())
const draftSyncTimeoutRef = useRef<number | null>(null)
const draftSyncPromiseRef = useRef<Promise<void> | null>(null)
const draftSyncPausedRef = useRef(false)

const STORAGE_KEY = `workout_${workoutId}_feedback`
```

- [ ] **Step 5: Keep `fetchWorkout`, `loadLocalData`, `saveLocalData`, `clearLocalData`, `syncDraftFeedback`, all related useEffects, `updateSet`, `updateExerciseRPE`, `toggleVideo`, `calculateExerciseVolume` unchanged**

The only changes to `fetchWorkout`: remove the lines that build `initialExpanded` and the `setExpandedExercises(initialExpanded)` / `setActiveExerciseIndex(0)` calls. Replace them with a single `setCurrentStep(0)`.

In `fetchWorkout`, replace this snippet:

```tsx
const initialExpanded: Record<string, boolean> = {}
const orderedExercises = [...data.data.workout.exercises].sort(
    (left: WorkoutExerciseWithWeight, right: WorkoutExerciseWithWeight) => left.order - right.order
)

orderedExercises.forEach((we: WorkoutExerciseWithWeight, index: number) => {
    // ... existing feedback init body ...
    initialExpanded[we.id] = index === 0
})

setFeedbackData(initialFeedback)
setExerciseRPE(initialRPE)
setExpandedExercises(initialExpanded)
setActiveExerciseIndex(0)
draftSyncEnabledRef.current = false
```

with:

```tsx
const orderedExercises = [...data.data.workout.exercises].sort(
    (left: WorkoutExerciseWithWeight, right: WorkoutExerciseWithWeight) => left.order - right.order
)

orderedExercises.forEach((we: WorkoutExerciseWithWeight) => {
    if (we.feedback) {
        persistedExerciseIdsRef.current.add(we.id)
        initialFeedback[we.id] = we.feedback.setsPerformed.map(sp => ({
            setNumber: sp.setNumber,
            weight: sp.weight,
            reps: sp.reps,
            completed: sp.completed ?? true,
        }))
        initialRPE[we.id] = we.feedback.avgRPE
        if (we.feedback.notes) {
            setGlobalNotes(we.feedback.notes)
        }
    } else {
        const plannedReps = parsePlannedReps(we.reps)
        initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
            setNumber: i + 1,
            weight: we.effectiveWeight || 0,
            reps: plannedReps,
            completed: false,
        }))
        initialRPE[we.id] = we.targetRpe
    }
})

setFeedbackData(initialFeedback)
setExerciseRPE(initialRPE)
setCurrentStep(0)
draftSyncEnabledRef.current = false
```

Note: the planned-defaults are still pre-loaded into `feedbackData` (current behavior). The tap-to-complete shortcut implemented in Step 7 covers the case when a user has manually cleared inputs to `0` then taps ✓.

- [ ] **Step 6: Replace `toggleSetCompleted` to add the planned-defaults shortcut**

Replace the existing function with:

```tsx
const toggleSetCompleted = (workoutExerciseId: string, setIndex: number) => {
    if (!workout) return
    const we = workout.exercises.find((e) => e.id === workoutExerciseId)
    if (!we) return

    touchedExerciseIdsRef.current.add(workoutExerciseId)

    setFeedbackData((prev) => {
        const updated = { ...prev }
        const sets = [...(prev[workoutExerciseId] || [])]
        const currentSet = sets[setIndex]
        const willComplete = !currentSet.completed

        if (willComplete && (currentSet.weight === 0 || currentSet.reps === 0)) {
            const plannedReps = parsePlannedReps(we.reps)
            const plannedWeight = we.effectiveWeight ?? we.weight ?? 0
            sets[setIndex] = {
                ...currentSet,
                weight: currentSet.weight === 0 ? plannedWeight : currentSet.weight,
                reps: currentSet.reps === 0 ? plannedReps : currentSet.reps,
                completed: true,
            }
        } else {
            sets[setIndex] = { ...currentSet, completed: willComplete }
        }

        updated[workoutExerciseId] = sets
        return updated
    })
}
```

- [ ] **Step 7: Add new helpers + derived values inside the component (above the `if (loading)` early return)**

```tsx
const sortedExercises = useMemo(
    () => (workout ? [...workout.exercises].sort((a, b) => a.order - b.order) : []),
    [workout]
)

const totalSteps = sortedExercises.length + 1 // +1 for the final summary step
const isFinalStep = currentStep === sortedExercises.length

const goToStep = useCallback(
    (next: number) => {
        const clamped = Math.max(0, Math.min(next, sortedExercises.length))
        setCurrentStep(clamped)
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    },
    [sortedExercises.length]
)

const completedExerciseCount = useMemo(
    () =>
        sortedExercises.reduce((acc, we) => {
            const sets = feedbackData[we.id] || []
            return acc + (sets.some((s) => s.completed) ? 1 : 0)
        }, 0),
    [feedbackData, sortedExercises]
)

const totalCompletedSets = useMemo(
    () =>
        sortedExercises.reduce((acc, we) => {
            const sets = feedbackData[we.id] || []
            return acc + sets.filter((s) => s.completed).length
        }, 0),
    [feedbackData, sortedExercises]
)

const emptyExerciseNames = useMemo(
    () =>
        sortedExercises
            .filter((we) => {
                const sets = feedbackData[we.id] || []
                return !sets.some((s) => s.completed && s.weight > 0 && s.reps > 0)
            })
            .map((we) => we.exercise.name),
    [feedbackData, sortedExercises]
)
```

- [ ] **Step 8: Replace `handleSubmit` to drop the `ConfirmationModal` flow**

Because the missing-data warning now appears inline on the final step before the user can submit, we no longer open a confirmation modal — we just call `doSubmit` directly. `doSubmit` itself is unchanged.

```tsx
const handleSubmit = () => {
    if (!workout) return
    void doSubmit()
}
```

- [ ] **Step 9: Replace the whole render tree (loading + error + main return)**

The new return body. Replaces everything from the `if (loading)` block through the closing `</div>` of the original component.

```tsx
if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
            <SkeletonDetail />
        </div>
    )
}

if (error || !workout) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error || t('workouts.errorNotFound')}
            </div>
        </div>
    )
}

const rpeDescriptions = RPE_OPTIONS.reduce<Record<number, string>>((acc, option) => {
    acc[option.value] = t(`workouts.rpeOptions.${option.labelKey}`)
    return acc
}, {})

const currentExercise = !isFinalStep ? sortedExercises[currentStep] : null

return (
    <div className="flex min-h-screen flex-col bg-gray-50" {...pageSwipeHandlers}>
        {/* Sticky top bar */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                    {t('workouts.dayWeekShort', {
                        day: workout.dayIndex,
                        week: workout.weekNumber,
                    })}
                </span>
                {workout.weekType !== 'normal' && (
                    <WeekTypeBadge weekType={workout.weekType} />
                )}
            </div>
            <button
                type="button"
                onClick={() => setInfoSheetOpen(true)}
                aria-label={t('workouts.workoutInfo')}
                className="rounded-full p-2 text-gray-500 hover:text-gray-700"
            >
                <Info className="h-5 w-5" />
            </button>
        </header>

        {/* Info bottom sheet */}
        {infoSheetOpen && (
            <div
                className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40"
                onClick={() => setInfoSheetOpen(false)}
            >
                <div
                    className="rounded-t-2xl bg-white p-6 pb-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-4 flex items-start justify-between">
                        <h2 className="text-lg font-bold text-gray-900">
                            {t('workouts.workoutInfoTitle')}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setInfoSheetOpen(false)}
                            aria-label={t('workouts.workoutInfo')}
                            className="rounded-full p-1 text-gray-500 hover:text-gray-700"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <dl className="space-y-3 text-sm">
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-500">
                                {t('workouts.workoutInfoProgram')}
                            </dt>
                            <dd className="font-medium text-gray-900">{workout.program.title}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-500">
                                {t('workouts.workoutInfoDay')}
                            </dt>
                            <dd className="font-medium text-gray-900">{workout.dayIndex}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-500">
                                {t('workouts.workoutInfoWeek')}
                            </dt>
                            <dd className="font-medium text-gray-900">
                                {t('workouts.weekLabel', { number: workout.weekNumber })}
                            </dd>
                        </div>
                        {workout.notes && (
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-gray-500">
                                    {t('workouts.notesLabel')}
                                </dt>
                                <dd className="text-gray-700">{workout.notes}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            </div>
        )}

        {/* Body */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl">
                {currentExercise && (
                    <ExerciseFocusCard
                        we={currentExercise}
                        sets={feedbackData[currentExercise.id] || []}
                        rpe={exerciseRPE[currentExercise.id] ?? null}
                        videoExpanded={expandedVideos[currentExercise.id] ?? false}
                        onToggleVideo={() => toggleVideo(currentExercise.id)}
                        onUpdateSet={updateSet}
                        onToggleSet={toggleSetCompleted}
                        onUpdateRpe={(v) => updateExerciseRPE(currentExercise.id, v)}
                        rpeDescriptions={rpeDescriptions}
                        t={t}
                    />
                )}

                {isFinalStep && (
                    <FinalStep
                        completed={completedExerciseCount}
                        total={sortedExercises.length}
                        totalSets={totalCompletedSets}
                        emptyExerciseNames={emptyExerciseNames}
                        notes={globalNotes}
                        onNotesChange={setGlobalNotes}
                        t={t}
                    />
                )}
            </div>
        </main>

        {/* Sticky bottom nav */}
        <nav
            className="sticky bottom-0 z-20 flex h-16 items-center justify-between gap-2 border-t border-gray-200 bg-white px-4"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <button
                type="button"
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === 0}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 disabled:text-gray-300"
            >
                <ChevronLeft className="h-5 w-5" />
                {t('workouts.prev')}
            </button>

            {!isFinalStep && (
                <span className="text-xs font-medium text-gray-500">
                    {t('workouts.stepCounter', {
                        current: currentStep + 1,
                        total: sortedExercises.length,
                    })}
                </span>
            )}

            {!isFinalStep ? (
                <button
                    type="button"
                    onClick={() => goToStep(currentStep + 1)}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-brand-primary"
                >
                    {t('workouts.next')}
                    <ChevronRight className="h-5 w-5" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-lg border border-brand-primary bg-white px-4 py-2 text-sm font-semibold text-brand-primary disabled:border-gray-300 disabled:text-gray-400"
                >
                    {submitting ? (
                        <LoadingSpinner size="sm" color="primary" />
                    ) : (
                        <>
                            <Check className="h-4 w-4" />
                            {t('workouts.completeShort')}
                        </>
                    )}
                </button>
            )}
        </nav>
    </div>
)
```

Note: `pageSwipeHandlers` declaration must be added immediately above this return block:

```tsx
const { handlers: pageSwipeHandlers } = useSwipe({
    onSwipeLeft: () => goToStep(currentStep + 1),
    onSwipeRight: () => goToStep(currentStep - 1),
    threshold: 80,
})
```

- [ ] **Step 10: Add the `ExerciseFocusCard` and `FinalStep` subcomponents at the bottom of the same file**

These are co-located helpers — keep them in the same module to avoid prop-drilling refactors.

```tsx
interface ExerciseFocusCardProps {
    we: WorkoutExerciseWithWeight
    sets: SetPerformed[]
    rpe: number | null
    videoExpanded: boolean
    onToggleVideo: () => void
    onUpdateSet: (id: string, idx: number, field: 'weight' | 'reps', value: number) => void
    onToggleSet: (id: string, idx: number) => void
    onUpdateRpe: (rpe: number | null) => void
    rpeDescriptions: Record<number, string>
    t: (key: string, vars?: Record<string, unknown>) => string
}

function ExerciseFocusCard({
    we,
    sets,
    rpe,
    videoExpanded,
    onToggleVideo,
    onUpdateSet,
    onToggleSet,
    onUpdateRpe,
    rpeDescriptions,
    t,
}: ExerciseFocusCardProps) {
    const trainerSettingValue = (() => {
        if (typeof we.weight !== 'number' || !Number.isFinite(we.weight)) {
            return '-'
        }
        const formattedWeight = formatWeightValue(we.weight)
        switch (we.weightType) {
            case 'absolute':
                return `${formattedWeight} kg`
            case 'percentage_1rm':
                return `${formattedWeight}% 1RM`
            case 'percentage_rm':
                return `${formattedWeight}% RM`
            case 'percentage_previous': {
                const sign = we.weight > 0 ? '+' : ''
                return `${sign}${formattedWeight}%`
            }
            default:
                return formattedWeight
        }
    })()

    const calculatedWeightValue =
        we.weightType === 'absolute'
            ? formatWeightKg(we.effectiveWeight ?? we.weight)
            : formatWeightKg(we.effectiveWeight)
    const calculatedWeightMissing = calculatedWeightValue === '-'
    const compactWeightValue =
        we.weightType !== 'absolute'
            ? `${calculatedWeightMissing ? t('workouts.calculatedWeightMissing') : calculatedWeightValue} (${trainerSettingValue})`
            : calculatedWeightValue

    const plannedRepsHint = String(parsePlannedReps(we.reps) || '')
    const plannedKgHint = we.effectiveWeight ? formatWeightValue(we.effectiveWeight) : ''

    return (
        <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
            {/* Title row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                    className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        we.exercise.type === 'fundamental'
                            ? 'border-red-300 bg-white text-red-700'
                            : 'border-blue-300 bg-white text-blue-700'
                    }`}
                >
                    {we.exercise.type === 'fundamental'
                        ? t('workouts.tagFundamentalShort')
                        : t('workouts.tagAccessoryShort')}
                </span>
                <h3 className="text-xl font-bold text-gray-900">{we.exercise.name}</h3>
            </div>
            {we.variant && (
                <p className="mb-4 text-sm font-medium text-gray-600">{we.variant}</p>
            )}

            {/* Big targets row */}
            <div className="mb-3 flex gap-2">
                <div className="flex-1 rounded-lg bg-gray-100 px-2 py-3 text-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('workouts.sets')}
                    </span>
                    <span className="mt-1 block text-2xl font-bold text-gray-900">
                        {we.sets}
                    </span>
                </div>
                <div className="flex-1 rounded-lg bg-gray-100 px-2 py-3 text-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('workouts.reps')}
                    </span>
                    <span className="mt-1 block text-2xl font-bold text-gray-900">
                        {we.reps}
                    </span>
                </div>
                <div className="flex-1 rounded-lg bg-gray-100 px-2 py-3 text-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        KG
                    </span>
                    <span
                        className={`mt-1 block text-base font-bold leading-snug ${
                            calculatedWeightMissing ? 'text-gray-500' : 'text-gray-900'
                        }`}
                    >
                        {compactWeightValue}
                    </span>
                </div>
            </div>

            {/* Secondary line: rest + RPE */}
            <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatRestTime(we.restTime)}
                </span>
                {we.targetRpe !== null && we.targetRpe !== undefined && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                        <Gauge className="h-3.5 w-3.5" />
                        {we.targetRpe}
                    </span>
                )}
            </div>

            {/* Video */}
            {we.exercise.youtubeUrl && (
                <div className="mb-4" data-swipe-ignore="true">
                    <button
                        type="button"
                        onClick={onToggleVideo}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand-primary hover:text-brand-primary sm:w-auto"
                    >
                        <PlayCircle className="h-4 w-4" />
                        {videoExpanded ? t('workouts.hideVideo') : t('workouts.showVideo')}
                        {videoExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                    {videoExpanded && (
                        <div className="mt-3">
                            <YoutubeEmbed videoUrl={we.exercise.youtubeUrl} />
                        </div>
                    )}
                </div>
            )}

            {/* Coach notes */}
            {we.notes && (
                <p className="mb-4 text-sm italic text-gray-600">
                    <FileText className="mr-1 inline h-4 w-4" />
                    {we.notes}
                </p>
            )}

            {/* Sets heading */}
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {t('workouts.setsHeading')}
            </h4>

            {/* Sets list */}
            <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-white p-2">
                {sets.map((set, setIdx) => (
                    <div
                        key={setIdx}
                        className="grid grid-cols-[40px_1fr_1fr_48px] items-center gap-2 border-b border-gray-100 py-2 last:border-b-0"
                    >
                        <span className="text-center text-sm font-semibold text-gray-700">
                            #{set.setNumber}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                            <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={set.reps || ''}
                                placeholder={plannedRepsHint}
                                onChange={(e) =>
                                    onUpdateSet(we.id, setIdx, 'reps', parseInt(e.target.value) || 0)
                                }
                                aria-label={`${t('workouts.reps')} ${set.setNumber}`}
                                inputSize="md"
                                className="h-10 w-16 px-2 text-center focus:ring-brand-primary"
                            />
                            <span className="text-xs text-gray-400">{t('workouts.repsShort')}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                inputMode="decimal"
                                value={set.weight || ''}
                                placeholder={plannedKgHint}
                                onChange={(e) =>
                                    onUpdateSet(we.id, setIdx, 'weight', parseFloat(e.target.value) || 0)
                                }
                                aria-label={`${t('workouts.weightKg')} ${set.setNumber}`}
                                inputSize="md"
                                className="h-10 w-20 px-2 text-center focus:ring-brand-primary"
                            />
                            <span className="text-xs text-gray-400">{t('workouts.kgShort')}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleSet(we.id, setIdx)}
                            className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                set.completed
                                    ? 'border-green-300 bg-green-100 text-green-700'
                                    : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                            }`}
                            aria-label={
                                set.completed
                                    ? t('workouts.markSetUndone')
                                    : t('workouts.markSetDone')
                            }
                            title={
                                set.completed
                                    ? t('workouts.markSetUndone')
                                    : t('workouts.markSetDone')
                            }
                        >
                            <Check className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Overall RPE */}
            <div className="rounded-lg bg-gray-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-semibold text-gray-700">
                        {t('workouts.overallRpe')}
                    </label>
                    <RPESelector
                        value={rpe}
                        onChange={onUpdateRpe}
                        showLabel={false}
                        centeredMenu={true}
                        title={t('workouts.overallRpe')}
                        placeholder={t('workouts.selectRpe')}
                        descriptions={rpeDescriptions}
                        className="w-full min-w-0 sm:w-auto sm:min-w-[240px]"
                    />
                </div>
            </div>
        </div>
    )
}

interface FinalStepProps {
    completed: number
    total: number
    totalSets: number
    emptyExerciseNames: string[]
    notes: string
    onNotesChange: (value: string) => void
    t: (key: string, vars?: Record<string, unknown>) => string
}

function FinalStep({
    completed,
    total,
    totalSets,
    emptyExerciseNames,
    notes,
    onNotesChange,
    t,
}: FinalStepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('workouts.summaryTitle')}</h2>
                <p className="mt-1 text-sm text-gray-600">
                    {t('workouts.summaryStats', {
                        done: completed,
                        total,
                        sets: totalSets,
                    })}
                </p>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-md">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                    {t('workouts.notesLabel')}
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder={t('workouts.notesPlaceholder')}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-brand-primary"
                />
            </div>

            {emptyExerciseNames.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        {t('workouts.missingDataInline')}
                    </div>
                    <ul className="ml-6 list-disc text-sm">
                        {emptyExerciseNames.map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 11: Run typecheck**

```bash
npm run type-check
```
Expected: PASS. Resolve any TS errors before proceeding (likely candidates: unused imports `ChevronUp` if you forgot to remove it, missing `WeekTypeBadge` props).

- [ ] **Step 12: Run unit tests**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: ALL 7 tests PASS.

If any test fails, debug it inline (do NOT relax the test). Common failure points:
- Multiple `Next` buttons matched: tighten the regex to `/^workouts\.next$/` after confirming the i18n mock returns the raw key.
- `userEvent.click` doesn't fire change handlers: use `fireEvent.click` instead.
- `screen.getAllByRole('spinbutton')` returns wrong order: order matches DOM render order — assert against the first two spinbuttons (set #1 reps, set #1 kg).

- [ ] **Step 13: Run lint**

```bash
npm run lint
```
Expected: PASS. Fix any unused-import warnings (`Link`, `WeekTypeBanner`, `ConfirmationModal`, `ChevronUp` etc. if any are still imported but no longer used).

- [ ] **Step 14: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx
git commit -m "feat(trainee): single-exercise focus mode for workout detail"
```

---

## Task 11: Update e2e test selectors

**Files:**
- Modify: `tests/e2e/trainee-complete-workout.spec.ts`

- [ ] **Step 1: Identify selectors that no longer exist**

Read `tests/e2e/trainee-complete-workout.spec.ts` end-to-end (~250 lines). The selectors most likely affected:
- `'button:has-text("Completa Workout")'` (line ~204) → now `Completa allenamento` (i18n key `workouts.completeShort`).
- Any selector that targets the old prev/next chevron arrows (aria-labels `prevExercise` / `nextExercise`) — those buttons no longer exist; replace with the bottom-nav `Avanti` / `Indietro` buttons.
- Any selector relying on rendering MULTIPLE exercise cards simultaneously (e.g. `locator('.exercise-card').nth(1)`). The new layout shows ONE at a time, so navigation must use the bottom-nav `Avanti` button.
- The expand chevron on each card (`▲`/`▼`) is gone — there is no per-card collapse anymore.

- [ ] **Step 2: Update the submit-button selector**

Find:
```ts
const submitBtn = page.locator('button:has-text("Completa Workout")')
```
Replace with:
```ts
const submitBtn = page.locator('button:has-text("Completa allenamento")')
```

- [ ] **Step 3: Update the "fill all sets" loop to navigate exercise-by-exercise**

Whatever the current loop does (reading the existing test will tell you), it must:
1. Fill / mark sets on the visible exercise.
2. Click `button:has-text("Avanti")` to advance to the next exercise.
3. Repeat until the bottom-nav exposes the `Completa allenamento` CTA (i.e., we're on the final step).
4. Click submit.

If the existing test already iterates exercises by index, switch to:
```ts
const advanceButton = page.locator('nav button:has-text("Avanti")')
while (await advanceButton.isVisible()) {
    // fill the visible card here
    await advanceButton.click()
}
```

Read the actual test before editing — adapt the rewrite to its existing fill helpers.

- [ ] **Step 4: Run e2e test in headed mode against local dev**

Pre-flight: `npm run dev` in another terminal, then:
```bash
npx playwright test tests/e2e/trainee-complete-workout.spec.ts --headed --project=chromium
```
Expected: PASS, including the success-toast assertion at the end.

If the test seeds rely on a workout with active state, the e2e environment must already provide `trainee1@zerocento.app` per the file's docstring. If the workout has been completed by a previous test run, reset via `npm run prisma:seed` first.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/trainee-complete-workout.spec.ts
git commit -m "test(e2e): update workout selectors for focus mode"
```

---

## Task 12: Manual smoke test

**Files:**
- (none — verification step)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Sign in as a trainee with an active program and open a workout**

Navigate to `/trainee/programs/current`, click into the next workout. You should land at `/trainee/workouts/{id}`.

- [ ] **Step 3: Verify each section against the spec**

Confirm each item:
- Sticky top bar shows `G{day} · S{week}` and a week-type chip only when not normal.
- Tapping the info icon opens a sheet showing program / day / week.
- Only ONE exercise card is rendered.
- The big targets row shows three equal-width tiles.
- Rest + target RPE pills are on a single line below the targets.
- Sets list uses inline inputs with placeholders showing planned reps / kg.
- Tapping ✓ on a set with empty inputs populates planned reps + planned weight.
- Inputs remain editable after marking a set complete.
- Bottom nav is sticky and shows `Indietro / N / M / Avanti`.
- Swiping left advances; swiping right goes back. Page-level swipe does NOT trigger when starting on the YouTube embed (data-swipe-ignore preserved).
- After the last exercise, `Avanti` advances to the summary step.
- Summary shows `done / total esercizi · sets set` and the notes textarea.
- If any exercise has no completed set, the inline missing-data warning lists it.
- Tapping `Completa allenamento` submits, shows the success toast, and redirects to the dashboard (or `/trainee/programs/current` if `?from=current`).

- [ ] **Step 4: Verify on a narrow viewport (~360px)**

Use Chrome DevTools device toolbar. Confirm no horizontal overflow, no clipped text, the bottom nav still fits.

- [ ] **Step 5: Verify on desktop (≥1024px)**

Confirm the layout is the SAME (single card, sticky top bar, sticky bottom nav) — no list view appears. The `max-w-2xl mx-auto` keeps the card a sensible width on wide screens.

- [ ] **Step 6: Update CHANGELOG**

Per the project's workflow rule, append a brief entry to `implementation-docs/CHANGELOG.md` describing the redesign and pointing at the spec file.

- [ ] **Step 7: Commit CHANGELOG**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs(changelog): trainee workout mobile focus mode"
```

---

## Acceptance Criteria (from spec)

1. Visiting `/trainee/workouts/{id}` shows only ONE exercise card at a time, never a list.
2. Header chrome above first exercise is at most ~48px (sticky top bar) — title/program/banner moved to info sheet.
3. Bottom nav is always visible at viewport bottom; `Avanti` past the last exercise opens the notes/summary step; tapping the CTA there submits the workout.
4. Tapping the ✓ on a set with empty inputs records planned reps + planned effective weight as the actual values (no manual typing required).
5. Inputs remain editable after a set is marked completed.
6. Existing draft sync, localStorage persistence, and successful submit redirect (to dashboard or `/trainee/programs/current` based on `from` param) work unchanged.
7. Layout applied identically across all breakpoints — no `md:` list view.
8. Existing unit and e2e tests still pass; new tests added for step navigation and the tap-to-complete shortcut.
