# Trainee Single-Set Autosave Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that a single set marked completed by the trainee on `/trainee/workouts/[id]` is persisted to the server even if the user immediately backgrounds the app, closes the tab, or reloads — and is correctly re-displayed after reload.

**Scope:** This plan touches **only** the single-set autosave path (`PATCH /api/trainee/workout-exercises/[id]/feedback` with a `set` payload). RPE-only autosave, exercise-note autosave, the workout submit endpoint, and the autosave schemas are explicitly **out of scope** for this iteration. Their current behavior is preserved.

**Architecture:** Three small fixes on the set-autosave path:

1. **Reliable transport** — `persistExerciseFeedback` uses `fetch(..., { keepalive: true })` with a 10s `AbortSignal.timeout` fallback. Targets the reported bug: a backgrounded/closing tab still completes the request.
2. **Pad missing sets on reload** — `fetchWorkout` pads `setsPerformed` up to `we.sets`. Defends against the residual case where a set-autosave never landed: UI still shows all prescribed set rows so the user can re-tap.
3. **Server-first mount** — the `useEffect` race between `fetchWorkout()` and `loadLocalData()` is removed by sequencing them, and `loadLocalData()` no longer rehydrates `feedbackData` from localStorage on mount. The legacy `workout_<id>_feedback` localStorage key keeps being **written** in its current shape because `ProgramDetailContent.tsx:165` reads it for the dashboard "in-progress" badge.

**Out of scope (intentional):**
- A retry/queue for failed autosaves (we rely on `keepalive` + user re-tap).
- Partial-update semantics for `PATCH /feedback` (separate plan, only useful when handler payloads change).
- The submit POST endpoint (`POST /api/trainee/workouts/[id]/submit`) — left exactly as it is today.
- `updateExerciseRPE` and `saveExerciseNote` — left exactly as they are today.
- `workoutSubmitSchema`, `workoutExerciseAutosaveSchema` — left exactly as they are today.

If post-deploy telemetry shows residual `network error` / 5xx / 429 on the autosave endpoint, revisit and add a retry queue in a follow-up plan.

**Tech Stack:** Next.js 15 App Router, React 18 client components, Prisma 5 (PostgreSQL), Vitest (jsdom), react-i18next, Sentry.

---

## File Structure

**New files:**
- `src/lib/keepalive-fetch.ts` — thin wrapper that calls `fetch` with `keepalive: true` and, when no `signal` is provided, attaches an `AbortSignal.timeout(10_000)`. Used by the set autosave handler only.
- `tests/unit/keepalive-fetch.test.ts` — unit tests for the wrapper.

**Modified files:**
- `src/app/trainee/workouts/[id]/_content.tsx` — `persistExerciseFeedback` uses `keepaliveFetch`; `fetchWorkout` pads `setsPerformed`; mount no longer rehydrates `feedbackData` from localStorage (server-only). `saveLocalData` is unchanged so the legacy key still feeds `ProgramDetailContent`.
- `tests/unit/trainee-workout-focus.test.tsx` — add tests for keepalive on set autosave, pad behavior, race resolution, legacy-shape localStorage write.
- `implementation-docs/CHANGELOG.md` — append entry in the repo's house format (Task 5).
- `implementation-docs/CHECKLIST.md` — append a Sprint task entry (Task 5).

**Untouched (verified):**
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx:165` reads `workout_<workoutId>_feedback` and inspects `parsed.feedbackData`. The plan preserves the key and its shape.
- `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts` — set autosave already uses `setPerformed.upsert` and is idempotent under replay (verified in `tests/integration/workout-exercise-feedback.test.ts`).
- `src/app/api/trainee/workouts/[id]/submit/route.ts` — left as today.
- `src/schemas/feedback.ts` — left as today.

---

## Task 1: Keepalive Fetch Helper

**Files:**
- Create: `src/lib/keepalive-fetch.ts`
- Test: `tests/unit/keepalive-fetch.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/keepalive-fetch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { keepaliveFetch } from '@/lib/keepalive-fetch'

describe('keepaliveFetch', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('passes keepalive: true to the underlying fetch', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ a: 1 }),
        })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const init = fetchSpy.mock.calls[0][1]
        expect(init.keepalive).toBe(true)
        expect(init.method).toBe('PATCH')
    })

    it('does not override an explicit keepalive: false', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', { method: 'POST', keepalive: false })

        expect(fetchSpy.mock.calls[0][1].keepalive).toBe(false)
    })

    it('attaches a 10s AbortSignal.timeout when no signal is provided', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', { method: 'PATCH' })

        const init = fetchSpy.mock.calls[0][1]
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('respects a caller-provided AbortSignal', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        const controller = new AbortController()
        await keepaliveFetch('/api/x', { method: 'PATCH', signal: controller.signal })

        expect(fetchSpy.mock.calls[0][1].signal).toBe(controller.signal)
    })
})
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `npx vitest run tests/unit/keepalive-fetch.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement keepaliveFetch**

```ts
// src/lib/keepalive-fetch.ts
const DEFAULT_TIMEOUT_MS = 10_000

export function keepaliveFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const merged: RequestInit = {
        ...init,
        keepalive: init.keepalive ?? true,
        signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }
    return fetch(input, merged)
}
```

`AbortSignal.timeout` is available in all browsers Next.js 15 targets (Chrome 103+, Safari 16+, Firefox 100+) and in Node 17.3+. If the test runtime pins an older Node, add a polyfill in `tests/unit/setup.ts`.

- [ ] **Step 4: Run the tests, expect PASS**

Run: `npx vitest run tests/unit/keepalive-fetch.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/keepalive-fetch.ts tests/unit/keepalive-fetch.test.ts
git commit -m "feat(lib): add keepaliveFetch wrapper for background-safe PATCH/POST"
```

---

## Task 2: Set Autosave Uses `keepaliveFetch`

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:317-409` (`persistExerciseFeedback`)
- Test: `tests/unit/trainee-workout-focus.test.tsx`

**Important:** This task changes ONLY the transport for the set autosave path. The request body shape is unchanged (still `{ actualRpe, notes, set }`) — protecting RPE/notes from concurrent overwrites is out of scope for this iteration. `updateExerciseRPE` and `saveExerciseNote` are NOT touched.

- [ ] **Step 1: Add a failing test pinning keepalive on the set-autosave PATCH**

Append to `tests/unit/trainee-workout-focus.test.tsx`:

```ts
it('uses keepalive: true on the set-autosave PATCH', async () => {
    const user = userEvent.setup()
    await renderContent()

    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    await user.click(checkButtons[0])

    await waitFor(() => {
        const call = (global.fetch as any).mock.calls.find(
            ([url, init]: [string, RequestInit]) =>
                typeof url === 'string' &&
                url.endsWith('/api/trainee/workout-exercises/ex-1/feedback') &&
                init?.method === 'PATCH'
        )
        expect(call).toBeTruthy()
        expect(call![1].keepalive).toBe(true)
        // Body shape is unchanged — set autosave still ships rpe/notes today.
        const body = JSON.parse(call![1].body as string)
        expect(body).toHaveProperty('set')
    })
})
```

The test asserts `keepalive: true` explicitly and uses `expect(call).toBeTruthy()` so that a missing request fails the test loudly rather than passing vacuously.

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "keepalive: true on the set-autosave"`
Expected: FAIL (handler still uses bare `fetch`).

- [ ] **Step 3: Wire `keepaliveFetch` in `persistExerciseFeedback`**

At the top of `src/app/trainee/workouts/[id]/_content.tsx`, add the import alongside the existing ones:

```ts
import { keepaliveFetch } from '@/lib/keepalive-fetch'
```

Inside `persistExerciseFeedback` (currently at line 328) change the one `fetch(` call to `keepaliveFetch(`. Leave the rest of the handler — body, error rollback, toast, cascade handling — untouched.

- [ ] **Step 4: Run the test, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "keepalive: true on the set-autosave"`
Expected: PASS.

- [ ] **Step 5: Run the full file, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Expected: PASS (no other test depends on bare `fetch` here).

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "feat(trainee): use keepaliveFetch for the set-autosave PATCH"
```

---

## Task 3: Pad Missing Sets on Reload

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:191-210` (inside `fetchWorkout`)
- Test: `tests/unit/trainee-workout-focus.test.tsx`

When a feedback row exists but holds fewer `SetPerformed` than `we.sets` (because some earlier autosave never landed), the UI must still display all prescribed set rows with empty/incomplete defaults for the missing ones.

Today, the `if (we.feedback)` branch only maps existing `setsPerformed` rows and the `else` branch pads up to `we.sets`. The asymmetry produces the "row sparita" symptom from the bug report.

- [ ] **Step 1: Add failing test for pad behavior**

Append to `tests/unit/trainee-workout-focus.test.tsx`:

```ts
it('pads missing sets up to we.sets when feedback has fewer rows', async () => {
    const partialFixture = {
        ...fixtureWorkout,
        exercises: [
            {
                ...fixtureWorkout.exercises[0],
                feedback: {
                    id: 'feedback-1',
                    workoutExerciseId: 'ex-1',
                    traineeId: 'trainee-1',
                    date: '2026-05-11T00:00:00.000Z',
                    totalVolume: 0,
                    avgRPE: 8,
                    notes: null,
                    completed: false,
                    setsPerformed: [
                        { setNumber: 1, completed: true, reps: 8, weight: 80 },
                        { setNumber: 2, completed: true, reps: 8, weight: 80 },
                    ],
                },
            },
            fixtureWorkout.exercises[1],
        ],
    }

    ;(global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/api/trainee/workouts/')) {
            return { ok: true, json: async () => ({ data: { workout: partialFixture } }) } as Response
        }
        return { ok: true, json: async () => ({}) } as Response
    })

    await renderContent()

    // First exercise prescribes 4 sets — UI must show 4 set rows.
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    expect(checkButtons).toHaveLength(4)
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "pads missing sets"`
Expected: FAIL (only 2 rows rendered).

- [ ] **Step 3: Implement the pad**

Replace the `orderedExercises.forEach(...)` block (lines 191–210) with:

```ts
orderedExercises.forEach((we: WorkoutExerciseWithWeight) => {
    initialCompleted[we.id] = we.isCompleted

    if (we.feedback) {
        const bySetNumber = new Map(
            we.feedback.setsPerformed.map((sp) => [sp.setNumber, sp])
        )
        const maxSetNumber = Math.max(
            we.sets,
            ...we.feedback.setsPerformed.map((sp) => sp.setNumber)
        )
        const padded: SetPerformed[] = []
        for (let n = 1; n <= maxSetNumber; n++) {
            const existing = bySetNumber.get(n)
            padded.push(
                existing
                    ? {
                          setNumber: existing.setNumber,
                          weight: existing.weight,
                          reps: existing.reps,
                          completed: existing.completed ?? true,
                      }
                    : { setNumber: n, weight: we.effectiveWeight || 0, reps: 0, completed: false }
            )
        }
        initialFeedback[we.id] = padded
        initialRPE[we.id] = we.feedback.avgRPE
    } else {
        initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
            setNumber: i + 1,
            weight: we.effectiveWeight || 0,
            reps: 0,
            completed: false,
        }))
        initialRPE[we.id] = we.targetRpe
    }
})
```

`maxSetNumber` preserves any user-added sets beyond `we.sets` (the trainee can add ad-hoc sets) while still padding up to the prescribed count.

- [ ] **Step 4: Run the pad test, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "pads missing sets"`
Expected: PASS.

- [ ] **Step 5: Run the full file, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "fix(trainee): pad missing set rows when feedback has fewer rows than prescribed"
```

---

## Task 4: Server-First Mount; Preserve localStorage for `ProgramDetailContent`

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:235-298`
- Test: `tests/unit/trainee-workout-focus.test.tsx`

Today `fetchWorkout()` (async) and `loadLocalData()` (sync) are launched from the same effect. Whichever resolves last wins. If localStorage holds stale `feedbackData` (e.g. from before a partial-save), it can shadow server truth.

Fix: stop reading `feedbackData`/`exerciseRPE`/`exerciseNotes` from localStorage on mount. The server is the source of truth. Only `globalNotes` keeps being rehydrated since it has no autosave.

**Critical compatibility note:** `ProgramDetailContent.tsx:165` reads the localStorage key `workout_<workoutId>_feedback` and inspects `parsed.feedbackData` to render an "in-progress" badge on the program dashboard. The plan must keep **writing** the full snapshot to that key in the existing shape — only the **read** on mount is removed.

- [ ] **Step 1: Add failing tests for race + consumer-shape preservation**

Append to `tests/unit/trainee-workout-focus.test.tsx`:

```ts
it('prefers server data over stale localStorage feedback on mount', async () => {
    const STORAGE_KEY = 'workout_workout-1_feedback'
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            feedbackData: {
                'ex-1': [
                    { setNumber: 1, completed: true, reps: 99, weight: 999 },
                ],
            },
            exerciseRPE: { 'ex-1': 10 },
            exerciseNotes: { 'ex-1': 'stale note' },
            globalNotes: '',
            savedAt: new Date().toISOString(),
        })
    )

    await renderContent()

    // Server fixture has no feedback → set #1 reps must be empty, not 99.
    const repsInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    expect(repsInputs[0].value).toBe('')
})

it('writes feedbackData to localStorage in the legacy shape for ProgramDetailContent', async () => {
    const user = userEvent.setup()
    await renderContent()

    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    await user.click(checkButtons[0])

    await waitFor(() => {
        const raw = localStorage.getItem('workout_workout-1_feedback')
        expect(raw).toBeTruthy()
        const parsed = JSON.parse(raw!)
        // ProgramDetailContent reads parsed.feedbackData and inspects set.completed.
        expect(parsed.feedbackData).toBeTruthy()
        expect(parsed.feedbackData['ex-1']).toBeTruthy()
        expect(parsed.feedbackData['ex-1'][0].completed).toBe(true)
    })
})
```

- [ ] **Step 2: Run the new tests, expect FAIL on the race test**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "prefers server data|legacy shape"`
Expected: FAIL on `prefers server data` (localStorage wins today); the `legacy shape` test may pass already.

- [ ] **Step 3: Narrow `loadLocalData` and sequence the mount effect**

Replace `loadLocalData` (lines 235–260) with:

```ts
const loadLocalData = useCallback(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return
        const parsed = JSON.parse(saved)
        if (typeof parsed?.globalNotes === 'string') {
            setGlobalNotes(parsed.globalNotes)
        }
        // Intentionally do NOT restore feedbackData / exerciseRPE / exerciseNotes here.
        // The server is the source of truth for those. localStorage retains the snapshot
        // only as a read-only breadcrumb for ProgramDetailContent.tsx:165.
    } catch {
        // localStorage read failed; start with empty state
    }
}, [STORAGE_KEY])
```

Leave `saveLocalData` (lines 262–277) unchanged — `ProgramDetailContent.tsx:165` reads `parsed.feedbackData`, so the write must continue to include the full snapshot in the legacy shape.

Replace the mount effect (lines 289–292) with:

```ts
useEffect(() => {
    let cancelled = false
    void (async () => {
        await fetchWorkout()
        if (cancelled) return
        loadLocalData()
    })()
    return () => {
        cancelled = true
    }
}, [fetchWorkout, loadLocalData])
```

The persistence effect (lines 294–298) is unchanged.

- [ ] **Step 4: Run the new tests, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx -t "prefers server data|legacy shape"`
Expected: PASS.

- [ ] **Step 5: Run the full file, expect PASS**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "fix(trainee): sequence fetch before localStorage hydrate; stop rehydrating feedbackData"
```

---

## Task 5: Update CHANGELOG and CHECKLIST in the repo's house format

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`
- Modify: `implementation-docs/CHECKLIST.md`

CHANGELOG entries under `## [Unreleased]` follow the pattern at `CHANGELOG.md:14-19`:

`**[D Mese YYYY] Title** — Descrizione in italiano. **Files modificati:** path1, path2.`

A dated H3 sub-entry tied to a checklist task follows `CHANGELOG.md:21-31`:

```
### [D Mese YYYY] — Title

**Task checklist:** #N.NN
**File modificati:** path1, path2
**Note:** prosa in italiano.
```

CHECKLIST entries live under their Sprint heading as `- [x] **N.NN** Title  File: ... · Dettagli: ...` (see `CHECKLIST.md:20-32`).

- [ ] **Step 1: Pick a checklist number**

Open `implementation-docs/CHECKLIST.md`, locate the highest existing `**N.NN**` under the most recent Sprint heading, pick the next free integer. This plan assumes `**11.99**`.

- [ ] **Step 2: Append the CHECKLIST entry**

Under the chosen Sprint heading append:

```markdown
- [x] **11.99** Affidabilita autosave singola serie trainee — keepalive fetch, pad serie mancanti, mount server-first  
      File: `src/app/trainee/workouts/[id]/_content.tsx`, `src/lib/keepalive-fetch.ts` · Dettagli: vedi piano `docs/superpowers/plans/2026-05-11-trainee-set-feedback-reliability.md`
```

- [ ] **Step 3: Bump the CHECKLIST counter**

At `CHECKLIST.md:4` (`**Stato attuale:**`), increment the completed-task count by 1. Update the remaining-task count at line 5 accordingly. Recalculate the percentage if it shifts by a whole point.

- [ ] **Step 4: Append the CHANGELOG entry**

In `implementation-docs/CHANGELOG.md`, inside `## [Unreleased]` under `### Fixed`, append:

```markdown
- **[11 Maggio 2026] Affidabilita autosave singola serie trainee** — Nella schermata `/trainee/workouts/[id]`, spuntando una serie con app in background o tab chiusa il record poteva non essere persistito e la riga sparire al ricaricamento. Risolto solo sulla path della singola serie: (1) `persistExerciseFeedback` usa `fetch(..., { keepalive: true })` con `AbortSignal.timeout(10s)` di default, (2) `fetchWorkout` ora pad le `SetPerformed` fino a `we.sets` quando il feedback ha meno righe del prescritto, (3) il mount non rehydrata piu `feedbackData` da `localStorage` (server-first), eliminando la race con la fetch server. La chiave `workout_<id>_feedback` continua a essere scritta in shape legacy per `ProgramDetailContent`. RPE handler, note handler, submit endpoint e schemi non sono toccati in questa iterazione. **Files modificati:** `src/app/trainee/workouts/[id]/_content.tsx`. **Files creati:** `src/lib/keepalive-fetch.ts`, `tests/unit/keepalive-fetch.test.ts`.
```

After all existing dated H3 sub-entries inside `## [Unreleased]`, append:

```markdown
### [11 Maggio 2026] — Affidabilita autosave singola serie trainee

**Task checklist:** #11.99
**File modificati:** `src/app/trainee/workouts/[id]/_content.tsx`, `src/lib/keepalive-fetch.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`
**Note:** Mitigazione mirata del bug "serie spuntata non persistita con app-switch": `keepalive: true` sul fetch garantisce completion anche con tab in background; pad serie mancanti su reload evita righe fantasma; mount server-first previene che localStorage stale shadow-i la fetch. Scope volutamente ridotto al solo path della singola serie — RPE, note e submit invariati. Dettagli completi nel piano `docs/superpowers/plans/2026-05-11-trainee-set-feedback-reliability.md`.
```

- [ ] **Step 5: Commit**

```bash
git add implementation-docs/CHANGELOG.md implementation-docs/CHECKLIST.md
git commit -m "docs: changelog + checklist entry for single-set autosave reliability"
```

---

## Task 6: Full Regression

- [ ] **Step 1: Type check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Unit + integration tests**

Run: `npm run test:unit`
Expected: PASS. Note that `package.json:11` defines `"test:unit": "vitest"` — it does NOT enable coverage. To verify the coverage thresholds defined in `vitest.config.ts` (`coverage` section, `thresholds` block), run coverage explicitly:

Run: `npx vitest run --coverage`
Expected: PASS, every threshold listed in `vitest.config.ts` met for the files this plan touches.

- [ ] **Step 4: Manual smoke test (developer machine)**

1. `npm run dev` and log in as a trainee with at least one active workout.
2. Open DevTools → Network panel. Mark a set as completed. Inspect the PATCH request: it must show `keepalive: true` under Request initiator / properties (Chrome → click the request → `Headers` tab → bottom; or use `globalThis.performance.getEntries()` filter on `keepalive` if the panel hides it).
3. Tap a set, then **immediately** close the tab. Reopen the workout. Verify in DB via `npm run prisma:studio` that the corresponding `SetPerformed` row exists. Verify the UI shows it as completed.
4. On a real mobile device (or via Chrome DevTools' tab-discard), background the app right after a tap; reopen and confirm persistence.
5. Reload-after-partial-save case: in `prisma:studio`, manually delete one `SetPerformed` row for a workout you have in progress. Reload the workout page — the row count rendered must equal `we.sets`; the deleted row reappears as an empty/incomplete row, not as a missing slot.
6. Negative case: with DevTools Network throttling set to "Offline", tap a set → autosave fails → error toast appears and the UI rolls back (set returns to unchecked). This is the intentional behavior when keepalive cannot help (truly offline at tap time).

- [ ] **Step 5: Sentry instrumentation check**

Confirm that the `catch` block in `persistExerciseFeedback` already pipes failures to Sentry. If it only shows a toast today, add a `Sentry.captureException(err, { tags: { feature: 'trainee-set-autosave' } })` call inside the catch so post-deploy telemetry can show whether a retry queue is needed in a follow-up plan.
