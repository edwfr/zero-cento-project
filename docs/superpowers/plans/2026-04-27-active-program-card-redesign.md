# Active Program Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the "Programma Attivo" card on `/trainee/dashboard` so it visually matches the "Prossimo Allenamento" card: `rounded-2xl` container (no left border), a centered `%` completion hero with sub-label, progress bar below the hero, and a compact secondary row showing workout counter and program title + duration. The trainer name is removed. No backend or data-fetching changes.

**Architecture:** Pure JSX rewrite in `src/app/trainee/dashboard/_content.tsx` (lines 248–303). One new i18n key (`dashboard.completedLabel`) added to both locale files. All other required data (`progressPercent`, `completedWorkouts`, `totalWorkouts`, `activeProgram.title`, `activeProgram.durationWeeks`) is already in scope. No new components.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, react-i18next, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-27-active-program-card-redesign.md`

---

## File Structure

**Modified files:**
- `src/app/trainee/dashboard/_content.tsx` — rewrite the Active Program Card JSX block (lines 248–303). No other changes to this file.
- `public/locales/it/trainee.json` — add `dashboard.completedLabel` key after `"completion"`.
- `public/locales/en/trainee.json` — add `dashboard.completedLabel` key after `"completion"`.
- `implementation-docs/CHANGELOG.md` — mandatory log entry (per CLAUDE.md workflow rule).

**Created:** None.  
**Tests:** No unit tests required — the modified file is not in `vitest.config.ts` coverage `include`. Verification is visual (`npm run dev`) plus `npm run type-check` and `npm run lint`.

---

## Task 1: Add new i18n key

**Files:**
- Modify: `public/locales/it/trainee.json`
- Modify: `public/locales/en/trainee.json`

**Why:** The hero sub-label "completato" / "completed" has no existing key. `history.completed` is semantically wrong (it refers to program status). A dedicated `dashboard.completedLabel` key is required.

- [ ] **Step 1: Add key to Italian locale**

In `public/locales/it/trainee.json`, inside the `dashboard` object, insert **after** the `"completion"` line and **before** `"nextWorkout"`:

```json
"completedLabel": "completato",
```

- [ ] **Step 2: Add key to English locale**

In `public/locales/en/trainee.json`, inside the `dashboard` object, insert **after** the `"completion"` line and **before** `"nextWorkout"`:

```json
"completedLabel": "completed",
```

- [ ] **Step 3: Verify keys exist**

Run:
```bash
grep -n "completedLabel" public/locales/it/trainee.json public/locales/en/trainee.json
```
Expected: two hits, one per file, inside the `dashboard` block.

---

## Task 2: Rewrite the Active Program Card JSX

**Files:**
- Modify: `src/app/trainee/dashboard/_content.tsx` (lines 248–303)

**Why:** Replaces the current text-heavy, left-bordered card with a centered `%` hero layout matching the visual grammar of the "Prossimo Allenamento" card above it.

- [ ] **Step 1: Confirm the current block boundaries**

Run:
```bash
grep -n "Active Program Card\|Quick Actions" src/app/trainee/dashboard/_content.tsx
```
Expected: `Active Program Card` comment near line 248, `Quick Actions` comment near line 305. The card's outermost `<div>` opens at line 249 and its matching closing `</div>` is at line 303.

- [ ] **Step 2: Replace the Active Program Card block**

Replace everything from the `{/* Active Program Card */}` comment (line 248) through the card's closing `</div>` (line 303) with the following:

```tsx
{/* Active Program Card */}
<div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8 mb-8">
    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary mb-6">
        {t('navigation:navigation.activeProgram')}
    </p>

    <div className="flex flex-col items-center">
        <span className="text-6xl sm:text-7xl font-black leading-none text-brand-primary">
            {progressPercent}%
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-gray-500 mt-1">
            {t('trainee:dashboard.completedLabel')}
        </span>
    </div>

    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mt-4">
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

    <p className="text-sm text-gray-500 text-center mt-2">
        {t('trainee:dashboard.workoutsProgress', {
            completed: completedWorkouts,
            total: totalWorkouts,
        })}
    </p>
    <p className="text-sm text-gray-600 text-center mt-1">
        {activeProgram.title} · {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
    </p>

    <div className="mt-6">
        <Link
            href="/trainee/programs/current"
            className="inline-flex w-full items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
        >
            <ClipboardList className="w-4 h-4" />
            {t('trainee:dashboard.viewFullProgram')}
        </Link>
    </div>
</div>
```

**Key changes vs. current markup:**
- Container: removed `border-l-4 border-l-brand-primary rounded-lg`, added `rounded-2xl`
- Section label: `text-xs mb-1` → `text-sm mb-6`; `<div className="mb-3">` wrapper removed
- `<h2>` program title (prominent): **removed**
- Trainer paragraph: **removed**
- Inline stats row (duration / progression / completion divs): **removed**
- Hero `%` block: **added** — `text-6xl sm:text-7xl font-black leading-none text-brand-primary`
- Sub-label "completato": **added** — `text-xs uppercase tracking-[0.12em] text-gray-500 mt-1`
- Progress bar wrapper margin: `mb-4` → `mt-4` (now comes after hero, not after stats)
- Workout counter paragraph: **added** — `text-sm text-gray-500 text-center mt-2`
- Title + duration paragraph: **added** — `text-sm text-gray-600 text-center mt-1`
- CTA `<div>` margin: `mt-2` → `mt-6`
- CTA link and inner content: **unchanged**

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: exits 0, no errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

---

## Task 3: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Prepend a new entry at the top of `implementation-docs/CHANGELOG.md`:

```markdown
### [27 Aprile 2026] — Active Program Card Redesign

**Task checklist:** —  
**File modificati:** `src/app/trainee/dashboard/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`  
**Note:** Redesigned the "Programma Attivo" card on the trainee dashboard to align with the visual grammar of the "Prossimo Allenamento" card. Container changed to `rounded-2xl` (no left border). Added centered `%` completion hero (text-6xl/7xl font-black). Trainer name removed. Workout counter and program title+duration collapsed into secondary rows below the progress bar. New i18n key `dashboard.completedLabel` added to both locale files.
```

---

## Verification

- [ ] `npm run dev` → open `/trainee/dashboard` with an account that has an active program
- [ ] Card shows: no left orange border, `rounded-2xl` corners, centered `%` hero in brand-primary, "completato" sub-label, full-width progress bar, workout counter row, title + duration row, CTA link
- [ ] Card visually matches the `rounded-2xl` / label style of the "Prossimo Allenamento" card above it
- [ ] Trainer name is NOT displayed anywhere in the card
- [ ] Switch locale to EN: verify "completed" sub-label renders
- [ ] `npm run type-check` → exits 0
- [ ] `npm run lint` → exits 0
