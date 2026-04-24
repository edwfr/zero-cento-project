# ActionIconButton Standard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `ActionIconButton` + `InlineActions` as the single standard for inline row actions (edit, view, view-test, delete), replacing 4 inconsistent ad-hoc patterns that exist today, and document them in the component showcase.

**Architecture:** One new file (`ActionIconButton.tsx`) exports two components — `ActionIconButton` (icon-only button, renders as `<Link>` or `<button>` depending on props) and `InlineActions` (flex container wrapper). All existing inline-action markup in tables and cards is replaced with these components. The showcase gets a new section after "Buttons".

**Tech Stack:** Next.js 15, React, Tailwind CSS, lucide-react, Vitest + @testing-library/react

---

## Current inconsistency map

| File | Pattern | Problem |
|------|---------|---------|
| `trainer/programs/_content.tsx:387-449` | `inline-flex h-8 w-8` icon buttons | ✅ Best pattern — becomes the standard |
| `trainer/exercises/_content.tsx:298-315, 391-408` | Same `inline-flex h-8 w-8` | Duplicated by hand twice (table + card view) |
| `components/UsersTable.tsx:233-250` | Inline SVG in `<button>` with `text-brand-primary / text-red-600` | No background, no size consistency |
| `components/ProgramsTable.tsx:293-325` | Mix of text links + inline SVG | Different size, no hover bg, not icon-first |

---

## File map

| Action | Path | Responsibility |
|--------|------|---------------|
| **Create** | `src/components/ActionIconButton.tsx` | `ActionIconButton` + `InlineActions` exports |
| **Create** | `tests/unit/ActionIconButton.test.tsx` | Unit tests for both components |
| **Modify** | `src/components/index.ts` | Barrel-export new components |
| **Modify** | `vitest.config.ts` | Add `ActionIconButton.tsx` to coverage include |
| **Modify** | `src/app/components-showcase/page.tsx` | New "Action Icon Buttons" section after "Buttons" |
| **Modify** | `src/app/trainer/programs/_content.tsx` | Adopt `ActionIconButton` + `InlineActions` |
| **Modify** | `src/app/trainer/exercises/_content.tsx` | Adopt in table view + card view |
| **Modify** | `src/components/UsersTable.tsx` | Replace inline-SVG buttons |
| **Modify** | `src/components/ProgramsTable.tsx` | Replace text-link + inline-SVG pattern |

---

## Task 1 — Create `ActionIconButton` + `InlineActions` + unit tests

**Files:**
- Create: `src/components/ActionIconButton.tsx`
- Create: `tests/unit/ActionIconButton.test.tsx`

---

- [ ] **Step 1: Write failing tests**

```tsx
// tests/unit/ActionIconButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}))

describe('ActionIconButton', () => {
    it('renders as a link when href is provided', () => {
        render(<ActionIconButton variant="view" label="Visualizza" href="/programs/1" />)
        const el = screen.getByRole('link', { name: 'Visualizza' })
        expect(el).toBeInTheDocument()
        expect(el).toHaveAttribute('href', '/programs/1')
    })

    it('renders as a button when onClick is provided', () => {
        render(<ActionIconButton variant="delete" label="Elimina" onClick={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument()
    })

    it('calls onClick when button is clicked', () => {
        const handleClick = vi.fn()
        render(<ActionIconButton variant="delete" label="Elimina" onClick={handleClick} />)
        fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders as disabled button when disabled is true (even with href)', () => {
        render(<ActionIconButton variant="view-test" label="Test" href="/tests" disabled />)
        const el = screen.getByRole('button', { name: 'Test' })
        expect(el).toBeDisabled()
    })

    it('applies correct title attribute', () => {
        render(<ActionIconButton variant="edit" label="Modifica" onClick={vi.fn()} />)
        expect(screen.getByTitle('Modifica')).toBeInTheDocument()
    })
})

describe('InlineActions', () => {
    it('renders children', () => {
        render(
            <InlineActions>
                <span>child1</span>
                <span>child2</span>
            </InlineActions>
        )
        expect(screen.getByText('child1')).toBeInTheDocument()
        expect(screen.getByText('child2')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npx vitest run tests/unit/ActionIconButton.test.tsx
```

Expected: `Error: Cannot find module '@/components/ActionIconButton'`

- [ ] **Step 3: Create the component**

```tsx
// src/components/ActionIconButton.tsx
import Link from 'next/link'
import { FileEdit, Eye, FlaskConical, Trash2, type LucideIcon } from 'lucide-react'

export type ActionVariant = 'edit' | 'view' | 'view-test' | 'delete'

export interface ActionIconButtonProps {
    variant: ActionVariant
    label: string
    href?: string
    onClick?: () => void
    disabled?: boolean
}

const VARIANT_CONFIG: Record<ActionVariant, { Icon: LucideIcon; activeClass: string }> = {
    edit: { Icon: FileEdit, activeClass: 'bg-green-600 hover:bg-green-700' },
    view: { Icon: Eye, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    'view-test': { Icon: FlaskConical, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    delete: { Icon: Trash2, activeClass: 'bg-red-600 hover:bg-red-700' },
}

const BASE =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors'
const DISABLED_CLASS = 'bg-gray-200 text-gray-500 cursor-not-allowed'

export function ActionIconButton({
    variant,
    label,
    href,
    onClick,
    disabled = false,
}: ActionIconButtonProps) {
    const { Icon, activeClass } = VARIANT_CONFIG[variant]
    const className = `${BASE} ${disabled ? DISABLED_CLASS : activeClass}`
    const icon = <Icon className="w-4 h-4" />

    if (href && !disabled) {
        return (
            <Link href={href} className={className} title={label} aria-label={label}>
                {icon}
            </Link>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={className}
            title={label}
            aria-label={label}
        >
            {icon}
        </button>
    )
}

export function InlineActions({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-end gap-2">{children}</div>
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/ActionIconButton.test.tsx
```

Expected: `✓ 6 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionIconButton.tsx tests/unit/ActionIconButton.test.tsx
git commit -m "feat: add ActionIconButton and InlineActions components"
```

---

## Task 2 — Export + coverage + showcase

**Files:**
- Modify: `src/components/index.ts` (line 7 area — after Button export)
- Modify: `vitest.config.ts` (line 24 area — after RoleGuard)
- Modify: `src/app/components-showcase/page.tsx` (after Buttons section closing `</section>` at line 171)

---

- [ ] **Step 1: Add to barrel export**

In `src/components/index.ts`, after `export { Button } ...` block (line 7–8), add:

```ts
// Action Buttons
export { ActionIconButton, InlineActions } from './ActionIconButton'
export type { ActionIconButtonProps, ActionVariant } from './ActionIconButton'
```

- [ ] **Step 2: Add to vitest coverage**

In `vitest.config.ts`, inside the `include` array (after line 26 `'src/components/RoleGuard.tsx'`), add:

```ts
'src/components/ActionIconButton.tsx',
```

- [ ] **Step 3: Add showcase import**

In `src/app/components-showcase/page.tsx`, find the existing imports from lucide-react (line 1 area). Add `ActionIconButton` and `InlineActions` to the imports from `@/components`:

Find this import line (it will be near the top, imports from `@/components`):
```ts
import {
    Button,
    // ... existing imports
} from '@/components'
```
Add to the destructured list:
```ts
    ActionIconButton,
    InlineActions,
```

- [ ] **Step 4: Add showcase section**

In `src/app/components-showcase/page.tsx`, find the closing `</section>` of the Buttons section (after line 171) and insert a new section immediately after it:

```tsx
                {/* Action Icon Buttons */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Action Icon Buttons</h2>
                    <p className="mb-6 text-sm text-gray-600">
                        Standard per i bottoni azione inline nelle righe di tabella. Usare sempre{' '}
                        <code className="rounded bg-gray-100 px-1 text-xs">ActionIconButton</code> +{' '}
                        <code className="rounded bg-gray-100 px-1 text-xs">InlineActions</code> al posto di markup ad-hoc.
                    </p>
                    <div className="space-y-6">
                        {/* Variants */}
                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">Varianti</h3>
                            <InlineActions>
                                <ActionIconButton variant="edit" label="Modifica" onClick={() => {}} />
                                <ActionIconButton variant="view" label="Visualizza" onClick={() => {}} />
                                <ActionIconButton variant="view-test" label="Visualizza test" onClick={() => {}} />
                                <ActionIconButton variant="delete" label="Elimina" onClick={() => {}} />
                            </InlineActions>
                            <p className="mt-2 text-xs text-gray-500">
                                edit (verde) · view (brand) · view-test (brand) · delete (rosso)
                            </p>
                        </div>

                        {/* Disabled */}
                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">Disabled</h3>
                            <InlineActions>
                                <ActionIconButton variant="edit" label="Modifica" onClick={() => {}} disabled />
                                <ActionIconButton variant="view" label="Visualizza" onClick={() => {}} disabled />
                                <ActionIconButton variant="view-test" label="Visualizza test" onClick={() => {}} disabled />
                                <ActionIconButton variant="delete" label="Elimina" onClick={() => {}} disabled />
                            </InlineActions>
                        </div>

                        {/* As Link */}
                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">Come Link (href)</h3>
                            <InlineActions>
                                <ActionIconButton variant="edit" label="Modifica" href="#" />
                                <ActionIconButton variant="view" label="Visualizza" href="#" />
                                <ActionIconButton variant="view-test" label="Visualizza test" href="#" />
                            </InlineActions>
                            <p className="mt-2 text-xs text-gray-500">
                                Quando si passa <code className="rounded bg-gray-100 px-1">href</code> il componente
                                renderizza come <code className="rounded bg-gray-100 px-1">&lt;Link&gt;</code>.
                                Con <code className="rounded bg-gray-100 px-1">disabled</code> torna sempre{' '}
                                <code className="rounded bg-gray-100 px-1">&lt;button disabled&gt;</code>.
                            </p>
                        </div>

                        {/* Usage example */}
                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">Esempio — riga tabella (draft program)</h3>
                            <div className="overflow-hidden rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Programma</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stato</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        <tr>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Forza Base - Mario</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">Bozza</td>
                                            <td className="px-6 py-4">
                                                <InlineActions>
                                                    <ActionIconButton variant="edit" label="Modifica" href="#" />
                                                    <ActionIconButton variant="view" label="Visualizza" href="#" />
                                                    <ActionIconButton variant="delete" label="Elimina" onClick={() => {}} />
                                                </InlineActions>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Ipertrofia - Luca</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">Attivo</td>
                                            <td className="px-6 py-4">
                                                <InlineActions>
                                                    <ActionIconButton variant="view" label="Visualizza" href="#" />
                                                    <ActionIconButton variant="view-test" label="Visualizza test" href="#" />
                                                </InlineActions>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Potenza - Sara</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">Completato</td>
                                            <td className="px-6 py-4">
                                                <InlineActions>
                                                    <ActionIconButton variant="view" label="Visualizza" href="#" />
                                                    <ActionIconButton variant="view-test" label="Visualizza test" disabled />
                                                </InlineActions>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
```

- [ ] **Step 5: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/unit/ActionIconButton.test.tsx
```

Expected: `✓ 6 tests passed`

- [ ] **Step 7: Commit**

```bash
git add src/components/index.ts vitest.config.ts src/app/components-showcase/page.tsx
git commit -m "feat: export ActionIconButton, add coverage, add showcase section"
```

---

## Task 3 — Adopt in `trainer/programs/_content.tsx`

**Files:**
- Modify: `src/app/trainer/programs/_content.tsx`

The current imports (line 11) already include `FileEdit, Eye, FlaskConical, Trash2` from lucide-react. After adopting, these can be removed if no longer used elsewhere in the file.

---

- [ ] **Step 1: Add import**

Near the top of `src/app/trainer/programs/_content.tsx`, add after the existing component imports:

```ts
import { ActionIconButton, InlineActions } from '@/components'
```

- [ ] **Step 2: Replace draft program actions (lines ~387–416)**

Replace this block (the `<div className="flex flex-wrap items-center justify-end gap-2">` wrapping draft actions):

```tsx
// BEFORE
<div className="flex flex-wrap items-center justify-end gap-2">
    <>
        <Link
            href={`/trainer/programs/${program.id}/edit`}
            title={t('programs.editProgramAction')}
            aria-label={t('programs.editProgramAction')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
            <FileEdit className="w-4 h-4" />
        </Link>
        <Link
            href={`/trainer/programs/${program.id}`}
            title={t('programs.viewProgram')}
            aria-label={t('programs.viewProgram')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors"
        >
            <Eye className="w-4 h-4" />
        </Link>
        <button
            onClick={() => handleDelete(program.id, program.title)}
            title={t('programs.delete')}
            aria-label={t('programs.delete')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    </>
</div>
```

With:

```tsx
// AFTER
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
        variant="delete"
        label={t('programs.delete')}
        onClick={() => handleDelete(program.id, program.title)}
    />
</InlineActions>
```

- [ ] **Step 3: Replace active/completed program actions (lines ~418–448)**

Replace the second `<div className="flex flex-wrap items-center justify-end gap-2">` block:

```tsx
// BEFORE
<div className="flex flex-wrap items-center justify-end gap-2">
    <>
        <Link
            href={`/trainer/programs/${program.id}`}
            title={t('programs.viewProgram')}
            aria-label={t('programs.viewProgram')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors"
        >
            <Eye className="w-4 h-4" />
        </Link>
        {testsCompleted ? (
            <Link
                href={`/trainer/programs/${program.id}/tests?backContext=programs`}
                title={t('programs.viewTests')}
                aria-label={t('programs.viewTests')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors"
            >
                <FlaskConical className="w-4 h-4" />
            </Link>
        ) : (
            <button
                type="button"
                disabled
                title={t('programs.testsButtonDisabledTooltip')}
                aria-label={t('programs.viewTests')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed"
            >
                <FlaskConical className="w-4 h-4" />
            </button>
        )}
    </>
</div>
```

With:

```tsx
// AFTER
<InlineActions>
    <ActionIconButton
        variant="view"
        label={t('programs.viewProgram')}
        href={`/trainer/programs/${program.id}`}
    />
    <ActionIconButton
        variant="view-test"
        label={testsCompleted ? t('programs.viewTests') : t('programs.testsButtonDisabledTooltip')}
        href={testsCompleted ? `/trainer/programs/${program.id}/tests?backContext=programs` : undefined}
        onClick={testsCompleted ? undefined : undefined}
        disabled={!testsCompleted}
    />
</InlineActions>
```

- [ ] **Step 4: Remove now-unused lucide imports**

Check if `FileEdit`, `Eye`, `FlaskConical`, `Trash2` are still used elsewhere in the file (e.g. in tab labels). Remove only the ones that are no longer referenced:

```bash
grep -n "FileEdit\|Eye\|FlaskConical\|Trash2" src/app/trainer/programs/_content.tsx
```

Remove from the lucide import line only icons that appear 0 times outside the import itself.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/_content.tsx
git commit -m "refactor: adopt ActionIconButton in trainer programs table"
```

---

## Task 4 — Adopt in `trainer/exercises/_content.tsx`

**Files:**
- Modify: `src/app/trainer/exercises/_content.tsx`

Two spots: table view (lines ~298–315) and card view (lines ~391–408). Both have the same two actions: edit + delete.

---

- [ ] **Step 1: Add import**

Add after existing component imports:

```ts
import { ActionIconButton, InlineActions } from '@/components'
```

- [ ] **Step 2: Replace table view actions (lines ~298–315)**

Replace:

```tsx
// BEFORE
<div className="flex items-center justify-end gap-2">
    <Link
        href={`/trainer/exercises/${exercise.id}/edit`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        title={t('common:common.edit')}
        aria-label={t('common:common.edit')}
    >
        <FileEdit className="w-4 h-4" />
    </Link>
    <button
        onClick={() => handleDelete(exercise.id, exercise.name)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        title={t('common:common.delete')}
        aria-label={t('common:common.delete')}
    >
        <Trash2 className="w-4 h-4" />
    </button>
</div>
```

With:

```tsx
// AFTER
<InlineActions>
    <ActionIconButton
        variant="edit"
        label={t('common:common.edit')}
        href={`/trainer/exercises/${exercise.id}/edit`}
    />
    <ActionIconButton
        variant="delete"
        label={t('common:common.delete')}
        onClick={() => handleDelete(exercise.id, exercise.name)}
    />
</InlineActions>
```

- [ ] **Step 3: Replace card view actions (lines ~391–408)**

Replace the identical markup in the card footer section:

```tsx
// BEFORE
<div className="flex items-center justify-end gap-2">
    <Link
        href={`/trainer/exercises/${exercise.id}/edit`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        title={t('common:common.edit')}
        aria-label={t('common:common.edit')}
    >
        <FileEdit className="w-4 h-4" />
    </Link>
    <button
        onClick={() => handleDelete(exercise.id, exercise.name)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        title={t('common:common.delete')}
        aria-label={t('common:common.delete')}
    >
        <Trash2 className="w-4 h-4" />
    </button>
</div>
```

With:

```tsx
// AFTER
<InlineActions>
    <ActionIconButton
        variant="edit"
        label={t('common:common.edit')}
        href={`/trainer/exercises/${exercise.id}/edit`}
    />
    <ActionIconButton
        variant="delete"
        label={t('common:common.delete')}
        onClick={() => handleDelete(exercise.id, exercise.name)}
    />
</InlineActions>
```

- [ ] **Step 4: Remove now-unused lucide imports**

```bash
grep -n "FileEdit\|Trash2" src/app/trainer/exercises/_content.tsx
```

Remove from lucide import line any icons with 0 remaining uses.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/exercises/_content.tsx
git commit -m "refactor: adopt ActionIconButton in trainer exercises (table + card)"
```

---

## Task 5 — Adopt in `UsersTable.tsx`

**Files:**
- Modify: `src/components/UsersTable.tsx`

Current pattern at lines ~233–250: two `<button>` elements with inline SVG (no background, no size consistency).

---

- [ ] **Step 1: Add import**

At the top of `src/components/UsersTable.tsx`, add after existing imports:

```ts
import { ActionIconButton, InlineActions } from './ActionIconButton'
```

> Note: direct import path (not barrel) because this file is inside `src/components/` itself.

- [ ] **Step 2: Replace actions (lines ~232–251)**

Replace:

```tsx
// BEFORE
<div className="flex justify-end space-x-2">
    <button
        onClick={() => setEditingUser(user)}
        className="text-brand-primary hover:text-brand-primary/80"
        title={t('common:common.edit')}
    >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    </button>
    <button
        onClick={() => setDeletingUser(user)}
        className="text-red-600 hover:text-red-900"
        title={t('common:common.delete')}
    >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    </button>
</div>
```

With:

```tsx
// AFTER
<InlineActions>
    <ActionIconButton
        variant="edit"
        label={t('common:common.edit')}
        onClick={() => setEditingUser(user)}
    />
    <ActionIconButton
        variant="delete"
        label={t('common:common.delete')}
        onClick={() => setDeletingUser(user)}
    />
</InlineActions>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/UsersTable.tsx
git commit -m "refactor: adopt ActionIconButton in UsersTable"
```

---

## Task 6 — Adopt in `ProgramsTable.tsx`

**Files:**
- Modify: `src/components/ProgramsTable.tsx`

Current pattern at lines ~292–325: text link for view + inline-SVG `<Link>` for edit + inline-SVG `<button>` for delete. Mix of sizes and colors.

---

- [ ] **Step 1: Add import**

```ts
import { ActionIconButton, InlineActions } from './ActionIconButton'
```

- [ ] **Step 2: Replace actions block (lines ~292–325)**

Replace:

```tsx
// BEFORE
<div className="flex items-center justify-end space-x-2">
    <Link
        href={`${basePath}/${program.id}`}
        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold"
    >
        {t('common:common.view')}
    </Link>
    {program.status === 'draft' && (
        <>
            <Link
                href={`${basePath}/${program.id}/edit`}
                className="text-green-600 hover:text-green-800"
                title={t('common:common.edit')}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </Link>
            <button
                onClick={() => handleDelete(program.id, program.title)}
                disabled={deleting === program.id}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                title={t('common:common.delete')}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </>
    )}
</div>
```

With:

```tsx
// AFTER
<InlineActions>
    <ActionIconButton
        variant="view"
        label={t('common:common.view')}
        href={`${basePath}/${program.id}`}
    />
    {program.status === 'draft' && (
        <>
            <ActionIconButton
                variant="edit"
                label={t('common:common.edit')}
                href={`${basePath}/${program.id}/edit`}
            />
            <ActionIconButton
                variant="delete"
                label={t('common:common.delete')}
                onClick={() => handleDelete(program.id, program.title)}
                disabled={deleting === program.id}
            />
        </>
    )}
</InlineActions>
```

- [ ] **Step 3: Remove now-unused lucide imports from `ProgramsTable.tsx`**

```bash
grep -n "FileEdit\|Trash2" src/components/ProgramsTable.tsx
```

Remove any that are now unused.

- [ ] **Step 4: Type-check + run unit tests**

```bash
npx tsc --noEmit && npx vitest run tests/unit/ActionIconButton.test.tsx tests/unit/components.test.tsx
```

Expected: no type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgramsTable.tsx
git commit -m "refactor: adopt ActionIconButton in ProgramsTable"
```

---

## Post-adoption checklist

- [ ] Verify showcase at `http://localhost:3000/components-showcase` — "Action Icon Buttons" section visible with all variants, disabled states, link mode, and table example
- [ ] Check trainer programs page — actions render correctly for draft vs active programs
- [ ] Check trainer exercises page — table and card views both show standardized buttons
- [ ] Check admin users table — edit/delete buttons match new style
- [ ] Check admin programs table — view/edit/delete buttons match new style
- [ ] Run full unit test suite: `npx vitest run`
- [ ] Run type-check: `npx tsc --noEmit`
