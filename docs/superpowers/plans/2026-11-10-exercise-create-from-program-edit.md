# Create Exercise from Program Editor Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** While editing a program (`/trainer/programs/[id]/edit`, Skeleton and Exercises
steps) the trainer opens a popup from a floating button, creates a new library exercise
with the same form as `/trainer/exercises/new`, and finds it right away in the exercise
dropdowns without leaving or reloading the page.

**Architecture:** The form body of `src/app/trainer/exercises/new/_content.tsx` moves
into a shared client component `ExerciseForm` that owns its state, loads muscle groups
and movement patterns, POSTs to `/api/exercises` and reports the result through
callbacks. The `/new` page keeps its header and redirect and renders `ExerciseForm`.
A thin `ExerciseQuickCreateModal` wraps `ExerciseForm` in a dialog. The program editor
gets a floating button that opens the modal and, on success, re-runs its existing
`fetchExerciseCatalog()`, which feeds every exercise dropdown. No API, schema or
migration change.

## Design

Behaviour agreed with the user:

- **Floating button** on the right side of the program editor, visible whenever the
  page is editable (`!readOnly`), so in both wizard steps (`structure` = Skeleton,
  `details` = Exercises). Hidden in read-only mode.
- **Position: `fixed top-24 right-6`** (planner's call). Bottom-right is taken by the
  toast stack (`ToastNotification`: `fixed bottom-4 right-4`), bottom-left by the drag
  trash zone, top-left by the Charts / RPE tables buttons. Same look as the Charts
  button (`h-14 w-14 rounded-full bg-brand-primary text-white shadow-lg z-40`), lucide
  `Plus` icon, `aria-label`/`title` = `editProgram.floatingNewExerciseButton`.
- **Popup** contains exactly the inputs of `/trainer/exercises/new`: name, notes /
  variants list, YouTube URL (optional), type radio, bodyweight-loaded checkbox,
  movement pattern select (required), muscle groups with coefficients (optional).
  Same validation and same POST body.
- **After create:** popup closes, success toast
  `editProgram.exerciseCreatedToast` ("Esercizio «{{name}}» aggiunto alla libreria"),
  catalog re-fetched → new exercise appears in every exercise dropdown of both steps.
- **Not auto-selected** in any row. The trainer picks it from the dropdown.
- **Closing the popup** (Cancel button, ✕, ESC) discards what was typed. Backdrop click
  does *not* close (planner's call: avoids losing a half-filled form by a stray click).
- `/trainer/exercises/new` behaves exactly as today (create → `router.refresh()` +
  redirect to `/trainer/exercises`; Cancel → `/trainer/exercises`).

Non-goals: unifying with the admin `ExerciseCreateModal`; editing exercises from the
program editor; auto-inserting the new exercise into a row.

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-frontend`,
  `zero-cento-testing`.
- **Do NOT reuse `src/components/ExerciseCreateModal.tsx`.** It looks like the obvious
  fit but it is the admin modal (used by `ExercisesTable` in `/admin/exercises`) and
  its fields diverged: it has `description` instead of notes/variants and makes the
  YouTube URL required. The user asked for the `/trainer/exercises/new` form. Leave the
  admin modal and its test untouched.
- **Line endings:** `src/app/trainer/exercises/new/_content.tsx` and
  `src/app/trainer/programs/[id]/edit/_content.tsx` are CRLF (commit `1656194` restored
  them after an accidental LF rewrite). Keep CRLF; check with `file <path>` and
  `git diff --stat` (a whole-file diff means you broke them). Create new files with LF
  like the other recent components.
- **Locale files** `public/locales/{it,en}/trainer.json` start with a UTF-8 BOM. Keep
  it: edit with the Edit tool, never rewrite the whole file through `JSON.stringify`.
- Loader pattern: submit uses `<Button isLoading loadingText>` as today; no raw
  `<button disabled={loading}>` for async actions.
- Keep the edit page change minimal: it is a 4k-line file. Add state, one callback, the
  button and the modal; do not refactor anything else.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit. One entry for the feature is fine: create it in Task 1 and extend
  it in later tasks.
- Commit on the current branch with conventional-commit messages. Do not push.

## Review Focus

1. **`/trainer/exercises/new` unchanged for the user** — same fields, same POST body,
   create redirects to `/trainer/exercises`, Cancel goes back. Pinned in Task 1.
2. **Modal POST body equals the page POST body** (`notes` from variants, empty
   variants dropped, `youtubeUrl` omitted when empty). Pinned in Task 1 (form) and
   Task 2 (modal).
3. **Dropdowns refresh** — after create the new exercise is in the Skeleton and
   Exercises autocompletes; no row changes value. Pinned in Task 3 (manual check).
4. **Failed catalog refresh does not empty the dropdowns** — `fetchExerciseCatalog`
   no longer resets the catalog to `[]` on error. Pinned in Task 3.
5. **Read-only programs** show no floating button. Pinned in Task 3.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/components/ExerciseForm.tsx` (new) | Shared create-exercise form: state, data loading, validation, POST | 1 |
| `src/app/trainer/exercises/new/_content.tsx` (modify) | Page header + `ExerciseForm` + redirect | 1 |
| `tests/unit/exercise-form.test.tsx` (new) | Form behaviour | 1 |
| `src/components/ExerciseQuickCreateModal.tsx` (new) | Dialog shell around `ExerciseForm` | 2 |
| `src/components/index.ts` (modify) | Barrel exports | 2 |
| `tests/unit/exercise-quick-create-modal.test.tsx` (new) | Modal behaviour | 2 |
| `src/app/trainer/programs/[id]/edit/_content.tsx` (modify) | Floating button, modal, catalog refresh | 3 |
| `public/locales/{it,en}/trainer.json` (modify) | New keys | 3 |

---

### Task 1: Extract `ExerciseForm` from the new-exercise page

**Model:** sonnet
**Depends on:** none
**Files:** `src/components/ExerciseForm.tsx` (new), `src/app/trainer/exercises/new/_content.tsx` (modify), `tests/unit/exercise-form.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/exercise-form.test.tsx`
**Done when:** `/trainer/exercises/new` renders through `ExerciseForm` and behaves as before; the form's tests pass.

- [x] **Step 1: tests** — `tests/unit/exercise-form.test.tsx`. Mock `fetch` the way
      `tests/unit/exercise-create-modal-bodyweight.test.tsx` does (GET
      `/api/muscle-groups`, `/api/movement-patterns` with `{ data: { items } }`; POST
      `/api/exercises` → `{ data: { exercise: { id: 'ex1', name: 'Trazioni' } } }`,
      status 201). Translation keys render as themselves.
  - loads data → movement pattern select defaults to the first pattern
  - name empty + submit → shows `exercises.nameRequired`, no POST
  - fill name, add two variants (`'A'`, `'  '`), submit → POST body
    `{ name, type: <DEFAULT_EXERCISE_TYPE>, isBodyweightLoaded: false, movementPatternId: 'mp1', muscleGroups: [], notes: ['A'] }`, no `youtubeUrl` key
  - YouTube URL filled → present in body
  - POST ok → `onSuccess` called once with `{ id: 'ex1', name: 'Trazioni' }`
  - POST 400 with an API error body → error message shown, `onSuccess` not called, submit button enabled again
  - click Cancel → `onCancel` called, no POST
- [x] **Step 2: implementation**

  ```ts
  export interface CreatedExercise { id: string; name: string }
  export interface ExerciseFormProps {
      onSuccess: (exercise: CreatedExercise) => void
      onCancel: () => void
  }
  export default function ExerciseForm(props: ExerciseFormProps): JSX.Element
  ```

  Move into `ExerciseForm` everything from `NewExerciseContent` from the state
  declarations through the closing `</form>`: state, `fetchData`, variant and muscle
  group handlers, `handleSubmit`, the error banner and the `<form>` (keep the
  `bg-white rounded-lg shadow-md p-6 space-y-6` classes on the form; the modal reuses
  them as-is). Changes while moving:
  - on POST success read `data.data.exercise` and call `onSuccess({ id, name })`;
    do not reset `loading` (the caller navigates or unmounts, as today)
  - the Cancel `<Link href="/trainer/exercises">` becomes a
    `<Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onCancel} disabled={loading}>`
    with the same label `exercises.cancel` (check `Button` variants in
    `src/components/Button.tsx`; pick the grey one)
  - `useTranslation(['trainer', 'common'])` so `t('common:common.loadingProgress')` keeps working
  - remove imports that become unused in either file

  `NewExerciseContent` keeps the outer `max-w-4xl` wrapper and the header and renders
  `<ExerciseForm onSuccess={() => { router.refresh(); router.push('/trainer/exercises') }} onCancel={() => router.push('/trainer/exercises')} />`.
  Keep the file CRLF.
- [x] **Step 3: run the test command and `npm run type-check`**; also
      `npx vitest run tests/unit/exercise-create-modal-bodyweight.test.tsx` (must stay green, untouched)
- [x] **Step 4: CHANGELOG entry and commit** — `refactor(exercises): extract ExerciseForm from new exercise page`

---

### Task 2: `ExerciseQuickCreateModal`

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/components/ExerciseQuickCreateModal.tsx` (new), `src/components/index.ts` (modify), `tests/unit/exercise-quick-create-modal.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/exercise-quick-create-modal.test.tsx`
**Done when:** the modal renders the form in an accessible dialog and reports created exercises.

Consumes from Task 1:
`ExerciseForm({ onSuccess: (e: { id: string; name: string }) => void, onCancel: () => void })`.

- [x] **Step 1: tests** — same fetch mock as Task 1.
  - renders `role="dialog"`, `aria-modal="true"`, labelled by the title `exercises.newExerciseTitle`
  - successful submit → `onCreated` called with `{ id: 'ex1', name: 'Trazioni' }`
  - form Cancel → `onClose` called
  - ✕ button (`aria-label` = `common:common.close`, check the key exists, otherwise reuse the one `ExerciseCreateModal` uses) → `onClose`
  - ESC keydown on document → `onClose`
  - click on backdrop → `onClose` NOT called
- [x] **Step 2: implementation**

  ```ts
  export interface ExerciseQuickCreateModalProps {
      onClose: () => void
      onCreated: (exercise: { id: string; name: string }) => void
  }
  export default function ExerciseQuickCreateModal(props: ExerciseQuickCreateModalProps): JSX.Element
  ```

  Rendered only while open (the parent mounts/unmounts it), so closing discards the
  form state. Shell: mirror `src/components/ExerciseCreateModal.tsx` (backdrop
  `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4`,
  dialog `role="dialog" aria-modal aria-labelledby`, ESC listener, focus trap,
  restore focus on unmount). Dialog panel `w-full max-w-2xl max-h-[90vh] overflow-y-auto`,
  header with title `exercises.newExerciseTitle` and an ✕ icon button (`lucide` `X`),
  body = `<ExerciseForm onSuccess={onCreated} onCancel={onClose} />`. No backdrop
  click handler. Export it and its props type from `src/components/index.ts` next to
  `ExerciseCreateModal`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(exercises): add ExerciseQuickCreateModal`

---

### Task 3: Floating button in the program editor

**Model:** sonnet
**Depends on:** Task 2
**Files:** `src/app/trainer/programs/[id]/edit/_content.tsx` (modify), `public/locales/it/trainer.json` (modify), `public/locales/en/trainer.json` (modify)
**Test command:** `npm run type-check && npm run lint`
**Done when:** on an editable program both steps show the button; creating an exercise closes the popup, shows the toast and the exercise is selectable in the dropdowns; read-only shows no button.

Consumes from Task 2:
`ExerciseQuickCreateModal({ onClose: () => void, onCreated: (e: { id: string; name: string }) => void })`.

No page-level unit test exists for this 4k-line component and none is added: behaviour
is covered by Task 1-2 tests plus the manual check in Step 3.

- [ ] **Step 1: i18n** — under `editProgram` in both locale files (BOM: use Edit):
  - `floatingNewExerciseButton`: it `"Nuovo esercizio"`, en `"New exercise"`
  - `exerciseCreatedToast`: it `"Esercizio «{{name}}» aggiunto alla libreria"`, en `"Exercise “{{name}}” added to the library"`
- [ ] **Step 2: implementation** in `EditProgramContent` (keep CRLF):
  - `const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false)`
  - in `fetchExerciseCatalog` (≈ line 605) remove the two `setExerciseCatalog([])`
    calls (the `!exercisesRes.ok` branch keeps its `return`; the `catch` becomes empty
    with a comment). Initial state is already `[]`, so first load is unchanged; a
    failed refresh now keeps the current list instead of emptying the dropdowns.
  - `handleExerciseCreated = useCallback((exercise) => { setIsExerciseModalOpen(false); showToast(t('editProgram.exerciseCreatedToast', { name: exercise.name }), 'success'); void fetchExerciseCatalog() }, [...])`
  - next to the Charts button (≈ line 4165), a `{!readOnly && (<button …>)}` with
    classes `fixed top-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-colors hover:bg-brand-primary-hover`,
    lucide `Plus` icon `h-6 w-6`, `aria-label` and `title` =
    `t('editProgram.floatingNewExerciseButton')`. It opens a modal, it is not an
    async action, so a plain `<button>` is correct here (same as the Charts button).
  - `{isExerciseModalOpen && <ExerciseQuickCreateModal onClose={() => setIsExerciseModalOpen(false)} onCreated={handleExerciseCreated} />}`
  - do not touch row state: the new exercise must not be selected anywhere
- [ ] **Step 3: run the test command, `npm run test:unit`, then check manually** with
      `npm run dev` on a draft program: button visible in Skeleton and Exercises steps,
      top-right, not covering the step header; create an exercise → popup closes,
      toast bottom-right, exercise found in a Skeleton row autocomplete and in an
      Exercises row autocomplete; ESC/✕/Cancel discard; open a read-only program →
      no button. Report what was checked.
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): create library exercise from program editor`
