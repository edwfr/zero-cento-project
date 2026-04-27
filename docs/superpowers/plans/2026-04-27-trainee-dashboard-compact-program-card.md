# Trainee Dashboard — Compact Active Program Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Active Program" card on `/trainee/dashboard` more compact, dropping the "View Full Program" CTA and condensing duration / progression / completion into an inline row above the progress bar.

**Architecture:** Pure client-component refactor inside `src/app/trainee/dashboard/_content.tsx`. The card keeps its container shell (white bg, left border accent) but loses the header CTA button and replaces three padded stat boxes with one inline meta row. The existing progress bar stays (slimmer height). No data-fetching, schema, or i18n key changes — all required keys (`duration`, `weeks`, `progression`, `workoutsProgress`, `completion`) already exist in `public/locales/{en,it}/trainee.json`. The translation key `trainee:dashboard.viewFullProgram` is still used by the "Next Workout" card (line ~217), so we do **not** delete it from the locale files.

**Tech Stack:** Next.js 15 App Router (RSC + client components), React 19, Tailwind CSS, react-i18next, lucide-react.

---

## File Structure

**Modified files:**
- `src/app/trainee/dashboard/_content.tsx` — only the JSX block currently at lines ~224-276 (the "Active Program Card") is rewritten. The unused `ClipboardList` import is removed if and only if no other JSX in this file still references it (the "Next Workout" card at line ~216 still uses it, so the import stays).

**No new files.** No locale changes. No API changes.

---

## Pre-Flight

### Task 0: Confirm baseline state

**Files:**
- Read: `src/app/trainee/dashboard/_content.tsx`
- Read: `public/locales/it/trainee.json`
- Read: `public/locales/en/trainee.json`

- [ ] **Step 1: Verify the active-program card markup matches the plan's starting point**

Run: `grep -n "Active Program Card" src/app/trainee/dashboard/_content.tsx`
Expected: one hit, around line 224.

- [ ] **Step 2: Verify the locale keys this plan relies on exist**

Run:
```bash
grep -nE '"(duration|progression|completion|weeks|workoutsProgress|trainerWith)"' public/locales/it/trainee.json
grep -nE '"(duration|progression|completion|weeks|workoutsProgress|trainerWith)"' public/locales/en/trainee.json
```
Expected (it): hits for `duration`, `weeks`, `progression`, `workoutsProgress`, `completion`, `trainerWith` inside the `dashboard` block (around lines 16-20).
Expected (en): same keys present.

If any key is missing, **stop** and report — do not invent translations.

- [ ] **Step 3: Confirm `ClipboardList` is still needed elsewhere in the file**

Run: `grep -n "ClipboardList" src/app/trainee/dashboard/_content.tsx`
Expected: at least two references — the `lucide-react` import line and the "Next Workout" card's `<ClipboardList className="w-4 h-4" />` usage. If both are present, leave the import alone in Task 1. If only the import remains after the active-program card edit, remove it in Task 1 Step 3.

---

## Task 1: Replace the Active Program Card markup

**Files:**
- Modify: `src/app/trainee/dashboard/_content.tsx` (block currently at ~lines 224-276)

- [ ] **Step 1: Apply the compact-card edit**

Replace the entire block starting at the `{/* Active Program Card */}` comment up to and including its closing `</div>` (the wrapping `bg-white ... mb-8` card div) with the markup below.

Current block to remove (verbatim):

```tsx
            {/* Active Program Card */}
            <div className="bg-white border border-gray-200 border-l-4 border-l-brand-primary rounded-lg shadow-md p-8 mb-8">
                <div className="flex flex-col items-start justify-between mb-6 gap-4 sm:flex-row">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary mb-2">
                            {t('navigation:navigation.activeProgram')}
                        </p>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{activeProgram.title}</h2>
                        <p className="text-gray-600">
                            {t('trainee:dashboard.trainerWith', {
                                firstName: activeProgram.trainer.firstName,
                                lastName: activeProgram.trainer.lastName,
                            })}
                        </p>
                    </div>
                    <Link
                        href="/trainee/programs/current"
                        className="inline-flex w-full items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors sm:w-auto"
                    >
                        <ClipboardList className="w-4 h-4" />
                        {t('trainee:dashboard.viewFullProgram')}
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.duration')}</p>
                        <p className="text-2xl font-bold text-brand-primary">
                            {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.progression')}</p>
                        <p className="text-2xl font-bold text-brand-primary">
                            {t('trainee:dashboard.workoutsProgress', {
                                completed: completedWorkouts,
                                total: totalWorkouts,
                            })}
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.completion')}</p>
                        <p className="text-2xl font-bold text-brand-primary">{progressPercent}%</p>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-brand-primary h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
```

Replacement block (verbatim — copy as-is):

```tsx
            {/* Active Program Card */}
            <div className="bg-white border border-gray-200 border-l-4 border-l-brand-primary rounded-lg shadow-md p-5 mb-8">
                <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary mb-1">
                        {t('navigation:navigation.activeProgram')}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{activeProgram.title}</h2>
                    <p className="text-sm text-gray-600">
                        {t('trainee:dashboard.trainerWith', {
                            firstName: activeProgram.trainer.firstName,
                            lastName: activeProgram.trainer.lastName,
                        })}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mb-2">
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.duration')}: </span>
                        <span className="font-semibold text-gray-900">
                            {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.progression')}: </span>
                        <span className="font-semibold text-gray-900">
                            {t('trainee:dashboard.workoutsProgress', {
                                completed: completedWorkouts,
                                total: totalWorkouts,
                            })}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.completion')}: </span>
                        <span className="font-semibold text-brand-primary">{progressPercent}%</span>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                        role="progressbar"
                        aria-valuenow={progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('trainee:dashboard.completion')}
                    />
                </div>
            </div>
```

Notes for the engineer:
- Container padding goes from `p-8` → `p-5`.
- Heading goes from `text-3xl` → `text-xl`; section label from `text-sm` → `text-xs`.
- The three stat boxes (`bg-gray-50 rounded-lg p-4 border ...`) collapse into one `flex flex-wrap` row with `gap-x-6 gap-y-1`, so they wrap gracefully on narrow viewports without re-introducing big card chrome.
- Progress bar slimmed `h-3` → `h-2` and gains `role="progressbar"` + ARIA attrs (we lose the implicit accessibility of the previous custom bar — adding it explicitly here matches the rest of the codebase, e.g. `src/components/ProgressBar.tsx`).
- The `Link` import stays because the "Next Workout" card and the no-active-program branch both still use it. Do **not** remove it.

- [ ] **Step 2: Verify `ClipboardList` import is still needed**

Run: `grep -n "ClipboardList" src/app/trainee/dashboard/_content.tsx`

Expected: two hits — the import on line 8 and the `<ClipboardList className="w-4 h-4" />` inside the "Next Workout" card (around line 216). If you only see the import, remove `ClipboardList` from the import list (Step 3). Otherwise skip Step 3.

- [ ] **Step 3 (conditional): Trim unused import**

Only run this step if Step 2 showed `ClipboardList` is referenced solely by the import line.

Edit the import on line 8 from:

```ts
import { Dumbbell, Trophy, BarChart2, User, ClipboardList, Play } from 'lucide-react'
```

to:

```ts
import { Dumbbell, Trophy, BarChart2, User, Play } from 'lucide-react'
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: exits 0, no new errors. Pre-existing errors elsewhere in the repo are out of scope — but the run must not introduce new ones in `src/app/trainee/dashboard/_content.tsx`. If new errors appear in this file, stop and fix them before continuing.

- [ ] **Step 5: Lint**

Run: `npm run lint -- --file src/app/trainee/dashboard/_content.tsx` (or `npm run lint` if the `--file` flag is unsupported by this repo's lint script — check `package.json` `scripts.lint` first; if it's a plain `next lint`, run `npm run lint` and visually filter for `src/app/trainee/dashboard/_content.tsx`).
Expected: no lint errors or warnings on the modified file. Unused-import warnings (notably `ClipboardList`) must be resolved per Step 3.

- [ ] **Step 6: Manual visual verification**

Run dev server: `npm run dev`

Then in a browser:
1. Sign in as a trainee with at least one **active** program (seed includes one — see `prisma/seed.ts`).
2. Navigate to `/trainee/dashboard`.
3. Verify the Active Program card:
   - Header: small uppercase `ACTIVE PROGRAM` (or Italian equivalent) label, program title in `text-xl`, trainer name beneath in `text-sm`.
   - **No** "View Full Program" / "Programma Completo" button on this card. (The "Next Workout" card above still has its own "View Full Program" button — that one stays.)
   - Single inline row showing `Duration: N weeks`, `Progression: X / Y workouts`, `Completion: Z%`. Row wraps to multiple lines on narrow screens (test by resizing the window to ~360px width).
   - A thin (h-2) progress bar fills to `Z%`.
4. Switch language to Italian (i18n switcher) and confirm translations render: `Durata`, `Progressione`, `Completamento`.
5. Sign in as a trainee **without** an active program (or temporarily set the seed user's program to draft) and confirm the no-active-program empty state still renders correctly — i.e. our edit did not affect the `if (!activeProgram)` branch.

If any of the above fails, stop and fix before committing.

- [ ] **Step 7: Update CHANGELOG**

Per `CLAUDE.md` Workflow Rules, append a brief entry to `implementation-docs/CHANGELOG.md` describing the change. Example line (adapt to the file's existing format — read the file first to match its style):

```
- ui(trainee/dashboard): compact active-program card, drop redundant "View Full Program" CTA and inline duration/progression/completion meta row above slimmer progress bar
```

- [ ] **Step 8: Commit**

```bash
git add src/app/trainee/dashboard/_content.tsx implementation-docs/CHANGELOG.md
git commit -m "ui(trainee/dashboard): compact active-program card

Drop the redundant 'View Full Program' CTA from the active-program
card (still present on the 'Next Workout' card above), collapse the
three stat tiles into a single inline meta row, and slim the progress
bar. No locale or API changes."
```

---

## Self-Review Notes

- **Spec coverage:**
  - "rimuovi da quella card Programma Completo" → CTA removed in Task 1 Step 1 (replacement block has no `<Link>` to `/trainee/programs/current`).
  - "mostra in maniera più compatta le altre info (durata, progressione e % di completamento con progress bar)" → three stat tiles → single `flex flex-wrap` meta row; progress bar retained but slimmed.
  - "dare solo visibilità dello stato di avanzamento" → CTAs removed, leaving only progress information.
- **No placeholders:** All replacement code is provided verbatim. No "implement appropriately" steps.
- **Type consistency:** No new types introduced. `progressPercent`, `completedWorkouts`, `totalWorkouts`, `activeProgram.durationWeeks`, `activeProgram.trainer.firstName`, `activeProgram.trainer.lastName` all already exist in scope (lines 171-178 of the current file).
- **Out-of-scope (do NOT do):**
  - Do not change the "Next Workout" card.
  - Do not change the no-active-program empty state.
  - Do not delete `viewFullProgram` from locale files (still used by the "Next Workout" card).
  - Do not refactor to use `ProgressBar` component — its built-in label row + `current / total` footer would duplicate the inline meta row above and lose the design.
