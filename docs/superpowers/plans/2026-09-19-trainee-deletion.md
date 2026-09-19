# Trainee Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers (for their own trainees) and admins permanently delete a trainee: all programs, workouts, feedback, personal records and the Supabase Auth account, after an explicit confirmation.

**Architecture:** Fix the existing `DELETE /api/users/[id]` handler. For a trainee target it first deletes the Supabase Auth user (a "not found" error counts as success, so retries are idempotent), then runs a Prisma `$transaction` that explicitly deletes programs, feedback, personal records and the user row. The trainer trainees list gets a delete icon button that opens the existing `ConfirmationModal`. The admin `UserDeleteModal` already calls the same endpoint; only its warning copy changes.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase JS admin client (`createAdminClient`), react-i18next, Vitest + Testing Library.

**Spec:** Design approved in chat on 2026-09-19. There is no spec file (bounded change). The design is summarized below:
- Permissions: a trainer may delete only trainees linked via `TrainerTrainee`. An admin may delete any non-admin. A trainee may delete nobody.
- Order: Supabase `auth.admin.deleteUser(id)` runs first. Any error other than 404 returns a 500 and touches nothing. A 404 is ignored. The DB transaction runs second.
- DB: explicit `deleteMany`s inside `prisma.$transaction`. No schema migration and no new `onDelete: Cascade`.
- Non-trainee targets (trainer deleted by admin) keep the current behavior: plain `prisma.user.delete`, no Supabase call. This is out of scope.
- Confirmation: a simple `ConfirmationModal` (variant `danger`) with a multiline message listing what is deleted.

## Global Constraints

- API responses use only `apiSuccess` / `apiError` from `src/lib/api-response.ts`. Errors carry an i18n `key` resolvable in `public/locales/{en,it}/errors.json`.
- Click-triggered async UI uses the `isLoading` prop. Never write a raw `<button disabled={loading}>`.
- Every user-facing string goes in `public/locales/en/*.json` **and** `public/locales/it/*.json`. Some locale files start with a UTF-8 BOM, so edit them with the Edit tool (string insertion). Never re-serialize them with a JSON library.
- After the change, add an entry at the top of `## [Unreleased]` in `implementation-docs/CHANGELOG.md`. Write it in Italian and follow the existing `### [DD Mese YYYY] — Title` / `**File modificati:**` / `**Note:**` format.
- Why the Supabase deletion happens first: if the DB deletion ran first and Supabase then failed, an orphan auth account would block re-inviting the same email. With Supabase first, a DB failure leaves a trainee who can no longer log in, and a retry completes the deletion because the Supabase 404 is ignored.

## Background the implementer needs

- `prisma/schema.prisma`: `TrainingProgram.trainee`, `ExerciseFeedback.trainee` and `PersonalRecord.trainee` have **no** `onDelete: Cascade`. As a result the current `prisma.user.delete` fails with an FK violation for any trainee that has data. `TrainerTrainee` does cascade. Deleting a `TrainingProgram` cascades Week → Workout → WorkoutExercise → ExerciseFeedback → SetPerformed, plus WorkoutSkeleton.
- The Prisma `User.id` equals the Supabase Auth user id (see `POST /api/users`, which creates the Prisma user with `id: authData.user.id`).
- Current bug: the DELETE handler uses `requireAuth()` and only checks ownership when `role === 'trainer'`, so a **trainee session can delete other non-admin users**. Task 1 replaces this with `requireRole(['admin', 'trainer'])`.
- `requireRole` throws a `Response` on failure. The handler's `catch` already does `if (error instanceof Response) return error`.
- Test i18n mock (`tests/unit/setup.ts`): `t(key)` returns `key` unchanged. For example, the cancel button of `ConfirmationModal` is labelled `common.cancel`, and the confirm button's aria-label is `` `${confirmText} - ${title}` ``.

## File map

| File | Change |
|---|---|
| `src/app/api/users/[id]/route.ts` | DELETE: `requireRole`, Supabase deletion, transactional cleanup for trainees |
| `tests/integration/users-delete.test.ts` | **New**: DELETE handler tests |
| `public/locales/{en,it}/errors.json` | New key `user.deleteFailed` |
| `src/app/trainer/trainees/_content.tsx` | Delete button + `ConfirmationModal` |
| `tests/unit/trainer-trainees-content.test.tsx` | Delete flow tests |
| `public/locales/{en,it}/trainer.json` | `athletes.delete*` keys |
| `public/locales/{en,it}/admin.json` | Reworded `users.deleteWarning` |
| `implementation-docs/CHANGELOG.md` | Entry |

---

### Task 1: Fix `DELETE /api/users/[id]` for trainees

**Files:**
- Modify: `src/app/api/users/[id]/route.ts` (imports at lines 1-7, `DELETE` at lines 141-194)
- Modify: `public/locales/en/errors.json`, `public/locales/it/errors.json` (the `"user"` object)
- Create: `tests/integration/users-delete.test.ts`

**Interfaces:**
- Consumes: `requireRole(allowedRoles: Role | Role[]): Promise<AuthSession>` from `@/lib/auth`; `createAdminClient()` from `@/lib/supabase-server`.
- Produces: `DELETE /api/users/:id` behaves as follows:
  - `200 { data: { message, messageKey: 'user.deletedSuccess' } }` on success
  - `403` for a trainee caller, for a trainer who does not own the target, and for an admin target
  - `404` when the user does not exist
  - `500` with key `user.deleteFailed` when the Supabase deletion fails
  - `500` with key `internal.default` on a DB failure

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/users-delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminSession, mockTrainerSession } from './fixtures'

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }))

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: vi.fn(), delete: vi.fn() },
        trainerTrainee: { findFirst: vi.fn() },
        trainingProgram: { deleteMany: vi.fn() },
        exerciseFeedback: { deleteMany: vi.fn() },
        personalRecord: { deleteMany: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: vi.fn(() => ({
        auth: { admin: { deleteUser: deleteUserMock } },
    })),
}))

vi.mock('@/lib/sync-user-metadata', () => ({ syncUserMetadata: vi.fn() }))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from '@/app/api/users/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const trainee = {
    id: 'trainee-uuid-9',
    email: 'luca.bianchi@example.com',
    firstName: 'Luca',
    lastName: 'Bianchi',
    role: 'trainee',
    isActive: true,
    createdAt: new Date('2026-01-01'),
}

function callDelete(id = trainee.id) {
    return DELETE(
        new NextRequest(`http://localhost:3000/api/users/${id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id }) }
    )
}

describe('DELETE /api/users/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(trainee as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([] as any)
        deleteUserMock.mockResolvedValue({ data: {}, error: null })
    })

    it('restricts the endpoint to admin and trainer roles', async () => {
        await callDelete()
        expect(requireRole).toHaveBeenCalledWith(['admin', 'trainer'])
    })

    it('rejects a trainee caller without deleting anything', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 })
        )

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('admin deletes a trainee: auth account first, then all trainee data in one transaction', async () => {
        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(deleteUserMock).toHaveBeenCalledWith(trainee.id)
        expect(prisma.trainingProgram.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.exerciseFeedback.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.personalRecord.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(deleteUserMock.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]
        )
    })

    it('trainer deletes own trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'tt-1' } as any)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: trainee.id },
        })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('trainer cannot delete a trainee they do not own', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('cannot delete an admin', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...trainee, role: 'admin' } as any)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const res = await callDelete()

        expect(res.status).toBe(404)
        expect(deleteUserMock).not.toHaveBeenCalled()
    })

    it('aborts without touching the DB when the Supabase deletion fails', async () => {
        deleteUserMock.mockResolvedValue({ data: null, error: { status: 500, message: 'boom' } })

        const res = await callDelete()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('user.deleteFailed')
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('proceeds when the Supabase user is already gone (idempotent retry)', async () => {
        deleteUserMock.mockResolvedValue({ data: null, error: { status: 404, message: 'User not found' } })

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 500 when the DB transaction fails', async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))

        const res = await callDelete()

        expect(res.status).toBe(500)
    })

    it('keeps plain delete for non-trainee targets (no Supabase call, no transaction)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...trainee, role: 'trainer' } as any)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/integration/users-delete.test.ts`
Expected: FAIL. The current handler calls `requireAuth` instead of `requireRole`, and it never calls `deleteUserMock` or `$transaction`.

- [ ] **Step 3: Implement**

In `src/app/api/users/[id]/route.ts`, change the imports:

```ts
import { requireAuth, requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-server'
```

(Keep `requireAuth`, because GET and PUT still use it.)

Replace the whole `DELETE` function (JSDoc included) with:

```ts
/**
 * DELETE /api/users/[id]
 * Delete user (physical delete with cleanup).
 * Trainees: Supabase Auth account is removed first, then all trainee data in one transaction.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Permission check
        if (session.user.role === 'trainer') {
            // Trainers can only delete their own trainees
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        // Cannot delete admin users
        if (existingUser.role === 'admin') {
            return apiError('FORBIDDEN', 'Cannot delete admin users', 403, undefined, 'user.cannotDeleteAdmin')
        }

        if (existingUser.role === 'trainee') {
            // Auth account first: on failure nothing is touched. A 404 means it is already
            // gone (e.g. a previous attempt failed on the DB step), so the retry can complete.
            const { error: authError } = await createAdminClient().auth.admin.deleteUser(id)
            if (authError && authError.status !== 404) {
                logger.error({ error: authError, userId: id }, 'Failed to delete Supabase auth user')
                return apiError('INTERNAL_ERROR', 'Failed to delete user', 500, undefined, 'user.deleteFailed')
            }

            // Trainee relations have no onDelete: Cascade. Deleting programs cascades
            // weeks → workouts → workoutExercises → feedbacks → setsPerformed and skeletons.
            await prisma.$transaction([
                prisma.trainingProgram.deleteMany({ where: { traineeId: id } }),
                prisma.exerciseFeedback.deleteMany({ where: { traineeId: id } }),
                prisma.personalRecord.deleteMany({ where: { traineeId: id } }),
                prisma.user.delete({ where: { id } }),
            ])
        } else {
            await prisma.user.delete({
                where: { id },
            })
        }

        logger.info({ userId: id, role: existingUser.role }, 'User deleted')

        return apiSuccess({
            message: 'User deleted successfully',
            messageKey: 'user.deletedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error deleting user')
        return apiError('INTERNAL_ERROR', 'Failed to delete user', 500, undefined, 'internal.default')
    }
}
```

In `public/locales/it/errors.json`, inside `"user"` after the `"deletedSuccess"` line, add:

```json
        "deleteFailed": "Eliminazione utente non riuscita, riprova",
```

In `public/locales/en/errors.json`, at the same place:

```json
        "deleteFailed": "Failed to delete user, please try again",
```

(Use the Edit tool. Keep the commas valid.)

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/integration/users-delete.test.ts tests/integration/rbac.test.ts tests/integration/api-contracts.test.ts tests/integration/users.test.ts`
Expected: all PASS.

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/users/[id]/route.ts tests/integration/users-delete.test.ts public/locales/en/errors.json public/locales/it/errors.json
git commit -m "fix(api): delete trainee data and Supabase auth account on user DELETE"
```

---

### Task 2: Delete action on the trainer trainees list

**Files:**
- Modify: `src/app/trainer/trainees/_content.tsx`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json` (the `"athletes"` object, after the `"statusUpdateError"` line)
- Test: `tests/unit/trainer-trainees-content.test.tsx`

**Interfaces:**
- Consumes: `DELETE /api/users/:id` from Task 1 (returns 200 or `{ error: { key } }`). `ConfirmationModal` default export from `@/components/ConfirmationModal`, with props `isOpen, onClose, onConfirm, title, message, confirmText?, variant?, isLoading?`.
- Produces: i18n keys `athletes.delete`, `athletes.deleteTitle`, `athletes.deleteConfirmMessage` (`{{name}}` interpolation), `athletes.deleteSuccess` (`{{name}}`), `athletes.deleteError`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/trainer-trainees-content.test.tsx`, replace the `global.fetch = vi.fn(async (input: RequestInfo | URL) => {` mock in `beforeEach` so that it also handles DELETE:

```ts
        global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url.startsWith('/api/users?')) {
                return {
                    ok: true,
                    json: async () => buildUsersResponse(url),
                } as Response
            }

            if (url.includes('/api/users/') && (url.endsWith('/activate') || url.endsWith('/deactivate'))) {
                return {
                    ok: true,
                    json: async () => ({ data: { success: true } }),
                } as Response
            }

            if (init?.method === 'DELETE' && url.startsWith('/api/users/')) {
                return {
                    ok: true,
                    json: async () => ({ data: { messageKey: 'user.deletedSuccess' } }),
                } as Response
            }

            return {
                ok: false,
                json: async () => ({ error: { message: 'Unexpected request' } }),
            } as Response
        }) as unknown as typeof fetch
```

Then add these tests at the end of the `describe` block:

```ts
    it('asks for confirmation before deleting a trainee and does not call the API on cancel', async () => {
        render(<TrainerTraineesContent />)

        const deleteButtons = await screen.findAllByRole('button', { name: 'athletes.delete' })
        fireEvent.click(deleteButtons[0])

        expect(screen.getByText('athletes.deleteTitle')).toBeInTheDocument()
        expect(screen.getByText('athletes.deleteConfirmMessage')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

        await waitFor(() => {
            expect(screen.queryByText('athletes.deleteTitle')).not.toBeInTheDocument()
        })
        const deleteCalls = vi.mocked(global.fetch).mock.calls.filter(([, init]) => init?.method === 'DELETE')
        expect(deleteCalls).toHaveLength(0)
    })

    it('deletes the trainee after confirmation and reloads the list', async () => {
        render(<TrainerTraineesContent />)

        const deleteButtons = await screen.findAllByRole('button', { name: 'athletes.delete' })
        fireEvent.click(deleteButtons[0])

        const fetchMock = vi.mocked(global.fetch)
        const listCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/users?')).length

        fireEvent.click(screen.getByRole('button', { name: 'common:common.delete - athletes.deleteTitle' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/users/trainee-1', { method: 'DELETE' })
        })
        await waitFor(() => {
            const listCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/users?')).length
            expect(listCallsAfter).toBeGreaterThan(listCallsBefore)
        })
        await waitFor(() => {
            expect(screen.queryByText('athletes.deleteTitle')).not.toBeInTheDocument()
        })
    })
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/unit/trainer-trainees-content.test.tsx`
Expected: the 2 new tests FAIL (no button named `athletes.delete`). The existing tests PASS.

- [ ] **Step 3: Implement the UI**

In `src/app/trainer/trainees/_content.tsx`:

Add the import after the `Input` import:

```ts
import ConfirmationModal from '@/components/ConfirmationModal'
```

Add state after the `statusCounts` state:

```ts
    const [traineeToDelete, setTraineeToDelete] = useState<Trainee | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
```

Add the handler right after `handleToggleStatus`:

```ts
    const handleConfirmDelete = async () => {
        if (!traineeToDelete) return
        const name = `${traineeToDelete.firstName} ${traineeToDelete.lastName}`

        setIsDeleting(true)
        try {
            const res = await fetch(`/api/users/${traineeToDelete.id}`, { method: 'DELETE' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('athletes.deleteError'), t))
            }

            setTraineeToDelete(null)
            showToast(t('athletes.deleteSuccess', { name }), 'success')
            await fetchTrainees(currentPage)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
        } finally {
            setIsDeleting(false)
        }
    }
```

(`fetchTrainees` already steps back one page when the current page becomes empty.)

Inside `<InlineActions>`, after the activate/deactivate `ActionIconButton`, add:

```tsx
                                                <ActionIconButton
                                                    variant="delete"
                                                    label={t('athletes.delete')}
                                                    onClick={() => setTraineeToDelete(trainee)}
                                                />
```

Just before the final closing `</div>` of the component's returned tree (after the table/empty-state conditional, inside `max-w-7xl`), add:

```tsx
                <ConfirmationModal
                    isOpen={traineeToDelete !== null}
                    onClose={() => {
                        if (!isDeleting) setTraineeToDelete(null)
                    }}
                    onConfirm={handleConfirmDelete}
                    title={t('athletes.deleteTitle')}
                    message={t('athletes.deleteConfirmMessage', {
                        name: traineeToDelete ? `${traineeToDelete.firstName} ${traineeToDelete.lastName}` : '',
                    })}
                    confirmText={t('common:common.delete')}
                    variant="danger"
                    isLoading={isDeleting}
                />
```

- [ ] **Step 4: Add the i18n keys**

In `public/locales/it/trainer.json`, after `"statusUpdateError": "Errore modifica status",` in `"athletes"`:

```json
        "delete": "Elimina",
        "deleteTitle": "Elimina atleta",
        "deleteConfirmMessage": "Vuoi eliminare definitivamente {{name}}?\nVerranno cancellati schede, workout, feedback, massimali e account di accesso.\nQuesta operazione è irreversibile.",
        "deleteSuccess": "{{name}} eliminato",
        "deleteError": "Errore nell'eliminazione dell'atleta",
```

In `public/locales/en/trainer.json`, after `"statusUpdateError": "Error updating status",`:

```json
        "delete": "Delete",
        "deleteTitle": "Delete athlete",
        "deleteConfirmMessage": "Permanently delete {{name}}?\nPrograms, workouts, feedback, personal records and the login account will be removed.\nThis cannot be undone.",
        "deleteSuccess": "{{name}} deleted",
        "deleteError": "Error deleting athlete",
```

(`ConfirmationModal` renders the message with `whitespace-pre-line`, so `\n` shows as a line break.)

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run tests/unit/trainer-trainees-content.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Lint + type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/trainer/trainees/_content.tsx tests/unit/trainer-trainees-content.test.tsx public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "feat(trainer): delete trainee from trainees list with confirmation"
```

---

### Task 3: Admin warning copy, CHANGELOG, full verification

**Files:**
- Modify: `public/locales/it/admin.json:55`, `public/locales/en/admin.json:55` (`users.deleteWarning`)
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: Tasks 1-2 are complete.
- Produces: nothing new.

- [ ] **Step 1: Reword the admin warning**

`UserDeleteModal` renders `{confirmDelete} {deleteWarning}.`, so leave out the trailing period.

`public/locales/it/admin.json`:

```json
        "deleteWarning": "Questa azione è permanente: per gli atleti verranno cancellati schede, workout, feedback, massimali e account di accesso",
```

`public/locales/en/admin.json`:

```json
        "deleteWarning": "This action is permanent: for athletes, programs, workouts, feedback, personal records and the login account will be deleted",
```

- [ ] **Step 2: Add the CHANGELOG entry**

In `implementation-docs/CHANGELOG.md`, insert directly under the `### Changed` line of `## [Unreleased]`:

```markdown
### [19 Settembre 2026] — Eliminazione atleta da trainer e admin

**File modificati:** `src/app/api/users/[id]/route.ts`, `src/app/trainer/trainees/_content.tsx`, `public/locales/en/errors.json`, `public/locales/it/errors.json`, `public/locales/en/trainer.json`, `public/locales/it/trainer.json`, `public/locales/en/admin.json`, `public/locales/it/admin.json`, `tests/integration/users-delete.test.ts`, `tests/unit/trainer-trainees-content.test.tsx`, `implementation-docs/CHANGELOG.md`
**Note:** Il DELETE `/api/users/[id]` falliva per vincolo FK su qualsiasi atleta con dati, perché `TrainingProgram.trainee`, `ExerciseFeedback.trainee` e `PersonalRecord.trainee` non hanno `onDelete: Cascade`, e non rimuoveva l'account Supabase Auth. Inoltre usava `requireAuth()` controllando la ownership solo per i trainer, quindi un trainee poteva eliminare altri utenti non admin: ora usa `requireRole(['admin', 'trainer'])`. Per target trainee l'handler elimina prima l'utente Supabase (un 404 è trattato come successo, così un retry dopo un errore DB completa l'operazione; qualsiasi altro errore restituisce 500 `user.deleteFailed` senza toccare il DB), poi in una `prisma.$transaction` cancella programmi (cascade su weeks → workouts → workoutExercises → feedback → setsPerformed e skeletons), feedback, massimali e l'utente (cascade su `TrainerTrainee`). Delete esplicite invece di cascade in schema: nessuna migrazione e nessuna cancellazione a cascata accidentale da altri percorsi. Target non trainee invariati. In `/trainer/trainees` aggiunto il bottone elimina che apre `ConfirmationModal` (danger) con l'elenco dei dati cancellati; la modale admin esistente (`UserDeleteModal`) beneficia del fix e ha un avviso aggiornato.
```

- [ ] **Step 3: Full verification**

Run: `npm run test:unit && npm run lint && npm run type-check`
Expected: all green. If anything fails, fix it before committing. Do not skip.

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/admin.json public/locales/it/admin.json implementation-docs/CHANGELOG.md
git commit -m "docs: changelog and admin copy for trainee deletion"
```
