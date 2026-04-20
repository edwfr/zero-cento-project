# Sentry ErrorBoundary Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `Sentry.captureException` inside `ErrorBoundary.componentDidCatch` so client-side React tree crashes are captured and sent to Sentry.

**Architecture:** Add a single `Sentry.captureException` call in the existing `componentDidCatch` lifecycle, passing `errorInfo.componentStack` as context. No new files needed. One unit test added to verify the call.

**Tech Stack:** `@sentry/nextjs` ^10.49.0, Vitest + React Testing Library, jsdom

---

### Task 1: Write the failing test

**Files:**
- Create: `tests/unit/components/ErrorBoundary.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

// Mock Sentry before importing component
vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}))

// Mock i18n
vi.mock('@/lib/i18n/client', () => ({
    default: {
        t: (key: string) => key,
    },
}))

// Mock Button
vi.mock('@/components/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
        React.createElement('button', { onClick }, children),
}))

import * as Sentry from '@sentry/nextjs'
import ErrorBoundary from '@/components/ErrorBoundary'

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error('test render error')
    return React.createElement('div', null, 'ok')
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // suppress console.error noise from React error boundary internals
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('calls Sentry.captureException with the error and componentStack when a child throws', () => {
        render(
            React.createElement(
                ErrorBoundary,
                null,
                React.createElement(ThrowingChild, { shouldThrow: true })
            )
        )

        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        const [capturedError, capturedHint] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(capturedError).toBeInstanceOf(Error)
        expect(capturedError.message).toBe('test render error')
        expect(capturedHint).toMatchObject({
            contexts: {
                react: {
                    componentStack: expect.any(String),
                },
            },
        })
    })

    it('does not call Sentry.captureException when no error occurs', () => {
        render(
            React.createElement(
                ErrorBoundary,
                null,
                React.createElement(ThrowingChild, { shouldThrow: false })
            )
        )

        expect(Sentry.captureException).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd zero-cento-project && npx vitest run tests/unit/components/ErrorBoundary.test.tsx
```

Expected: FAIL — `Sentry.captureException` not called (0 calls).

---

### Task 2: Implement the fix

**Files:**
- Modify: `src/components/ErrorBoundary.tsx:89-94`

- [ ] **Step 3: Replace `componentDidCatch` body**

Replace lines 89–94 in `src/components/ErrorBoundary.tsx`:

```tsx
// BEFORE
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // TODO: Log to error reporting service (Sentry, LogRocket, etc.)
    // Example: logErrorToService(error, errorInfo)
}
```

```tsx
// AFTER — add import at top of file (after existing imports):
import * as Sentry from '@sentry/nextjs'

// Updated method:
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
        contexts: {
            react: {
                componentStack: errorInfo.componentStack,
            },
        },
    })
}
```

Full diff to apply:

1. Add `import * as Sentry from '@sentry/nextjs'` after line 5 (`import { Button } from '@/components/Button'`).

2. Replace `componentDidCatch` body (lines 89–94):

```tsx
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        Sentry.captureException(error, {
            contexts: {
                react: {
                    componentStack: errorInfo.componentStack,
                },
            },
        })
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd zero-cento-project && npx vitest run tests/unit/components/ErrorBoundary.test.tsx
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Run typecheck to confirm no TS errors**

```bash
cd zero-cento-project && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd zero-cento-project && git add src/components/ErrorBoundary.tsx tests/unit/components/ErrorBoundary.test.tsx
git commit -m "feat(observability): wire Sentry.captureException in ErrorBoundary

Replaces the TODO placeholder with a real Sentry.captureException call
in componentDidCatch, passing componentStack as React context.
Adds unit tests covering both the error and no-error paths."
```

---

### Task 3: Update CHANGELOG.md and pre-deployment-review.md

**Files:**
- Modify: `implementation-docs/CHANGELOG.md:24`
- Modify: `implementation-docs/pre-deployment-review.md:33-35,269`

- [ ] **Step 7: Add entry to `implementation-docs/CHANGELOG.md`**

Insert this block at line 24 (immediately after `## Storico`, before the existing `[20 Aprile 2026]` entry):

```markdown
### [20 Aprile 2026] — Sentry.captureException in ErrorBoundary (Osservabilità — B1 completato)

**Task checklist:** B1 pendente (pre-deployment-review.md)  
**File modificati:** `src/components/ErrorBoundary.tsx`  
**File creati:** `tests/unit/components/ErrorBoundary.test.tsx`  
**Note:** Wired `Sentry.captureException` in `componentDidCatch`, passando `errorInfo.componentStack` come context React. Sostituisce il TODO placeholder e il `console.error` con una vera chiamata Sentry. Aggiunti 2 unit test (Vitest + RTL): verifica che `captureException` venga chiamato con l'errore corretto e il `componentStack`, e che non venga chiamato quando nessun figlio lancia errori. B1 completamente risolto.

---

```

- [ ] **Step 8: Update `implementation-docs/pre-deployment-review.md`**

In section **§2 B1** (lines 33–35), remove the "Pendente" bullet and mark B1 fully complete:

```markdown
### ✅ B1. Sentry inizializzato — COMPLETATO (20 aprile 2026)
- **Stato**: `src/instrumentation.ts` e `src/instrumentation-client.ts` creati. `sentry.server.config.ts` e `sentry.edge.config.ts` aggiornati con DSN/env/sample rate da variabili d'ambiente, `enableLogs: true`, `sendDefaultPii: false`, `beforeSend` con scrubbing cookie. `onRequestError = Sentry.captureRequestError` attivo per errori server-side. `Sentry.captureException` attivo in `ErrorBoundary.componentDidCatch` con `componentStack` context.
```

In section **§6 Settimana -1** (line 269), update the checklist note:

```markdown
- [x] **B1** ~~Creare `src/instrumentation.ts` + wire Sentry in `ErrorBoundary`~~ → completato (20/04): `instrumentation.ts` + `instrumentation-client.ts` creati; `Sentry.captureException` attivo in `ErrorBoundary`
```

- [ ] **Step 9: Commit**

```bash
cd zero-cento-project && git add CHANGELOG.md implementation-docs/pre-deployment-review.md
git commit -m "docs: update CHANGELOG and pre-deployment-review for Sentry ErrorBoundary

Marks B1 fully complete in pre-deployment-review.md.
Creates CHANGELOG.md with initial Unreleased entry."
```
