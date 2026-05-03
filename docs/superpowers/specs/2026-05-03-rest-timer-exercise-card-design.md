# Rest Timer + Exercise Card UI Changes

**Date:** 2026-05-03  
**Scope:** `src/app/trainee/workouts/[id]/_content.tsx` + new hook + new component

---

## Overview

Four changes to the trainee workout screen (`/trainee/workouts/[id]`):

1. **Rest timer** — starts on any set check, countdown = exercise's `restTime`, expires with sound + notification
2. **4th target box** — RPE target alongside Sets / Reps / KG
3. **Remove RPE + type badges** — declutter badge row
4. **A/F prefix** — compact type indicator before exercise name

---

## 1. `useRestTimer` hook

**File:** `src/lib/useRestTimer.ts`

```ts
useRestTimer(options: {
  onExpire: () => void
}): {
  secondsLeft: number | null   // null = idle
  totalSeconds: number
  isRunning: boolean
  start: (restTimeSeconds: number) => void  // (re)starts from full duration
  stop: () => void                          // stops + resets to null
}
```

**RestTime → seconds mapping:**

| RestTime | Seconds |
|----------|---------|
| s30      | 30      |
| m1       | 60      |
| m1s30    | 90      |
| m2       | 120     |
| m3       | 180     |
| m5       | 300     |

**Behavior:**
- `start(seconds)` — clears any existing interval, sets `secondsLeft = seconds`, `totalSeconds = seconds`, ticks every 1s
- At 0 — clears interval, calls `onExpire()`, sets `secondsLeft = null`
- `stop()` — clears interval, sets `secondsLeft = null`
- Calling `start()` while running restarts from full duration (new set = new rest)
- Cleanup: clears interval on unmount

---

## 2. Sound + Notification

**Sound:** Web Audio API, no asset files.  
On expire: two-tone beep — 880Hz sine for 200ms, then 440Hz for 150ms.  
Runs regardless of notification permission.

**Notification logic (in `_content.tsx` `onExpire` callback):**

```
playSound()
if (document.hidden):
  new Notification(t('workouts.restDone'), { silent: true })
else:
  showToast(t('workouts.restDone'), 'success')
```

**Permission:** Request `Notification.requestPermission()` once on first set-check (tracked in `useRef`). If denied or `Notification` unsupported → fall back to toast-only silently.

**New i18n keys** (both `en` and `it`):
- `workouts.restDone` — "Rest over!" / "Recupero terminato!"

---

## 3. `FloatingRestTimer` component

**File:** `src/components/FloatingRestTimer.tsx`

**Props:**
```ts
{
  secondsLeft: number | null
  totalSeconds: number
  onStop: () => void
}
```

Renders nothing when `secondsLeft === null`.

**Layout:**
```
[ ⏱  1:23  ━━━━━━░░░░  ✕ ]
```

- Fixed position, `bottom-16` + `pb-[env(safe-area-inset-bottom)]`, horizontally centered
- Pill shape with white bg, shadow, border, backdrop-blur (matches floating dock style)
- Timer icon + `MM:SS` tabular-nums countdown
- Thin progress bar spanning full pill width (brand-primary, depletes left→right)
- `✕` dismiss button on right
- Color: normal → amber (`≤10s`) → red (`≤5s`) for border + text urgency
- At expire: brief "✓" flash for 500ms before disappearing

**z-index:** `z-40` (above bottom nav `z-30`)

---

## 4. Exercise card changes

**File:** `src/app/trainee/workouts/[id]/_content.tsx` — `ExerciseFocusCard` component

### 4a. A/F prefix before exercise name

```tsx
<h2 className="text-2xl font-bold text-gray-900 mb-1">
  <span className={`text-sm font-bold mr-1.5 ${
    we.exercise.type === 'fundamental' ? 'text-red-600' : 'text-blue-600'
  }`}>
    {we.exercise.type === 'fundamental' ? 'F' : 'A'}
  </span>
  {we.exercise.name}
</h2>
```

### 4b. Badge row — remove type + RPE badges

Keep: Rest time badge (amber).  
Remove: Fondamentale/Accessorio badge, targetRpe badge.

### 4c. 4th target box — RPE

Added after KG box with `flex-[0.75]` (narrower, RPE values are short):

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

---

## 5. Wiring in `_content.tsx`

```ts
const restToSeconds: Record<RestTime, number> = {
  s30: 30, m1: 60, m1s30: 90, m2: 120, m3: 180, m5: 300,
}

const timer = useRestTimer({
  onExpire: () => {
    playSound()
    if (document.hidden) {
      new Notification(t('workouts.restDone'), { silent: true })
    } else {
      showToast(t('workouts.restDone'), 'success')
    }
  },
})
```

**Trigger in `toggleSetCompleted`:** when `isCompleting === true`, call `timer.start(restToSeconds[we.restTime])`.

**Reset on exercise change:**
```ts
useEffect(() => { timer.stop() }, [currentStep])
```

**Render `FloatingRestTimer`** in the main JSX (inside the outer `div`, sibling to the scrollable body):
```tsx
<FloatingRestTimer
  secondsLeft={timer.secondsLeft}
  totalSeconds={timer.totalSeconds}
  onStop={timer.stop}
/>
```

**Notification permission request:** `useRef<boolean>(false)` tracks if permission was already requested. On first `isCompleting === true` set-check, call `Notification.requestPermission()` once.

**`playSound` helper:** inline function in `_content.tsx` — creates `AudioContext`, schedules two-tone beep (880Hz/200ms + 440Hz/150ms), no external file.

**Stability:** `timer.stop` must be wrapped in `useCallback` inside the hook so the `useEffect(() => { timer.stop() }, [currentStep])` dependency is stable and doesn't cause infinite re-renders.

---

## Files changed / created

| File | Action |
|------|--------|
| `src/lib/useRestTimer.ts` | Create |
| `src/components/FloatingRestTimer.tsx` | Create |
| `src/components/index.ts` | Export `FloatingRestTimer` |
| `src/app/trainee/workouts/[id]/_content.tsx` | Modify |
| `public/locales/en/trainee.json` | Add `workouts.restDone` |
| `public/locales/it/trainee.json` | Add `workouts.restDone` |

---

## Out of scope

- Server-side push notifications (VAPID)
- Timer persistence across page reloads
- Per-exercise timer customization in trainer UI
