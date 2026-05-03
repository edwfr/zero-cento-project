# Rest Timer + Exercise Card UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rest timer triggered by set completion, upgrade the exercise card with an RPE target box and a compact F/A type prefix, and clean up the badge row.

**Architecture:** New `useRestTimer` hook (`src/lib/`) owns countdown + expire logic; new `FloatingRestTimer` component (`src/components/`) owns the fixed-position pill UI; all wired in `_content.tsx` which already holds the workout state machine. Card UI changes are isolated to `ExerciseFocusCard` inside `_content.tsx`.

**Tech Stack:** React hooks (useState/useRef/useCallback/useEffect), Web Audio API, Browser Notifications API, Tailwind CSS, Lucide icons, Vitest + @testing-library/react.

---

## File Map

| File | Action |
|------|--------|
| `src/lib/useRestTimer.ts` | Create — countdown hook |
| `src/components/FloatingRestTimer.tsx` | Create — pill UI component |
| `src/components/index.ts` | Modify — export FloatingRestTimer |
| `src/app/trainee/workouts/[id]/_content.tsx` | Modify — card UI + wiring |
| `public/locales/en/trainee.json` | Modify — add `workouts.restDone` |
| `public/locales/it/trainee.json` | Modify — add `workouts.restDone` |
| `tests/unit/use-rest-timer.test.ts` | Create |
| `tests/unit/components/FloatingRestTimer.test.tsx` | Create |
| `tests/unit/trainee-workout-focus.test.tsx` | Modify — add card + timer tests |
| `vitest.config.ts` | Modify — add new files to coverage |

---

## Task 1: i18n keys

**Files:**
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

- [ ] **Step 1: Add key to English locale**

In `public/locales/en/trainee.json`, find `"rest": "Rest",` and add the new key directly after it:
```json
"rest": "Rest",
"restDone": "Rest over!",
```

- [ ] **Step 2: Add key to Italian locale**

In `public/locales/it/trainee.json`, find `"rest": "Rest",` and add directly after:
```json
"rest": "Rest",
"restDone": "Recupero terminato!",
```

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/trainee.json public/locales/it/trainee.json
git commit -m "feat: add restDone i18n key for rest timer expiry notification"
```

---

## Task 2: `useRestTimer` hook

**Files:**
- Create: `src/lib/useRestTimer.ts`
- Create: `tests/unit/use-rest-timer.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/use-rest-timer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRestTimer } from '@/lib/useRestTimer'

describe('useRestTimer', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('starts idle with secondsLeft null and isRunning false', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))
        expect(result.current.secondsLeft).toBeNull()
        expect(result.current.isRunning).toBe(false)
        expect(result.current.totalSeconds).toBe(0)
    })

    it('sets secondsLeft and totalSeconds immediately on start', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))
        act(() => { result.current.start(120) })
        expect(result.current.secondsLeft).toBe(120)
        expect(result.current.totalSeconds).toBe(120)
        expect(result.current.isRunning).toBe(true)
    })

    it('counts down one second per tick', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))
        act(() => { result.current.start(5) })
        act(() => { vi.advanceTimersByTime(1000) })
        expect(result.current.secondsLeft).toBe(4)
        act(() => { vi.advanceTimersByTime(2000) })
        expect(result.current.secondsLeft).toBe(2)
    })

    it('calls onExpire exactly once when countdown finishes', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))
        act(() => { result.current.start(3) })
        act(() => { vi.advanceTimersByTime(3000) })
        expect(onExpire).toHaveBeenCalledTimes(1)
    })

    it('sets secondsLeft to 0 briefly after expire, then null after 500ms', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))
        act(() => { result.current.start(1) })
        act(() => { vi.advanceTimersByTime(1000) })
        expect(result.current.secondsLeft).toBe(0)
        expect(result.current.isRunning).toBe(false)
        act(() => { vi.advanceTimersByTime(500) })
        expect(result.current.secondsLeft).toBeNull()
    })

    it('stop() sets secondsLeft to null and prevents onExpire from firing', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))
        act(() => { result.current.start(10) })
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { result.current.stop() })
        expect(result.current.secondsLeft).toBeNull()
        expect(result.current.isRunning).toBe(false)
        act(() => { vi.advanceTimersByTime(10000) })
        expect(onExpire).not.toHaveBeenCalled()
    })

    it('start() while running restarts from the new duration', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))
        act(() => { result.current.start(10) })
        act(() => { vi.advanceTimersByTime(5000) })
        act(() => { result.current.start(8) })
        expect(result.current.secondsLeft).toBe(8)
        expect(result.current.totalSeconds).toBe(8)
        act(() => { vi.advanceTimersByTime(8000) })
        expect(onExpire).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/use-rest-timer.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/useRestTimer'"

- [ ] **Step 3: Implement the hook**

Create `src/lib/useRestTimer.ts`:

```ts
import { useState, useRef, useCallback, useEffect } from 'react'

interface UseRestTimerOptions {
    onExpire: () => void
}

export interface UseRestTimerReturn {
    secondsLeft: number | null
    totalSeconds: number
    isRunning: boolean
    start: (restTimeSeconds: number) => void
    stop: () => void
}

export function useRestTimer({ onExpire }: UseRestTimerOptions): UseRestTimerReturn {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const [totalSeconds, setTotalSeconds] = useState<number>(0)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const onExpireRef = useRef(onExpire)
    onExpireRef.current = onExpire

    const stop = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        setSecondsLeft(null)
    }, [])

    const start = useCallback((restTimeSeconds: number) => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        setTotalSeconds(restTimeSeconds)
        setSecondsLeft(restTimeSeconds)
        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(intervalRef.current!)
                    intervalRef.current = null
                    onExpireRef.current()
                    setTimeout(() => setSecondsLeft(null), 500)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    useEffect(() => {
        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current)
            }
        }
    }, [])

    return {
        secondsLeft,
        totalSeconds,
        isRunning: secondsLeft !== null && secondsLeft > 0,
        start,
        stop,
    }
}
```

- [ ] **Step 4: Add to vitest coverage**

In `vitest.config.ts`, inside the `include` array under `coverage`, add:
```ts
'src/lib/useRestTimer.ts',
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run tests/unit/use-rest-timer.test.ts
```
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/useRestTimer.ts tests/unit/use-rest-timer.test.ts vitest.config.ts
git commit -m "feat: add useRestTimer hook with countdown, expire callback, and brief done state"
```

---

## Task 3: `FloatingRestTimer` component

**Files:**
- Create: `src/components/FloatingRestTimer.tsx`
- Modify: `src/components/index.ts`
- Create: `tests/unit/components/FloatingRestTimer.test.tsx`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/components/FloatingRestTimer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingRestTimer from '@/components/FloatingRestTimer'

describe('FloatingRestTimer', () => {
    it('renders nothing when secondsLeft is null', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={null} totalSeconds={120} onStop={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders when secondsLeft is a positive number', () => {
        render(<FloatingRestTimer secondsLeft={75} totalSeconds={120} onStop={vi.fn()} />)
        expect(screen.getByText('1:15')).toBeInTheDocument()
    })

    it('formats single-digit seconds with a leading zero', () => {
        render(<FloatingRestTimer secondsLeft={65} totalSeconds={120} onStop={vi.fn()} />)
        expect(screen.getByText('1:05')).toBeInTheDocument()
    })

    it('formats sub-minute countdown', () => {
        render(<FloatingRestTimer secondsLeft={30} totalSeconds={60} onStop={vi.fn()} />)
        expect(screen.getByText('0:30')).toBeInTheDocument()
    })

    it('calls onStop when dismiss button is clicked', async () => {
        const user = userEvent.setup()
        const onStop = vi.fn()
        render(<FloatingRestTimer secondsLeft={60} totalSeconds={120} onStop={onStop} />)
        await user.click(screen.getByRole('button', { name: /stop timer/i }))
        expect(onStop).toHaveBeenCalledTimes(1)
    })

    it('renders done state (no dismiss button) when secondsLeft is 0', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={0} totalSeconds={120} onStop={vi.fn()} />
        )
        expect(container.firstChild).not.toBeNull()
        expect(screen.queryByRole('button', { name: /stop timer/i })).not.toBeInTheDocument()
    })

    it('applies urgent red border when 5 or fewer seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={5} totalSeconds={120} onStop={vi.fn()} />
        )
        expect(container.querySelector('.border-red-300')).toBeInTheDocument()
    })

    it('applies warning amber border when 6–10 seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={8} totalSeconds={120} onStop={vi.fn()} />
        )
        expect(container.querySelector('.border-amber-300')).toBeInTheDocument()
    })

    it('applies default gray border when more than 10 seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={60} totalSeconds={120} onStop={vi.fn()} />
        )
        expect(container.querySelector('.border-gray-200')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/components/FloatingRestTimer.test.tsx
```
Expected: FAIL — "Cannot find module '@/components/FloatingRestTimer'"

- [ ] **Step 3: Implement the component**

Create `src/components/FloatingRestTimer.tsx`:

```tsx
'use client'

import { Check, Timer, X } from 'lucide-react'

interface FloatingRestTimerProps {
    secondsLeft: number | null
    totalSeconds: number
    onStop: () => void
}

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function FloatingRestTimer({ secondsLeft, totalSeconds, onStop }: FloatingRestTimerProps) {
    if (secondsLeft === null) return null

    const isDone = secondsLeft === 0
    const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
    const isUrgent = !isDone && secondsLeft <= 5
    const isWarning = !isDone && secondsLeft <= 10 && !isUrgent

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]">
            <div
                className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 rounded-full border bg-white/95 px-4 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90 ${
                    isDone
                        ? 'border-green-300 text-green-600'
                        : isUrgent
                        ? 'border-red-300 text-red-600'
                        : isWarning
                        ? 'border-amber-300 text-amber-600'
                        : 'border-gray-200 text-gray-700'
                }`}
            >
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-100">
                    <div
                        className={`h-full transition-all duration-1000 ${
                            isDone
                                ? 'bg-green-500'
                                : isUrgent
                                ? 'bg-red-500'
                                : isWarning
                                ? 'bg-amber-500'
                                : 'bg-brand-primary'
                        }`}
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                {isDone ? (
                    <Check className="h-4 w-4 text-green-600" />
                ) : (
                    <>
                        <Timer className="h-4 w-4 flex-shrink-0" />
                        <span className="tabular-nums text-sm font-bold min-w-[2.5rem] text-center">
                            {formatCountdown(secondsLeft)}
                        </span>
                        <button
                            type="button"
                            onClick={onStop}
                            aria-label="Stop timer"
                            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-gray-100"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Export from `src/components/index.ts`**

Add at the end of `src/components/index.ts`:
```ts
export { default as FloatingRestTimer } from './FloatingRestTimer'
```

- [ ] **Step 5: Add to vitest coverage**

In `vitest.config.ts`, inside the `include` array under `coverage`, add:
```ts
'src/components/FloatingRestTimer.tsx',
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npx vitest run tests/unit/components/FloatingRestTimer.test.tsx
```
Expected: All 9 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/FloatingRestTimer.tsx src/components/index.ts tests/unit/components/FloatingRestTimer.test.tsx vitest.config.ts
git commit -m "feat: add FloatingRestTimer component with countdown display and urgency states"
```

---

## Task 4: Exercise card UI changes

Changes are inside `ExerciseFocusCard` only (no changes to `WorkoutDetailContent` in this task).

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Add failing tests**

In `tests/unit/trainee-workout-focus.test.tsx`, add these inside `describe('Trainee workout focus mode', () => {`:

```ts
it('shows F prefix before a fundamental exercise name', async () => {
    await renderContent()
    const heading = screen.getByRole('heading', { level: 2 })
    // fixture ex-1 is 'fundamental', name is 'Bench Press'
    expect(heading.textContent).toMatch(/^F\s*Bench Press/)
})

it('shows A prefix before an accessory exercise name', async () => {
    const user = userEvent.setup()
    await renderContent()
    await user.click(screen.getByRole('button', { name: /next|avanti/i }))
    const heading = screen.getByRole('heading', { level: 2 })
    // fixture ex-2 is 'accessory', name is 'Tricep Extension'
    expect(heading.textContent).toMatch(/^A\s*Tricep Extension/)
})

it('shows RPE target value in the targets row box', async () => {
    await renderContent()
    // targetRpe for ex-1 is 8 (from fixture)
    const rpeLabel = screen.getByText('RPE')
    const rpeBox = rpeLabel.closest('div[class*="rounded-xl"]')
    expect(rpeBox?.textContent).toContain('8')
})

it('does not render the fundamental/accessory type badge', async () => {
    await renderContent()
    // t() returns the key — badges used 'workouts.tagFundamental' / 'workouts.tagAccessory'
    expect(screen.queryByText('workouts.tagFundamental')).not.toBeInTheDocument()
    expect(screen.queryByText('workouts.tagAccessory')).not.toBeInTheDocument()
})

it('does not render the RPE target badge (violet badge row)', async () => {
    await renderContent()
    // The old badge rendered: <span>RPE</span>{targetRpe} with violet styling
    // After change: only one element with text 'RPE' exists — the box label
    const rpeElements = screen.getAllByText('RPE')
    expect(rpeElements).toHaveLength(1)
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: 5 new tests FAIL, all prior tests PASS

- [ ] **Step 3: Add A/F prefix to exercise name heading**

In `src/app/trainee/workouts/[id]/_content.tsx`, inside `ExerciseFocusCard`, find:
```tsx
<h2 className="text-2xl font-bold text-gray-900 mb-1">{we.exercise.name}</h2>
```
Replace with:
```tsx
<h2 className="text-2xl font-bold text-gray-900 mb-1">
    <span
        className={`text-sm font-bold mr-1.5 align-middle ${
            we.exercise.type === 'fundamental' ? 'text-red-600' : 'text-blue-600'
        }`}
    >
        {we.exercise.type === 'fundamental' ? 'F' : 'A'}
    </span>
    {we.exercise.name}
</h2>
```

- [ ] **Step 4: Remove type badge and RPE badge from badge row**

Find the `<div className="flex flex-wrap gap-1.5">` block. It contains three `<span>` elements. Remove:
1. The type badge `<span className={...we.exercise.type === 'fundamental'...}>...</span>`
2. The RPE badge `{we.targetRpe !== null && (<span className="...violet...">...</span>)}`

Keep only the rest time badge. The result should be:
```tsx
<div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="w-3 h-3" />
        <span className="font-semibold">{t('workouts.rest')}:</span>
        {formatRestTime(we.restTime)}
    </span>
</div>
```

Also remove the `Gauge` import from the lucide-react import line if it's no longer used after this removal. Check if `Gauge` is used anywhere else in the file before removing.

- [ ] **Step 5: Add 4th RPE target box**

Find `<div className="flex gap-2 mb-4">` (the targets row). It contains 3 boxes for Sets, Reps, KG. After the last KG box `<div className="flex-1 rounded-xl...">, add:

```tsx
<div className="flex-[0.75] rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-3 text-center">
    <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary">
        RPE
    </span>
    <span className="block text-2xl font-black text-gray-900 mt-1">
        {we.targetRpe ?? '—'}
    </span>
</div>
```

- [ ] **Step 6: Run all workout focus tests — verify they all pass**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: All tests PASS (prior + 5 new)

- [ ] **Step 7: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "feat: add F/A prefix, RPE target box, remove type and RPE badges from exercise card"
```

---

## Task 5: Wire timer into `_content.tsx`

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Add Notification mock and timer wiring tests**

In `tests/unit/trainee-workout-focus.test.tsx`, add a `Notification` mock to the existing top-level `beforeEach` block (the one that already mocks `global.fetch`). Add at the start of that block:

```ts
global.Notification = Object.assign(vi.fn(), {
    permission: 'default' as NotificationPermission,
    requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
}) as unknown as typeof Notification
```

Then add these tests inside `describe('Trainee workout focus mode', () => {`:

```ts
it('shows rest timer pill immediately after checking a set', async () => {
    const user = userEvent.setup()
    await renderContent()
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    await user.click(checkButtons[0])
    // ex-1 has restTime 'm2' → 120 seconds → formats as '2:00'
    expect(screen.getByText('2:00')).toBeInTheDocument()
})

it('resets timer to full duration when another set is checked while timer running', async () => {
    const user = userEvent.setup()
    await renderContent()
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    await user.click(checkButtons[0])
    expect(screen.getByText('2:00')).toBeInTheDocument()
    await user.click(checkButtons[1])
    expect(screen.getByText('2:00')).toBeInTheDocument()
})

it('stop button dismisses the timer', async () => {
    const user = userEvent.setup()
    await renderContent()
    const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
    await user.click(checkButtons[0])
    expect(screen.getByText('2:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /stop timer/i }))
    expect(screen.queryByText('2:00')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: 3 new timer tests FAIL, all prior tests PASS

- [ ] **Step 3: Add `playSound` and `REST_TO_SECONDS` to `_content.tsx`**

In `src/app/trainee/workouts/[id]/_content.tsx`, after the existing `const DOCK_VIEWPORT_MARGIN = 8` line, add:

```ts
const REST_TO_SECONDS: Record<RestTime, number> = {
    s30: 30,
    m1: 60,
    m1s30: 90,
    m2: 120,
    m3: 180,
    m5: 300,
}

function playSound(): void {
    try {
        const ctx = new AudioContext()
        const now = ctx.currentTime
        const schedule = (freq: number, start: number, duration: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = freq
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.3, now + start)
            gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
            osc.start(now + start)
            osc.stop(now + start + duration)
        }
        schedule(880, 0, 0.2)
        schedule(440, 0.25, 0.15)
        setTimeout(() => void ctx.close(), 600)
    } catch {
        // AudioContext unavailable — silent fail
    }
}
```

- [ ] **Step 4: Add imports**

In `src/app/trainee/workouts/[id]/_content.tsx`, add these two lines after the `import PrevWeekPanel` line:

```ts
import { useRestTimer } from '@/lib/useRestTimer'
import FloatingRestTimer from '@/components/FloatingRestTimer'
```

- [ ] **Step 5: Add timer state and callbacks inside `WorkoutDetailContent`**

In `WorkoutDetailContent`, after `const { showToast } = useToast()`, add:

```ts
const notificationPermissionRequested = useRef(false)

const requestNotificationPermission = useCallback(() => {
    if (notificationPermissionRequested.current) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        notificationPermissionRequested.current = true
        void Notification.requestPermission()
    }
}, [])

const onTimerExpire = useCallback(() => {
    playSound()
    if (typeof document !== 'undefined' && document.hidden) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(t('workouts.restDone'), { silent: true })
        }
    } else {
        showToast(t('workouts.restDone'), 'success')
    }
}, [showToast, t])

const timer = useRestTimer({ onExpire: onTimerExpire })
```

- [ ] **Step 6: Trigger timer in `toggleSetCompleted`**

In `toggleSetCompleted`, find `const isCompleting = !currentSet.completed` and add directly after it:

```ts
if (isCompleting) {
    requestNotificationPermission()
    timer.start(REST_TO_SECONDS[we.restTime])
}
```

- [ ] **Step 7: Reset timer when exercise step changes**

After all existing `useEffect` blocks in `WorkoutDetailContent`, add:

```ts
useEffect(() => {
    timer.stop()
}, [currentStep, timer.stop])
```

- [ ] **Step 8: Render `FloatingRestTimer` in JSX**

In the `return (...)` of `WorkoutDetailContent`, just before the closing `</div>` of the outermost wrapper (after `<PrevWeekPanel ... />`), add:

```tsx
<FloatingRestTimer
    secondsLeft={timer.secondsLeft}
    totalSeconds={timer.totalSeconds}
    onStop={timer.stop}
/>
```

- [ ] **Step 9: Run all workout focus tests**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```
Expected: All tests PASS

- [ ] **Step 10: Run full test suite**

```bash
npm run test:unit
```
Expected: All tests PASS, no coverage regressions

- [ ] **Step 11: Run type-check**

```bash
npm run type-check
```
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "feat: wire rest timer into workout screen with Web Audio sound and browser notification support"
```
