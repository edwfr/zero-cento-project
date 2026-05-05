# Test Suite Review & Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken test runner (Node/Vitest incompatibility), eliminate inconsistencies across unit and integration tests, fix one flaky test, and codify standards in a project-scoped skill so future tests stay consistent.

**Architecture:** Fix is layered — environment first (Node version), then global mocks, then file-level fixes, then shared fixtures, then skill. Each task is self-contained and produces a green test run (or a green subset) before the next task starts.

**Tech Stack:** Vitest 4.x (+ Node 20 required), @testing-library/react, vitest-dom, react-i18next, Prisma mocks, Next.js 15 App Router mocks.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `.nvmrc` | Create | Pin Node version to `20` |
| `tests/unit/setup.ts` | Modify | Add `react-i18next` global mock |
| `tests/unit/DashboardLayout.test.tsx` | Modify | Remove duplicate mocks, fix broken tests, static imports |
| `tests/unit/password-utils.test.ts` | Modify | Remove flaky randomness test |
| `tests/integration/fixtures.ts` | Create | Shared session + Prisma mock fixtures |
| `tests/integration/api-contracts.test.ts` | Modify | Import shared fixtures |
| `tests/integration/programs.test.ts` | Modify | Import shared fixtures |
| `tests/integration/rbac.test.ts` | Modify | Import shared fixtures |
| `tests/integration/users.test.ts` | Modify | Import shared fixtures |
| `tests/integration/exercises.test.ts` | Modify | Import shared fixtures |
| `tests/integration/feedback.test.ts` | Modify | Import shared fixtures |
| `tests/integration/personal-records.test.ts` | Modify | Import shared fixtures |
| `tests/integration/auth-session.test.ts` | Modify | Import shared fixtures |
| `vitest.config.ts` | Modify | Add `DashboardLayout.tsx` to coverage |
| `.claude/skills/zero-cento-testing/SKILL.md` | Create | Project-scoped testing skill |

---

## Task 1: Pin Node version and verify tests can run

**Files:**
- Create: `.nvmrc`

The entire test suite is broken because `vitest@4.1.4` requires Node 20+ (via rolldown's use of `node:util`'s `styleText` export, added in Node 20.12.0). The project's `package.json` already declares `"engines": { "node": ">=20.0.0" }` — the runtime environment is simply wrong.

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

File path: `/mnt/c/dev-projects/zero-cento-project/.nvmrc`

- [ ] **Step 2: Switch Node version and verify**

```bash
nvm use 20
node --version   # must show v20.x.x or higher
```

If `nvm` is not available, the user must install Node 20 via their OS package manager or `nvm install 20`.

- [ ] **Step 3: Run the full test suite and record baseline**

```bash
npm run test:unit -- --run 2>&1 | tail -40
```

Expected: tests execute (some may fail, but no startup error). Record the failure count — it is the baseline for subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add .nvmrc
git commit -m "chore: add .nvmrc pinning Node 20 (vitest 4 requirement)"
```

---

## Task 2: Add `react-i18next` global mock to `setup.ts`

**Files:**
- Modify: `tests/unit/setup.ts`

`DashboardLayout.test.tsx` defines a local `vi.mock('react-i18next', ...)` because `setup.ts` doesn't include it. Any component that calls `useTranslation()` will need this mock. Moving it to `setup.ts` eliminates repetition and prevents future local re-declarations.

- [ ] **Step 1: Add the mock to `setup.ts`**

Open `tests/unit/setup.ts`. After the existing mock blocks, add:

```typescript
// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npm run test:unit -- --run 2>&1 | tail -20
```

Expected: same or fewer failures than Task 1 baseline.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/setup.ts
git commit -m "test: add react-i18next global mock to setup.ts"
```

---

## Task 3: Fix `DashboardLayout.test.tsx`

**Files:**
- Modify: `tests/unit/DashboardLayout.test.tsx`

Three problems in this file:
1. Re-declares `next/navigation`, `next/link`, and `@/lib/supabase-client` mocks that already exist in `setup.ts` — noise and drift risk.
2. Uses `require('@/components/DashboardLayout')` (dynamic CJS require) instead of static ESM import — inconsistent with every other test file.
3. Third test ("does not render back button when backHref is not provided") tests nothing meaningful — it asserts `link count > 0`, which is always true due to nav links.

- [ ] **Step 1: Rewrite `DashboardLayout.test.tsx`**

Replace the entire file content:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardLayout from '@/components/DashboardLayout'

// next/navigation, next/link, @/lib/supabase-client, react-i18next
// are all mocked globally in tests/unit/setup.ts

vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}))

const mockUser = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'trainer' as const,
}

describe('DashboardLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders children', () => {
        render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('renders back link with correct href when backHref is provided', () => {
        render(
            <DashboardLayout user={mockUser} backHref="/trainer/dashboard">
                <div>Test Content</div>
            </DashboardLayout>
        )
        const backLink = screen.getByTestId('back-nav-link')
        expect(backLink).toBeInTheDocument()
        expect(backLink).toHaveAttribute('href', '/trainer/dashboard')
    })

    it('does not render back link when backHref is not provided', () => {
        render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        expect(screen.queryByTestId('back-nav-link')).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Add `data-testid="back-nav-link"` to `DashboardLayout.tsx`**

Open `src/components/DashboardLayout.tsx`. Find the back navigation anchor/link element (the one rendered when `backHref` is provided) and add `data-testid="back-nav-link"` to it.

Run:
```bash
grep -n "backHref\|back" src/components/DashboardLayout.tsx | head -20
```
to locate the exact element.

- [ ] **Step 3: Run DashboardLayout tests**

```bash
npx vitest run tests/unit/DashboardLayout.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 4: Run full unit suite to check for regressions**

```bash
npm run test:unit -- --run 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/DashboardLayout.test.tsx src/components/DashboardLayout.tsx
git commit -m "test: fix DashboardLayout tests — remove duplicate mocks, static import, correct assertions"
```

---

## Task 4: Remove flaky test from `password-utils.test.ts`

**Files:**
- Modify: `tests/unit/password-utils.test.ts`

The test `"does not produce predictable patterns"` asserts that the generated password does NOT contain sequential character sequences (`abc`, `123`, etc.) — but these CAN appear by chance in a random string, making the test non-deterministic. A 12-char password from 70-char pool can statistically contain these sequences.

- [ ] **Step 1: Remove the flaky test**

In `tests/unit/password-utils.test.ts`, find and remove the `it('does not produce predictable patterns', ...)` block entirely.

The block to remove:

```typescript
it('does not produce predictable patterns', () => {
    const password = generateSecurePassword()

    // Should not have obvious sequential patterns
    const hasSequentialChars = /abc|bcd|cde|123|234|345|678|789/i.test(password)
    const hasRepeatingChars = /(.)\1{3,}/.test(password)

    // While not guaranteed, it's extremely unlikely these patterns appear
    // This is a statistical test that may occasionally fail due to randomness
    // but with low probability for secure generation
    expect(hasSequentialChars || hasRepeatingChars).toBe(false)
})
```

Note: the test comment itself admits it "may occasionally fail" — that is the definition of a flaky test and it must go.

- [ ] **Step 2: Run password-utils tests**

```bash
npx vitest run tests/unit/password-utils.test.ts
```

Expected: all remaining tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/password-utils.test.ts
git commit -m "test: remove flaky sequential-pattern test from password-utils"
```

---

## Task 5: Create shared integration test fixtures

**Files:**
- Create: `tests/integration/fixtures.ts`
- Modify: `tests/integration/api-contracts.test.ts`
- Modify: `tests/integration/programs.test.ts`
- Modify: `tests/integration/rbac.test.ts`
- Modify: `tests/integration/users.test.ts`
- Modify: `tests/integration/exercises.test.ts`
- Modify: `tests/integration/feedback.test.ts`
- Modify: `tests/integration/personal-records.test.ts`
- Modify: `tests/integration/auth-session.test.ts`

Every integration test file re-declares the same session fixtures (`mockTrainerSession`, `mockAdminSession`, etc.) verbatim. This is copy-paste debt — a change to the session shape requires touching 8 files.

- [ ] **Step 1: Create `tests/integration/fixtures.ts`**

```typescript
export const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Marco',
        lastName: 'Trainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

export const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

export const mockTraineeSession = {
    user: {
        id: 'trainee-uuid-1',
        email: 'trainee@zerocento.it',
        firstName: 'Trainee',
        lastName: 'User',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

/** Returns a trainer session with custom overrides. */
export const makeTrainerSession = (overrides: Partial<typeof mockTrainerSession.user> = {}) => ({
    ...mockTrainerSession,
    user: { ...mockTrainerSession.user, ...overrides },
})

/** Returns an admin session with custom overrides. */
export const makeAdminSession = (overrides: Partial<typeof mockAdminSession.user> = {}) => ({
    ...mockAdminSession,
    user: { ...mockAdminSession.user, ...overrides },
})
```

- [ ] **Step 2: Verify fixtures file compiles**

```bash
npx tsc --noEmit --esModuleInterop tests/integration/fixtures.ts 2>&1 || echo "check errors above"
```

Expected: no errors.

- [ ] **Step 3: Update each integration test file to import shared fixtures**

For each integration test file that declares its own `mockTrainerSession` / `mockAdminSession`:

1. Open the file.
2. Remove the local session fixture declarations.
3. Add at the top (before any `vi.mock` calls):

```typescript
import { mockTrainerSession, mockAdminSession, mockTraineeSession, makeTrainerSession } from './fixtures'
```

4. Keep all other file-specific fixtures (Prisma mock shapes, request builders, etc.) in place.

Files to update:
- `tests/integration/api-contracts.test.ts`
- `tests/integration/programs.test.ts`
- `tests/integration/rbac.test.ts` (defines `mockTrainerASession`, `mockTrainerBSession` — these are unique, keep them; only replace the identical shared ones)
- `tests/integration/users.test.ts`
- `tests/integration/exercises.test.ts`
- `tests/integration/feedback.test.ts`
- `tests/integration/personal-records.test.ts`
- `tests/integration/auth-session.test.ts`

> Note for `rbac.test.ts`: It defines `mockTrainerASession` and `mockTrainerBSession` as distinct named trainers. Use `makeTrainerSession({ id: 'trainer-a-uuid', email: 'trainer.a@zerocento.it', ... })` for those, or keep them local — the goal is to eliminate duplicate identical fixtures, not to force every fixture into the shared file.

- [ ] **Step 4: Run all integration tests**

```bash
npx vitest run tests/integration/ 2>&1 | tail -30
```

Expected: same pass/fail ratio as before — no regressions introduced.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/fixtures.ts tests/integration/
git commit -m "test: extract shared session fixtures to tests/integration/fixtures.ts"
```

---

## Task 6: Add `DashboardLayout.tsx` to coverage config

**Files:**
- Modify: `vitest.config.ts`

`DashboardLayout.tsx` has a test file but is excluded from coverage reporting. Add it so coverage enforcement applies.

- [ ] **Step 1: Add `DashboardLayout.tsx` to the coverage `include` array in `vitest.config.ts`**

Find this block in `vitest.config.ts`:

```typescript
include: [
    'src/lib/calculations.ts',
    // ... other entries
    'src/components/ActionIconButton.tsx',
```

Add after `ActionIconButton.tsx`:

```typescript
'src/components/DashboardLayout.tsx',
```

- [ ] **Step 2: Run tests with coverage and verify DashboardLayout appears**

```bash
npm run test:unit -- --run --coverage 2>&1 | grep -E "DashboardLayout|All files|Uncovered"
```

Expected: `DashboardLayout.tsx` appears in coverage report.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: add DashboardLayout.tsx to coverage tracking"
```

---

## Task 7: Create project-scoped testing skill

**Files:**
- Create: `.claude/skills/zero-cento-testing/SKILL.md`

This skill codifies the patterns discovered during this review so future test additions stay consistent without needing to re-audit.

- [ ] **Step 1: Create the skill directory and file**

```bash
mkdir -p /mnt/c/dev-projects/zero-cento-project/.claude/skills/zero-cento-testing
```

- [ ] **Step 2: Write the skill**

Create `.claude/skills/zero-cento-testing/SKILL.md` with this exact content:

```markdown
---
name: zero-cento-testing
description: Use when writing, reviewing, or modifying any test in the zero-cento-project. Covers unit test patterns, integration test patterns, mock strategy, and coverage rules specific to this codebase.
---

# Zero Cento Testing Standards

## When this skill applies

Use for any new test file, additions to existing tests, or changes to `vitest.config.ts` or `tests/unit/setup.ts`.

---

## Test File Locations

| Type | Directory | Runner |
|------|-----------|--------|
| Unit (components, utils, hooks) | `tests/unit/` | Vitest + jsdom |
| Integration (API routes) | `tests/integration/` | Vitest + jsdom |
| E2E (full browser flows) | `tests/e2e/` | Playwright |

Run unit + integration: `npm run test:unit`
Run single file: `npx vitest run tests/unit/foo.test.ts`

---

## Unit Tests

### Import style

Always use static ESM imports — never `require()`:

```typescript
// CORRECT
import DashboardLayout from '@/components/DashboardLayout'

// WRONG — do not use
const DashboardLayout = require('@/components/DashboardLayout').default
```

### Mocks already in `tests/unit/setup.ts` — do NOT re-declare locally

- `next/navigation` (useRouter, useParams, usePathname, useSearchParams, redirect)
- `next/link`
- `@/lib/supabase-client` (createClient)
- `@/lib/supabase-server` (createServerClient)
- `@/lib/prisma` (prisma — basic CRUD operations)
- `react-i18next` (useTranslation returns identity function)

If a test needs `next/image`, mock it locally:

```typescript
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}))
```

### Component test anatomy

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders [X] when [condition]', () => {
        render(<MyComponent prop="value" />)
        expect(screen.getByText('Expected text')).toBeInTheDocument()
    })
})
```

### Querying elements — priority order

Use testing-library queries in this order (most to least preferred):

1. `getByRole` — semantic HTML + accessible name
2. `getByLabelText` — form fields
3. `getByText` — static visible text
4. `getByTestId` — last resort for elements without semantic role or text

Add `data-testid` to source components only when no semantic query is possible (e.g., navigation links that lack visible text).

### No flaky statistical tests

Never write tests whose pass/fail depends on probability:

```typescript
// WRONG — statistically flaky
expect(/abc|123/.test(generateSecurePassword())).toBe(false)

// CORRECT — deterministic
expect(generateSecurePassword()).toHaveLength(12)
expect(/[A-Z]/.test(generateSecurePassword())).toBe(true)
```

---

## Integration Tests (API Routes)

### Mock placement

All `vi.mock()` calls must appear before any imports of the mocked module:

```typescript
// CORRECT ORDER
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn(), requireRole: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))

import { GET } from '@/app/api/programs/route'
import { requireRole } from '@/lib/auth'
```

### Shared session fixtures

Import from `tests/integration/fixtures.ts` — do NOT redeclare:

```typescript
import { mockTrainerSession, mockAdminSession, mockTraineeSession, makeTrainerSession } from './fixtures'
```

Use `makeTrainerSession(overrides)` / `makeAdminSession(overrides)` for test-specific sessions.

### Request helpers

Build `NextRequest` from URL strings — no raw fetch mocks:

```typescript
const req = new NextRequest('http://localhost/api/programs')
const reqWithBody = new NextRequest('http://localhost/api/programs', {
    method: 'POST',
    body: JSON.stringify({ title: 'Test' }),
})
```

For route params (App Router):

```typescript
const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })
```

### What to test in integration tests

Integration tests cover API routes. Assert:
- HTTP status codes
- Response envelope shape (`{ data, meta }` for success, `{ error }` for failure)
- Auth enforcement: `requireRole` / `requireAuth` called with correct args
- Business logic: correct Prisma calls with correct args

Do NOT test implementation details (e.g., internal variable names).

---

## Coverage Rules

Coverage is enforced at **80%** for lines, functions, branches, and statements.

Files tracked for coverage are listed in `vitest.config.ts` under `coverage.include`.

When you add a component with a test file, also add the component to `coverage.include`.

---

## Node Version

This project requires Node 20+. A `.nvmrc` file is present at the repo root.

```bash
nvm use   # picks up .nvmrc automatically
node --version  # must show v20.x or higher
```

Tests will fail to start on Node 18 with `SyntaxError: styleText is not exported from node:util`.
```

- [ ] **Step 3: Verify skill is discovered**

```bash
ls /mnt/c/dev-projects/zero-cento-project/.claude/skills/zero-cento-testing/
```

Expected: `SKILL.md` is present.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/zero-cento-testing/
git commit -m "docs: add zero-cento-testing project skill"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test:unit -- --run 2>&1 | tail -30
```

Expected: all tests pass (or only pre-existing failures unrelated to this plan).

- [ ] **Step 2: Run with coverage**

```bash
npm run test:unit -- --run --coverage 2>&1 | tail -20
```

Expected: coverage thresholds pass (≥80% for all metrics).

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no new type errors.

- [ ] **Step 4: Commit changelog entry**

Open `implementation-docs/CHANGELOG.md` and add:

```markdown
## 2026-04-24 — Test Suite Review & Consistency

- Added `.nvmrc` (Node 20) to unblock Vitest 4.x startup error on Node 18
- Added `react-i18next` global mock to `tests/unit/setup.ts`
- Fixed `DashboardLayout.test.tsx`: removed duplicate mocks, switched to static imports, corrected back-button assertions using `data-testid`
- Removed flaky sequential-pattern test from `password-utils.test.ts`
- Extracted shared session fixtures to `tests/integration/fixtures.ts`; updated 8 integration test files to import from it
- Added `DashboardLayout.tsx` to coverage tracking in `vitest.config.ts`
- Created project-scoped skill `zero-cento-testing` at `.claude/skills/zero-cento-testing/SKILL.md`
```

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog entry for test suite review"
```
