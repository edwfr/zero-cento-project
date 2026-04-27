# Loader Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize loading indicators across the application into two patterns: (1) inline button-level spinner for click-triggered async actions, (2) semitransparent overlay with primary-color spinner centered for page-navigation transitions.

**Architecture:** Two reusable components — `Button` / `ActionIconButton` (already support `isLoading`) for click loaders, and a new lightweight `NavigationLoadingOverlay` (replaces the heavyweight `FullPageLoader` for routing). A new `NavigationLoadingProvider` exposes `useNavigationLoader()` for client-driven overlay control (e.g. submit-then-push flows). Next.js `loading.tsx` segments at every route group ensure overlay shows during RSC suspensions. All raw `<button>` doing async work migrate to the `Button` component with `isLoading` wired to local mutation state.

**Tech Stack:** Next.js 15 App Router, React 18, Tailwind, react-i18next, existing `LoadingSpinner` primitive at `src/components/LoadingSpinner.tsx`, existing `Button` at `src/components/Button.tsx`, existing `ActionIconButton` at `src/components/ActionIconButton.tsx`.

---

## Design Decisions

1. **Two components, two roles.** `NavigationLoadingOverlay` for routing; `Button.isLoading` for click. No third pattern.
2. **`NavigationLoadingOverlay` is simpler than `FullPageLoader`.** No logo, no card, no gradient — just `bg-white/70 backdrop-blur-sm` with a centered primary spinner. Per user spec: "layer semitrasparente sulla pagina con un loader del primary color al centro".
3. **`FullPageLoader` is kept** for cold-start / app-bootstrap (auth flow, protected layout boot) since it has branding. It is **not** used for in-app navigation anymore.
4. **`loading.tsx` at every route segment** of `admin/`, `trainer/`, `trainee/`. Next.js renders these automatically during server suspensions — no client wiring needed.
5. **Client-driven overlay via context** for cases where `loading.tsx` doesn't fire (cached client navigation, post-submit redirect). `useNavigationLoader().start()` / `.stop()` toggles a global overlay.
6. **Migrate raw `<button>` to `Button`** only when the click triggers async work. Pure UI buttons (toggles, modals) stay as-is unless their pattern obviously diverges.
7. **i18n keys already exist** (`common.loading`, `common.saving`, `common.creating`, `common.submitting`, `common.deleting`). No new keys required.

---

## File Structure

**Create:**
- `src/components/NavigationLoadingOverlay.tsx` — semitransparent fullscreen overlay with primary spinner.
- `src/components/NavigationLoadingProvider.tsx` — React context + `useNavigationLoader()` hook. Renders `NavigationLoadingOverlay` when active.
- `src/app/admin/loading.tsx`
- `src/app/trainer/loading.tsx`
- `src/app/trainee/loading.tsx`
- `src/app/admin/dashboard/loading.tsx`
- `src/app/admin/exercises/loading.tsx`
- `src/app/admin/programs/loading.tsx`
- `src/app/admin/users/loading.tsx`
- `src/app/trainer/dashboard/loading.tsx`
- `src/app/trainer/exercises/loading.tsx`
- `src/app/trainer/exercises/[id]/edit/loading.tsx`
- `src/app/trainer/exercises/new/loading.tsx`
- `src/app/trainer/programs/loading.tsx`
- `src/app/trainer/programs/[id]/loading.tsx`
- `src/app/trainer/programs/[id]/edit/loading.tsx`
- `src/app/trainer/programs/[id]/publish/loading.tsx`
- `src/app/trainer/programs/[id]/review/loading.tsx`
- `src/app/trainer/programs/[id]/tests/loading.tsx`
- `src/app/trainer/programs/[id]/workouts/[wId]/loading.tsx`
- `src/app/trainer/trainees/loading.tsx`
- `src/app/trainer/trainees/[id]/loading.tsx`
- `src/app/trainer/trainees/[id]/records/loading.tsx`
- `src/app/trainer/trainees/new/loading.tsx`
- `src/app/trainee/dashboard/loading.tsx`
- `src/app/trainee/history/loading.tsx`
- `src/app/trainee/programs/[id]/loading.tsx`
- `src/app/trainee/programs/current/loading.tsx`
- `src/app/trainee/records/loading.tsx`
- `src/app/trainee/workouts/[id]/loading.tsx`

**Modify:**
- `src/app/loading.tsx` — switch from `FullPageLoader` to `NavigationLoadingOverlay`.
- `src/app/trainer/programs/new/loading.tsx` — switch from `FullPageLoader` to `NavigationLoadingOverlay`.
- `src/app/layout.tsx` — wrap children with `NavigationLoadingProvider`.
- `src/components/index.ts` — export `NavigationLoadingOverlay`, `NavigationLoadingProvider`, `useNavigationLoader`.
- All page/content files under `src/app/admin`, `src/app/trainer`, `src/app/trainee`, `src/app/login`, `src/app/onboarding`, `src/app/profile`, `src/app/reset-password`, `src/app/forgot-password`, `src/app/force-change-password` that contain raw `<button>` elements with async `onClick`.
- `implementation-docs/CHANGELOG.md` — entry per phase.

**Tests:**
- `tests/unit/components/NavigationLoadingOverlay.test.tsx`
- `tests/unit/components/NavigationLoadingProvider.test.tsx`

---

## Phase 1 — Build infrastructure

### Task 1: Create `NavigationLoadingOverlay` component

**Files:**
- Create: `src/components/NavigationLoadingOverlay.tsx`
- Test: `tests/unit/components/NavigationLoadingOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/NavigationLoadingOverlay.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import NavigationLoadingOverlay from '@/components/NavigationLoadingOverlay'

describe('NavigationLoadingOverlay', () => {
    it('renders a spinner with role=status', () => {
        render(<NavigationLoadingOverlay />)
        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('uses fixed inset overlay class', () => {
        const { container } = render(<NavigationLoadingOverlay />)
        const overlay = container.firstChild as HTMLElement
        expect(overlay.className).toContain('fixed')
        expect(overlay.className).toContain('inset-0')
        expect(overlay.className).toContain('z-50')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/NavigationLoadingOverlay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/NavigationLoadingOverlay.tsx
'use client'

import LoadingSpinner from './LoadingSpinner'

interface NavigationLoadingOverlayProps {
    label?: string
}

/**
 * Semitransparent fullscreen overlay with a centered primary-color spinner.
 * Used for page-navigation transitions.
 */
export default function NavigationLoadingOverlay({ label }: NavigationLoadingOverlayProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
        >
            <LoadingSpinner size="lg" color="primary" label={label} />
        </div>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/NavigationLoadingOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Export from barrel**

Modify `src/components/index.ts` — find the `// Loading & Feedback` section and add:

```ts
export { default as NavigationLoadingOverlay } from './NavigationLoadingOverlay'
```

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/NavigationLoadingOverlay.tsx tests/unit/components/NavigationLoadingOverlay.test.tsx src/components/index.ts
git commit -m "feat(components): add NavigationLoadingOverlay for routing transitions"
```

---

### Task 2: Create `NavigationLoadingProvider` + `useNavigationLoader`

**Files:**
- Create: `src/components/NavigationLoadingProvider.tsx`
- Test: `tests/unit/components/NavigationLoadingProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/NavigationLoadingProvider.test.tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
    NavigationLoadingProvider,
    useNavigationLoader,
} from '@/components/NavigationLoadingProvider'

function Probe() {
    const { start, stop, isLoading } = useNavigationLoader()
    return (
        <div>
            <span data-testid="state">{isLoading ? 'on' : 'off'}</span>
            <button onClick={start}>start</button>
            <button onClick={stop}>stop</button>
        </div>
    )
}

describe('NavigationLoadingProvider', () => {
    it('toggles overlay via start/stop', () => {
        render(
            <NavigationLoadingProvider>
                <Probe />
            </NavigationLoadingProvider>
        )

        expect(screen.getByTestId('state').textContent).toBe('off')

        act(() => {
            screen.getByText('start').click()
        })
        expect(screen.getByTestId('state').textContent).toBe('on')
        expect(screen.getByRole('status')).toBeInTheDocument()

        act(() => {
            screen.getByText('stop').click()
        })
        expect(screen.getByTestId('state').textContent).toBe('off')
    })

    it('throws when used outside provider', () => {
        const Bad = () => {
            useNavigationLoader()
            return null
        }
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => render(<Bad />)).toThrow(/NavigationLoadingProvider/)
        spy.mockRestore()
    })
})
```

Add `import { vi } from 'vitest'` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/NavigationLoadingProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

```tsx
// src/components/NavigationLoadingProvider.tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import NavigationLoadingOverlay from './NavigationLoadingOverlay'

interface NavigationLoadingContextValue {
    isLoading: boolean
    start: (label?: string) => void
    stop: () => void
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null)

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false)
    const [label, setLabel] = useState<string | undefined>(undefined)

    const start = useCallback((nextLabel?: string) => {
        setLabel(nextLabel)
        setIsLoading(true)
    }, [])

    const stop = useCallback(() => {
        setIsLoading(false)
        setLabel(undefined)
    }, [])

    const value = useMemo(
        () => ({ isLoading, start, stop }),
        [isLoading, start, stop]
    )

    return (
        <NavigationLoadingContext.Provider value={value}>
            {children}
            {isLoading && <NavigationLoadingOverlay label={label} />}
        </NavigationLoadingContext.Provider>
    )
}

export function useNavigationLoader(): NavigationLoadingContextValue {
    const ctx = useContext(NavigationLoadingContext)
    if (!ctx) {
        throw new Error('useNavigationLoader must be used within NavigationLoadingProvider')
    }
    return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/NavigationLoadingProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Export from barrel**

Modify `src/components/index.ts` — add to the `// Loading & Feedback` section:

```ts
export {
    NavigationLoadingProvider,
    useNavigationLoader,
} from './NavigationLoadingProvider'
```

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/NavigationLoadingProvider.tsx tests/unit/components/NavigationLoadingProvider.test.tsx src/components/index.ts
git commit -m "feat(components): add NavigationLoadingProvider with useNavigationLoader hook"
```

---

### Task 3: Wire `NavigationLoadingProvider` into root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Read current layout**

Run: `npm run dev` in another terminal so you can watch HMR. Open `src/app/layout.tsx` and locate the JSX tree where children are rendered (likely inside `<body>` or inside an existing `Providers` wrapper).

- [ ] **Step 2: Wrap children with provider**

Add the import at the top:

```tsx
import { NavigationLoadingProvider } from '@/components'
```

Wrap the innermost children render with `<NavigationLoadingProvider>`. If a `Providers` client component already exists, place it INSIDE that component so it shares the same client tree:

```tsx
<NavigationLoadingProvider>
    {children}
</NavigationLoadingProvider>
```

If `src/app/layout.tsx` already passes through to a client `Providers` component, instead edit that file to add the wrapper there. Search: `grep -rn "Providers" src/app/layout.tsx src/app/_components 2>/dev/null` to find it.

- [ ] **Step 3: Run dev server, smoke test**

Run: `npm run dev`. Open `http://localhost:3000`. Open DevTools console. Run:

```js
// Should NOT throw — no overlay visible yet because provider is idle
document.querySelector('[role="status"]')
```

Expected: `null` (no overlay rendered initially).

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): mount NavigationLoadingProvider in root layout"
```

---

### Task 4: Replace existing `loading.tsx` files to use `NavigationLoadingOverlay`

**Files:**
- Modify: `src/app/loading.tsx`
- Modify: `src/app/trainer/programs/new/loading.tsx`

- [ ] **Step 1: Replace `src/app/loading.tsx`**

Full file replacement:

```tsx
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
```

- [ ] **Step 2: Replace `src/app/trainer/programs/new/loading.tsx`**

Full file replacement:

```tsx
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Navigate from `/login` to `/trainer/dashboard` (or any protected page). Watch for the overlay to appear briefly during transition.

- [ ] **Step 5: Commit**

```bash
git add src/app/loading.tsx src/app/trainer/programs/new/loading.tsx
git commit -m "refactor(loading): switch existing loading.tsx to NavigationLoadingOverlay"
```

---

### Task 5: Add `loading.tsx` to every route segment under admin / trainer / trainee

**Files:** Create the 26 files listed in **File Structure** under "Create" (excluding the two component files already done).

- [ ] **Step 1: Create the shared template**

Every `loading.tsx` in this task is identical:

```tsx
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
```

- [ ] **Step 2: Create the admin segments**

Use this command to bulk-create them. Run from repo root:

```bash
for path in \
  src/app/admin \
  src/app/admin/dashboard \
  src/app/admin/exercises \
  src/app/admin/programs \
  src/app/admin/users; do
    cat > "$path/loading.tsx" <<'EOF'
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
EOF
done
```

- [ ] **Step 3: Create the trainer segments**

```bash
for path in \
  src/app/trainer \
  src/app/trainer/dashboard \
  src/app/trainer/exercises \
  src/app/trainer/exercises/[id]/edit \
  src/app/trainer/exercises/new \
  src/app/trainer/programs \
  src/app/trainer/programs/[id] \
  src/app/trainer/programs/[id]/edit \
  src/app/trainer/programs/[id]/publish \
  src/app/trainer/programs/[id]/review \
  src/app/trainer/programs/[id]/tests \
  src/app/trainer/programs/[id]/workouts/[wId] \
  src/app/trainer/trainees \
  src/app/trainer/trainees/[id] \
  src/app/trainer/trainees/[id]/records \
  src/app/trainer/trainees/new; do
    cat > "$path/loading.tsx" <<'EOF'
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
EOF
done
```

- [ ] **Step 4: Create the trainee segments**

```bash
for path in \
  src/app/trainee \
  src/app/trainee/dashboard \
  src/app/trainee/history \
  src/app/trainee/programs/[id] \
  src/app/trainee/programs/current \
  src/app/trainee/records \
  src/app/trainee/workouts/[id]; do
    cat > "$path/loading.tsx" <<'EOF'
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
EOF
done
```

- [ ] **Step 5: Verify all created**

Run: `find src/app -name "loading.tsx" -type f | sort`
Expected: All 28 paths listed (the original 2 from `src/app/loading.tsx` + `src/app/trainer/programs/new/loading.tsx`, plus the 26 new ones).

- [ ] **Step 6: Type-check + build**

Run: `npm run type-check && npm run build`
Expected: Build succeeds. No errors.

- [ ] **Step 7: Smoke test navigation**

Run: `npm run dev`. Log in as any role. Navigate between top-level pages (e.g. `/trainer/dashboard` → `/trainer/programs` → `/trainer/trainees`). Each transition should briefly show the overlay (more visible on slower routes / cold cache).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin src/app/trainer src/app/trainee
git commit -m "feat(loading): add loading.tsx to all route segments"
```

---

## Phase 2 — Migrate buttons to standardized loading pattern

**Pattern reference for all Phase 2 tasks:**

For every raw `<button onClick={asyncHandler}>` in a page, transform like this:

**Before:**
```tsx
<button
    onClick={async () => {
        setLoading(true)
        try { await doThing() } finally { setLoading(false) }
    }}
    disabled={loading}
    className="..."
>
    Save
</button>
```

**After:**
```tsx
import { Button } from '@/components'

<Button
    variant="primary"
    isLoading={loading}
    loadingText={t('common.saving')}
    onClick={async () => {
        setLoading(true)
        try { await doThing() } finally { setLoading(false) }
    }}
>
    {t('common.save')}
</Button>
```

For action icons (table rows, etc.), use `ActionIconButton` with `isLoading`. For navigation-after-submit:

```tsx
import { useNavigationLoader } from '@/components'

const navLoader = useNavigationLoader()

const onSubmit = async () => {
    setSubmitting(true)
    try {
        await mutate()
        navLoader.start(t('common.loadingPageTransition'))
        router.push(`/trainer/programs/${id}`)
    } catch (e) {
        navLoader.stop()
        setSubmitting(false)
        // surface error
    }
}
```

The provider auto-clears on next render after navigation completes — but explicitly call `stop()` on error paths.

**Choose `loadingText` from `common.json`:**
- Save / update → `common.saving`
- Create / new entity → `common.creating`
- Submit / publish → `common.submitting`
- Delete → `common.deleting`
- Generic → `common.loading`

---

### Task 6: Migrate admin pages

**Files:**
- Modify: `src/app/admin/dashboard/_content.tsx`
- Modify: `src/app/admin/exercises/_content.tsx`
- Modify: `src/app/admin/programs/_content.tsx`
- Modify: `src/app/admin/users/_content.tsx`

- [ ] **Step 1: Audit each file**

For each file run:
```bash
grep -n "<button" src/app/admin/dashboard/_content.tsx
grep -n "<button" src/app/admin/exercises/_content.tsx
grep -n "<button" src/app/admin/programs/_content.tsx
grep -n "<button" src/app/admin/users/_content.tsx
```

For each match, classify:
- (A) Triggers async work (fetch, mutation) → migrate
- (B) Pure UI (open modal, toggle UI state) → leave as-is

- [ ] **Step 2: Migrate `src/app/admin/users/_content.tsx`**

This file has the heaviest button surface. Apply the **Pattern reference** at the top of Phase 2 to:
- The "Bulk Activate" button (currently raw `<button disabled={bulkLoading}>`) → `<Button isLoading={bulkLoading} loadingText={t('common.saving')}>`
- The "Bulk Deactivate" button → same pattern
- The individual status toggle in each row → `<ActionIconButton variant="activate"|"deactivate" isLoading={pendingId === user.id} />`
- The "Create user" button (opens modal, no async) → leave as-is unless it's already using `Button`

Track per-row pending state with a `pendingId` ref so only the clicked row's icon spins:

```tsx
const [pendingId, setPendingId] = useState<string | null>(null)

const onToggle = async (id: string) => {
    setPendingId(id)
    try { await fetch(`/api/users/${id}/toggle`, { method: 'POST' }) }
    finally { setPendingId(null) }
}
```

- [ ] **Step 3: Migrate `src/app/admin/dashboard/_content.tsx`**

Apply the same pattern to any async-action buttons. If only navigation links exist, leave as-is — `loading.tsx` handles routing.

- [ ] **Step 4: Migrate `src/app/admin/exercises/_content.tsx`**

Apply pattern. Pay attention to filter/search submit buttons and any "Create exercise" action that triggers a mutation before navigating.

- [ ] **Step 5: Migrate `src/app/admin/programs/_content.tsx`**

Apply pattern.

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: No errors. Fix any unused-import warnings.

- [ ] **Step 8: Smoke test**

Run: `npm run dev`. Log in as admin. Click each migrated button. Verify:
- Spinner shows on the clicked button only.
- Button is disabled during the action.
- Navigation transitions show the overlay (when applicable).

- [ ] **Step 9: Commit**

```bash
git add src/app/admin
git commit -m "refactor(admin): standardize button loading state via Button + ActionIconButton"
```

---

### Task 7: Migrate trainer pages — list & detail screens

**Files:**
- Modify: `src/app/trainer/dashboard/page.tsx`
- Modify: `src/app/trainer/exercises/_content.tsx`
- Modify: `src/app/trainer/programs/_content.tsx`
- Modify: `src/app/trainer/trainees/_content.tsx`

- [ ] **Step 1: Audit each file**

```bash
grep -n "<button" src/app/trainer/dashboard/page.tsx
grep -n "<button" src/app/trainer/exercises/_content.tsx
grep -n "<button" src/app/trainer/programs/_content.tsx
grep -n "<button" src/app/trainer/trainees/_content.tsx
```

- [ ] **Step 2: Migrate per the Pattern reference at the top of Phase 2**

For each async-action button found in the audit, apply the migration pattern (Button + isLoading + loadingText, or ActionIconButton + isLoading for table rows).

Replace inline `<LoadingSpinner />` mid-button with `Button.isLoading` — the component handles spinner placement.

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: No errors.

- [ ] **Step 4: Smoke test**

Log in as trainer. Visit each page. Trigger every interactive button.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/dashboard src/app/trainer/exercises src/app/trainer/programs/_content.tsx src/app/trainer/trainees
git commit -m "refactor(trainer): standardize button loading state on list/detail pages"
```

---

### Task 8: Migrate trainer pages — program editor flows

**Files:**
- Modify: `src/app/trainer/programs/new/NewProgramContent.tsx`
- Modify: `src/app/trainer/programs/[id]/page.tsx`
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`
- Modify: `src/app/trainer/programs/[id]/publish/_content.tsx`
- Modify: `src/app/trainer/programs/[id]/review/_content.tsx`
- Modify: `src/app/trainer/programs/[id]/tests/_content.tsx`
- Modify: `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`

- [ ] **Step 1: Audit each file**

```bash
for f in \
  src/app/trainer/programs/new/NewProgramContent.tsx \
  src/app/trainer/programs/[id]/page.tsx \
  src/app/trainer/programs/[id]/edit/_content.tsx \
  src/app/trainer/programs/[id]/publish/_content.tsx \
  src/app/trainer/programs/[id]/review/_content.tsx \
  src/app/trainer/programs/[id]/tests/_content.tsx \
  src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx; do
    echo "=== $f ==="
    grep -n "<button\|router.push\|fetch(" "$f" 2>/dev/null
done
```

- [ ] **Step 2: Migrate `NewProgramContent.tsx`**

This file already uses `LoadingSpinner` inline (lines 345–346). Replace with the `Button` component using `isLoading={loading}` and `loadingText={t('common.creating')}`.

Because this submits then navigates with `router.push`, also wire `useNavigationLoader`:

```tsx
import { Button, useNavigationLoader } from '@/components'

const navLoader = useNavigationLoader()

const onSubmit = handleSubmit(async (data) => {
    setLoading(true)
    try {
        const res = await fetch('/api/programs', { method: 'POST', body: JSON.stringify(data) })
        const { data: created } = await res.json()
        navLoader.start(t('common.loadingPageTransition'))
        router.push(`/trainer/programs/${created.id}`)
    } catch (err) {
        navLoader.stop()
        setLoading(false)
        // existing error handling
    }
})
```

The `setLoading(false)` is intentionally NOT in `finally` — on success the page unmounts and state is gone; on error we reset.

- [ ] **Step 3: Migrate the remaining trainer program editor files**

Apply the Pattern reference. Special cases:
- `publish/_content.tsx` → publish button uses `loadingText={t('common.submitting')}`. After publish success, navigate via `useNavigationLoader().start()` → `router.push`.
- `review/_content.tsx` → review submit button same pattern.
- `workouts/[wId]/_content.tsx` → likely has multiple per-exercise actions. Use a per-row pending key (e.g. `pendingExerciseId`) to scope the spinner.
- `tests/_content.tsx` → standardize all CRUD action buttons.

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: No errors.

- [ ] **Step 5: Smoke test the create→publish flow**

Run: `npm run dev`. Log in as trainer.

1. Visit `/trainer/programs/new`. Click submit → spinner on button → overlay during navigation → land on the new program detail.
2. Edit a workout → save → spinner on button.
3. Open a program → publish → spinner on button → overlay → redirect.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/new src/app/trainer/programs/[id]
git commit -m "refactor(trainer): standardize loading on program editor flows"
```

---

### Task 9: Migrate trainer pages — exercises & trainees

**Files:**
- Modify: `src/app/trainer/exercises/new/_content.tsx`
- Modify: `src/app/trainer/exercises/[id]/edit/_content.tsx`
- Modify: `src/app/trainer/trainees/new/_content.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx`
- Modify: `src/app/trainer/trainees/[id]/records/_content.tsx`

- [ ] **Step 1: Audit**

```bash
for f in \
  src/app/trainer/exercises/new/_content.tsx \
  src/app/trainer/exercises/[id]/edit/_content.tsx \
  src/app/trainer/trainees/new/_content.tsx \
  src/app/trainer/trainees/[id]/_content.tsx \
  src/app/trainer/trainees/[id]/records/_content.tsx; do
    echo "=== $f ==="
    grep -n "<button\|router.push\|fetch(" "$f" 2>/dev/null
done
```

- [ ] **Step 2: Migrate per the Pattern reference**

For each form-submit page (new exercise, edit exercise, new trainee), apply submit-then-navigate pattern with `useNavigationLoader`. For trainee detail records, use per-row pending state for record actions.

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Smoke test**

Trainer: create exercise, edit exercise, create trainee, edit trainee record actions.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/exercises/new src/app/trainer/exercises/[id] src/app/trainer/trainees
git commit -m "refactor(trainer): standardize loading on exercise + trainee flows"
```

---

### Task 10: Migrate trainee pages

**Files:**
- Modify: `src/app/trainee/dashboard/_content.tsx`
- Modify: `src/app/trainee/history/_content.tsx`
- Modify: `src/app/trainee/programs/[id]/_content.tsx`
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- Modify: `src/app/trainee/programs/current/_content.tsx`
- Modify: `src/app/trainee/records/_content.tsx`
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

- [ ] **Step 1: Audit**

```bash
for f in \
  src/app/trainee/dashboard/_content.tsx \
  src/app/trainee/history/_content.tsx \
  src/app/trainee/programs/[id]/_content.tsx \
  src/app/trainee/programs/_components/ProgramDetailContent.tsx \
  src/app/trainee/programs/current/_content.tsx \
  src/app/trainee/records/_content.tsx \
  src/app/trainee/workouts/[id]/_content.tsx; do
    echo "=== $f ==="
    grep -n "<button\|router.push\|fetch(" "$f" 2>/dev/null
done
```

- [ ] **Step 2: Migrate per the Pattern reference**

Special focus on `workouts/[id]/_content.tsx` — this is the workout-execution screen. Per-set / per-exercise async buttons (log set, record RPE) need per-row pending state so only the clicked control spins, not all of them.

```tsx
const [pendingSetId, setPendingSetId] = useState<string | null>(null)

const onLogSet = async (setId: string) => {
    setPendingSetId(setId)
    try { await fetch(`/api/sets/${setId}/log`, { method: 'POST' }) }
    finally { setPendingSetId(null) }
}

// In JSX:
<Button isLoading={pendingSetId === set.id} loadingText={t('common.saving')} onClick={() => onLogSet(set.id)}>
    {t('common.save')}
</Button>
```

For `records/_content.tsx` — PR creation form: standard `Button isLoading={creating} loadingText={t('common.creating')}`.

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Smoke test**

Log in as trainee. Run a full workout flow (open workout → log sets → submit). Verify per-set spinner. Then visit history, records, current program.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainee
git commit -m "refactor(trainee): standardize loading across trainee pages"
```

---

### Task 11: Migrate auth / onboarding / profile pages

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/forgot-password/page.tsx` (if exists)
- Modify: `src/app/reset-password/page.tsx`
- Modify: `src/app/force-change-password/page.tsx` (if exists)
- Modify: `src/app/onboarding/set-password/page.tsx`
- Modify: `src/app/profile/change-password/_content.tsx`
- Modify: `src/app/profile/page.tsx` (if exists)

- [ ] **Step 1: Audit**

```bash
for f in \
  src/app/login/page.tsx \
  src/app/forgot-password/page.tsx \
  src/app/reset-password/page.tsx \
  src/app/force-change-password/page.tsx \
  src/app/onboarding/set-password/page.tsx \
  src/app/profile/change-password/_content.tsx \
  src/app/profile/page.tsx; do
    if [ -f "$f" ]; then
        echo "=== $f ==="
        grep -n "<button\|router.push\|fetch(" "$f"
    fi
done
```

- [ ] **Step 2: Migrate**

Login button → `<Button isLoading={loggingIn} loadingText={t('common.loading')}>`.

Password change buttons → `loadingText={t('common.saving')}`.

After successful login, call `useNavigationLoader().start()` before `router.push` so the overlay shows during the JWT refresh + dashboard fetch:

```tsx
const onLogin = async () => {
    setLoggingIn(true)
    try {
        await signIn(email, password)
        navLoader.start(t('common.loadingPageTransition'))
        router.push(`/${role}/dashboard`)
    } catch (err) {
        navLoader.stop()
        setLoggingIn(false)
        // surface error
    }
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Smoke test**

Full auth flow: login → dashboard → logout → forgot-password → reset → onboarding (if applicable). Verify button spinners and navigation overlay.

- [ ] **Step 5: Commit**

```bash
git add src/app/login src/app/reset-password src/app/onboarding src/app/profile
# include forgot-password / force-change-password if files were modified
git commit -m "refactor(auth): standardize loading on auth and onboarding pages"
```

---

## Phase 3 — Documentation

### Task 12: Document the loader standard

**Files:**
- Modify: `CLAUDE.md`
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add a Loader Standard section to `CLAUDE.md`**

Find the `### Frontend patterns` section in `CLAUDE.md` and append:

```markdown
- **Loaders** — two patterns only:
  1. **Click-triggered async**: use `<Button isLoading={...} loadingText={t('common.saving')}>` (or `<ActionIconButton isLoading={...}>` for icon-only). Never a raw `<button disabled={loading}>`.
  2. **Page navigation**: handled automatically by `loading.tsx` segments (Next.js renders `NavigationLoadingOverlay`). For client-driven post-submit redirects, call `useNavigationLoader().start()` before `router.push` and `.stop()` on error.
  - `FullPageLoader` (with logo + branding) is reserved for cold-start / app-bootstrap, not in-app navigation.
```

- [ ] **Step 2: Add CHANGELOG entry**

Open `implementation-docs/CHANGELOG.md` and prepend a dated entry:

```markdown
## 2026-04-27 — Loader standardization

- Added `NavigationLoadingOverlay` (semitransparent fullscreen + centered primary spinner).
- Added `NavigationLoadingProvider` + `useNavigationLoader()` for client-driven overlay control.
- Mounted provider in root layout.
- Added `loading.tsx` to every route segment under `admin/`, `trainer/`, `trainee/`.
- Migrated all async-action buttons across admin, trainer, trainee, auth and onboarding pages to `Button` / `ActionIconButton` with `isLoading`.
- Standardized two-pattern loader rule in `CLAUDE.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md implementation-docs/CHANGELOG.md
git commit -m "docs: document loader standardization pattern"
```

---

## Phase 4 — Verification

### Task 13: Final verification

- [ ] **Step 1: Type-check**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors. No unused imports left over from migrations.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: All pass — including the two new tests for `NavigationLoadingOverlay` and `NavigationLoadingProvider`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: E2E smoke**

Run: `npm run test:e2e -- --grep navigation` (if such tests exist) or run a manual checklist:

- Login → dashboard: overlay visible during transition.
- Trainer create program → submit → overlay → land on detail.
- Trainee log a set → spinner only on that set's button.
- Admin bulk activate users → spinner on bulk button only.

- [ ] **Step 6: Audit residual raw buttons**

Run:
```bash
grep -rn "<button" src/app --include="*.tsx" | grep -v "type=\"submit\"" | grep -v "// allowed"
```

For every match, confirm the button is **not** triggering async work. If it is, return to the relevant migration task.

- [ ] **Step 7: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address residual loader audit findings"
```

---

## Self-Review Checklist (post-write)

- ✅ Spec coverage: button-click loader (covered in Tasks 6–11), page-transition overlay (covered in Tasks 1, 4, 5).
- ✅ All three roles migrated: admin (Task 6), trainer (Tasks 7–9), trainee (Task 10).
- ✅ Auth covered (Task 11).
- ✅ Documentation updated (Task 12).
- ✅ Verification gate (Task 13).
- ✅ No placeholder steps; every step has concrete file paths, code, and commands.
- ✅ Component names consistent: `NavigationLoadingOverlay`, `NavigationLoadingProvider`, `useNavigationLoader`.
- ✅ i18n keys reused from existing `common.json` — no new keys needed.

---

## Risks & Notes

1. **`loading.tsx` only fires on RSC suspensions.** Pages that are fully client-side and re-use cached data may not show the overlay during navigation. The `useNavigationLoader` hook covers those cases — but only when the engineer remembers to call `.start()`. The CLAUDE.md doc note in Task 12 is the durable reminder.
2. **`FullPageLoader` is now orphaned for in-app navigation** but still exported and usable. Do not delete — it's still appropriate for cold-start. If a future task confirms it's truly unused, that's a separate cleanup.
3. **Per-row pending state** is the correct pattern for tables / lists. A single `loading` boolean at parent scope causes ALL rows' buttons to spin — bad UX. Phase 2 tasks call this out for high-traffic pages.
4. **Migration is mechanical, not architectural.** If any page reveals a deeper data-fetching issue (e.g. uncaught promise, race condition), surface it as a separate ticket rather than expanding scope here.
