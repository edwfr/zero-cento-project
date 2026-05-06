# WeekType Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `normal | test | deload` WeekType enum with `tecnica | ipertrofia | volume | forza_generale | intensificazione | picco | test | deload`, adding colour-coded badges for each type throughout the app.

**Architecture:** Prisma enum is recreated via a raw SQL migration (PostgreSQL doesn't support dropping enum values — must rename/drop). All downstream TypeScript literal types use the Prisma-generated `WeekType`. Badge and Banner components drive from a config map instead of if-chains. i18n keys follow existing patterns in the six locale files.

**Tech Stack:** Prisma ORM, PostgreSQL, Zod, Tailwind CSS, Lucide React, react-i18next, Next.js 15 App Router

---

## New Enum Values

| Prisma value | Display (IT) | Tailwind key | Color | Icon |
|---|---|---|---|---|
| `tecnica` | Tecnica | `tecnica` | violet `#7c3aed` | `Target` |
| `ipertrofia` | Ipertrofia | `ipertrofia` | pink `#db2777` | `TrendingUp` |
| `volume` | Volume | `volume` | blue `#2563eb` | `BarChart3` |
| `forza_generale` | Forza Generale | `forza-generale` | orange `#ea580c` | `Dumbbell` |
| `intensificazione` | Intensificazione | `intensificazione` | amber `#d97706` | `Zap` |
| `picco` | Picco | `picco` | gold `#ca8a04` | `Trophy` |
| `test` | Test | (existing) | red `#ef4444` | `Flame` |
| `deload` | Deload | (existing) | green `#10b981` | `Wind` |

**Removed:** `normal` — existing `normal` rows in DB migrated to `volume`
**New default:** `volume`

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Replace WeekType enum, change default `normal` → `volume` |
| `prisma/migrations/20260506000000_expand_week_types/migration.sql` | Create — recreate enum, migrate data |
| `src/schemas/week.ts` | Update Zod enum |
| `tailwind.config.ts` | Add 6 new `week.*` color sets |
| `src/components/WeekTypeBadge.tsx` | Rewrite — config map, 8 types |
| `src/components/WeekTypeBanner.tsx` | Rewrite — config map, 8 types |
| `public/locales/en/trainer.json` | Add 6 new weekTypes keys, rename `standard` → removed |
| `public/locales/it/trainer.json` | Same |
| `public/locales/en/trainee.json` | Update `weekType.*` + `currentProgram.weekType*` |
| `public/locales/it/trainee.json` | Same |
| `public/locales/en/components.json` | Update `weekTypeBanner.badges.*` |
| `public/locales/it/components.json` | Same |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | Update type annotations, `weekTypeBadgeLabels`, selector UI |
| `src/app/trainer/programs/[id]/publish/_content.tsx` | Update type annotation |
| `src/app/trainer/programs/[id]/review/_content.tsx` | Update type annotation + label map |
| `src/app/trainee/dashboard/_content.tsx` | Update type + remove `!== 'normal'` guard + labels |
| `src/app/trainee/programs/_components/ProgramDetailContent.tsx` | Update type + label map |
| `src/app/trainee/workouts/[id]/_content.tsx` | Update type + labels |
| `src/lib/program-pdf-export.ts` | Update local WeekType type |
| `src/lib/trainee-program-data.ts` | Update type cast |
| `src/app/components-showcase/page.tsx` | Add 6 new WeekTypeBanner examples |
| `tests/unit/schemas.test.ts` | Replace `normal` tests, add new type tests |
| `tests/integration/program-progress.test.ts` | `weekType: 'normal'` → `'volume'` |
| `tests/integration/program-detail.test.ts` | Same |
| `tests/integration/programs.test.ts` | Same |
| `tests/integration/trainee-workout-detail.test.ts` | Same |
| `tests/unit/trainee-workout-focus.test.tsx` | Same |

---

## Task 1: Write Failing Unit Tests

**Files:**
- Modify: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Open and review existing weekConfig schema tests**

Run: `npx vitest run tests/unit/schemas.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: all pass (baseline)

- [ ] **Step 2: Add failing tests for new enum values**

Find the `weekConfig` describe block (around line 418). Replace the existing `weekType` tests with:

```typescript
describe('weekConfigSchema', () => {
    it('accepts tecnica', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'tecnica', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts ipertrofia', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'ipertrofia', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts volume', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'volume', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts forza_generale', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'forza_generale', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts intensificazione', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'intensificazione', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts picco', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'picco', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts test', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'test', feedbackRequested: true })
        expect(result.success).toBe(true)
    })
    it('accepts deload', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'deload', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('rejects normal (removed)', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'normal', feedbackRequested: false })
        expect(result.success).toBe(false)
    })
    it('rejects invalid value', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'invalid', feedbackRequested: false })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toBe('validation.invalidWeekType')
    })
    it('defaults feedbackRequested to false', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'volume' })
        expect(result.success).toBe(true)
        expect(result.data?.feedbackRequested).toBe(false)
    })
    it('accepts partial update with only weekType', () => {
        const result = updateWeekSchema.safeParse({ weekType: 'deload' })
        expect(result.success).toBe(true)
    })
})
```

- [ ] **Step 3: Run to confirm failures**

Run: `npx vitest run tests/unit/schemas.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: multiple FAIL — "tecnica", "ipertrofia", etc. fail; "normal" test fails because schema still accepts it

---

## Task 2: Update Zod Schema

**Files:**
- Modify: `src/schemas/week.ts`

- [ ] **Step 1: Replace the weekType enum using `z.nativeEnum` from Prisma**

`@prisma/client` is the single source of truth for `WeekType`. Use `z.nativeEnum` so the schema stays in sync automatically when Prisma is regenerated.

```typescript
import { WeekType } from '@prisma/client'
import { z } from 'zod'

export const weekConfigSchema = z.object({
    weekType: z.nativeEnum(WeekType, {
        errorMap: () => ({ message: 'validation.invalidWeekType' }),
    }),
    feedbackRequested: z.boolean().default(false),
})

export const updateWeekSchema = weekConfigSchema.partial()

export type WeekConfigInput = z.infer<typeof weekConfigSchema>
export type UpdateWeekInput = z.infer<typeof updateWeekSchema>
```

- [ ] **Step 2: Run schema tests to confirm they now pass**

Run: `npx vitest run tests/unit/schemas.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/schemas/week.ts tests/unit/schemas.test.ts
git commit -m "feat: expand WeekType Zod enum — add 6 new types, remove normal"
```

---

## Task 3: Prisma Schema + DB Migration

**Files:**
- Modify: `prisma/schema.prisma` lines 36-40 (enum), line ~227 (Week model default)
- Create: `prisma/migrations/20260506000000_expand_week_types/migration.sql`

- [ ] **Step 1: Update Prisma schema enum**

Replace lines 36-40 in `prisma/schema.prisma`:

```prisma
enum WeekType {
  tecnica          // Focus sulla tecnica degli esercizi
  ipertrofia       // Settimana ipertrofia
  volume           // Alto volume di allenamento
  forza_generale   // Sviluppo della forza generale
  intensificazione // Alta intensità e carichi elevati
  picco            // Settimana pre-gara di picco
  test             // Settimana di valutazione/test massimali
  deload           // Settimana di scarico/recupero
}
```

- [ ] **Step 2: Update Week model default**

Find the `weekType` field in the `Week` model (around line 227). Change default from `normal` to `volume`:

```prisma
weekType    WeekType  @default(volume)
```

- [ ] **Step 3: Create migration directory and SQL file**

Create directory: `prisma/migrations/20260506000000_expand_week_types/`
Create file: `prisma/migrations/20260506000000_expand_week_types/migration.sql`

```sql
-- Migration: Expand WeekType enum
-- Adds 6 new training phase types; removes 'normal'; migrates normal → volume

-- Step 1: Create new enum with all target values
CREATE TYPE "WeekType_new" AS ENUM (
  'tecnica',
  'ipertrofia',
  'volume',
  'forza_generale',
  'intensificazione',
  'picco',
  'test',
  'deload'
);

-- Step 2: Drop the column default (it references the old enum type)
ALTER TABLE "weeks" ALTER COLUMN "weekType" DROP DEFAULT;

-- Step 3: Cast column to new enum, migrating 'normal' → 'volume'
ALTER TABLE "weeks"
  ALTER COLUMN "weekType" TYPE "WeekType_new"
  USING (
    CASE "weekType"::text
      WHEN 'normal' THEN 'volume'
      ELSE "weekType"::text
    END
  )::"WeekType_new";

-- Step 4: Drop old enum
DROP TYPE "WeekType";

-- Step 5: Rename new enum to original name
ALTER TYPE "WeekType_new" RENAME TO "WeekType";

-- Step 6: Restore column default
ALTER TABLE "weeks" ALTER COLUMN "weekType" SET DEFAULT 'volume';
```

- [ ] **Step 4: Regenerate Prisma client**

Run: `npm run prisma:generate`
Expected: Client generated successfully with new WeekType enum values

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260506000000_expand_week_types/
git commit -m "feat: expand WeekType Prisma enum and add DB migration"
```

---

## Task 4: Tailwind Color Tokens

**Files:**
- Modify: `tailwind.config.ts` lines 18-29

- [ ] **Step 1: Add 6 new week color sets**

Replace the `week` block in `tailwind.config.ts`:

```typescript
week: {
    tecnica: {
        light: '#ede9fe',
        DEFAULT: '#7c3aed',
        dark: '#6d28d9',
    },
    ipertrofia: {
        light: '#fce7f3',
        DEFAULT: '#db2777',
        dark: '#be185d',
    },
    volume: {
        light: '#dbeafe',
        DEFAULT: '#2563eb',
        dark: '#1d4ed8',
    },
    'forza-generale': {
        light: '#ffedd5',
        DEFAULT: '#ea580c',
        dark: '#c2410c',
    },
    intensificazione: {
        light: '#fef3c7',
        DEFAULT: '#d97706',
        dark: '#b45309',
    },
    picco: {
        light: '#fefce8',
        DEFAULT: '#ca8a04',
        dark: '#a16207',
    },
    test: {
        light: '#fecaca',
        DEFAULT: '#ef4444',
        dark: '#dc2626',
    },
    deload: {
        light: '#6ee7b7',
        DEFAULT: '#10b981',
        dark: '#059669',
    },
},
```

> Note: `forza_generale` uses key `'forza-generale'` (hyphen) for valid CSS class names.
> CSS classes become: `bg-week-forza-generale`, `border-week-forza-generale`, `text-week-forza-generale-dark`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run type-check 2>&1 | tail -20`
Expected: No errors (colors are pure config — TypeScript won't fail on new entries)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add Tailwind color tokens for 6 new WeekType variants"
```

---

## Task 5: WeekTypeBadge Component

**Files:**
- Modify: `src/components/WeekTypeBadge.tsx`

- [ ] **Step 1: Rewrite the component with config map**

Import `WeekType` from `@prisma/client` — do NOT redefine the union locally.

```typescript
import { WeekType } from '@prisma/client'
import { BarChart3, Dumbbell, Flame, Target, Trophy, TrendingUp, Wind, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

type WeekTypeBadgeLabels = Record<WeekType, ReactNode>

interface WeekTypeBadgeProps {
    weekType: WeekType
    labels?: Partial<WeekTypeBadgeLabels>
}

const ICON_CLASS = 'h-3.5 w-3.5 shrink-0'

const CONFIG: Record<WeekType, { className: string; icon: ReactNode; defaultLabel: string }> = {
    tecnica: {
        className: 'border-week-tecnica bg-week-tecnica text-white',
        icon: <Target className={ICON_CLASS} />,
        defaultLabel: 'Tecnica',
    },
    ipertrofia: {
        className: 'border-week-ipertrofia bg-week-ipertrofia text-white',
        icon: <TrendingUp className={ICON_CLASS} />,
        defaultLabel: 'Ipertrofia',
    },
    volume: {
        className: 'border-week-volume bg-week-volume text-white',
        icon: <BarChart3 className={ICON_CLASS} />,
        defaultLabel: 'Volume',
    },
    forza_generale: {
        className: 'border-week-forza-generale bg-week-forza-generale text-white',
        icon: <Dumbbell className={ICON_CLASS} />,
        defaultLabel: 'Forza Generale',
    },
    intensificazione: {
        className: 'border-week-intensificazione bg-week-intensificazione text-white',
        icon: <Zap className={ICON_CLASS} />,
        defaultLabel: 'Intensificazione',
    },
    picco: {
        className: 'border-week-picco bg-week-picco text-white',
        icon: <Trophy className={ICON_CLASS} />,
        defaultLabel: 'Picco',
    },
    test: {
        className: 'border-week-test bg-week-test text-white',
        icon: <Flame className={ICON_CLASS} />,
        defaultLabel: 'Test',
    },
    deload: {
        className: 'border-week-deload bg-week-deload text-white',
        icon: <Wind className={ICON_CLASS} />,
        defaultLabel: 'Deload',
    },
}

export default function WeekTypeBadge({ weekType, labels }: WeekTypeBadgeProps) {
    const baseClassName = 'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold'
    const { className, icon, defaultLabel } = CONFIG[weekType]
    const label = labels?.[weekType] ?? defaultLabel

    return (
        <span className={`${baseClassName} ${className}`}>
            {icon}
            <span>{label}</span>
        </span>
    )
}
```

- [ ] **Step 2: Check type-check**

Run: `npm run type-check 2>&1 | grep -E "WeekTypeBadge|error" | head -20`
Expected: No errors from WeekTypeBadge.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/WeekTypeBadge.tsx
git commit -m "feat: rewrite WeekTypeBadge to support 8 week types with config map"
```

---

## Task 6: WeekTypeBanner Component

**Files:**
- Modify: `src/components/WeekTypeBanner.tsx`

- [ ] **Step 1: Rewrite with config map for all 8 types**

```typescript
'use client'

import { WeekType } from '@prisma/client'
import { BarChart3, Dumbbell, Flame, Target, Trophy, TrendingUp, Wind, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WeekTypeBadge from './WeekTypeBadge'

interface WeekTypeBannerProps {
    weekType: WeekType
    weekNumber: number
    className?: string
}

export default function WeekTypeBanner({ weekType, weekNumber, className = '' }: WeekTypeBannerProps) {
    const { t } = useTranslation(['trainer', 'components'])

    const configs: Record<WeekType, {
        bg: string
        border: string
        text: string
        icon: React.ReactNode
        label: string
        description: string
    }> = {
        tecnica: {
            bg: 'bg-week-tecnica-light',
            border: 'border-week-tecnica',
            text: 'text-week-tecnica-dark',
            icon: <Target className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.tecnica'),
            description: t('trainer:weekTypes.tecnicaDesc'),
        },
        ipertrofia: {
            bg: 'bg-week-ipertrofia-light',
            border: 'border-week-ipertrofia',
            text: 'text-week-ipertrofia-dark',
            icon: <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.ipertrofia'),
            description: t('trainer:weekTypes.ipertrofiaDesc'),
        },
        volume: {
            bg: 'bg-week-volume-light',
            border: 'border-week-volume',
            text: 'text-week-volume-dark',
            icon: <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.volume'),
            description: t('trainer:weekTypes.volumeDesc'),
        },
        forza_generale: {
            bg: 'bg-week-forza-generale-light',
            border: 'border-week-forza-generale',
            text: 'text-week-forza-generale-dark',
            icon: <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.forzaGenerale'),
            description: t('trainer:weekTypes.forzaGeneraleDesc'),
        },
        intensificazione: {
            bg: 'bg-week-intensificazione-light',
            border: 'border-week-intensificazione',
            text: 'text-week-intensificazione-dark',
            icon: <Zap className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.intensificazione'),
            description: t('trainer:weekTypes.intensificazioneDesc'),
        },
        picco: {
            bg: 'bg-week-picco-light',
            border: 'border-week-picco',
            text: 'text-week-picco-dark',
            icon: <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.picco'),
            description: t('trainer:weekTypes.piccoDesc'),
        },
        test: {
            bg: 'bg-week-test-light',
            border: 'border-week-test',
            text: 'text-week-test-dark',
            icon: <Flame className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.test'),
            description: t('trainer:weekTypes.testDesc'),
        },
        deload: {
            bg: 'bg-week-deload-light',
            border: 'border-week-deload',
            text: 'text-week-deload-dark',
            icon: <Wind className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.deload'),
            description: t('trainer:weekTypes.deloadDesc'),
        },
    }

    const config = configs[weekType]

    return (
        <div
            className={`
                rounded-lg border-2 p-3 sm:p-4
                ${config.bg} ${config.border} ${config.text}
                ${className}
            `}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    <span className="mt-0.5 flex-shrink-0 sm:mt-0" aria-label={config.label}>
                        {config.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm leading-tight font-bold sm:text-base">
                            {config.label} - {t('components:weekTypeBanner.week')} {weekNumber}
                        </h3>
                        <p className="mt-0.5 text-xs opacity-90 sm:text-sm">{config.description}</p>
                    </div>
                </div>
                <div className="self-start sm:self-center">
                    <WeekTypeBadge
                        weekType={weekType}
                        labels={{
                            tecnica: t('components:weekTypeBanner.badges.tecnica'),
                            ipertrofia: t('components:weekTypeBanner.badges.ipertrofia'),
                            volume: t('components:weekTypeBanner.badges.volume'),
                            forza_generale: t('components:weekTypeBanner.badges.forzaGenerale'),
                            intensificazione: t('components:weekTypeBanner.badges.intensificazione'),
                            picco: t('components:weekTypeBanner.badges.picco'),
                            test: t('components:weekTypeBanner.badges.test'),
                            deload: t('components:weekTypeBanner.badges.deload'),
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check 2>&1 | grep -E "WeekTypeBanner|error" | head -20`
Expected: No errors from WeekTypeBanner.tsx (i18n keys don't error at compile time)

- [ ] **Step 3: Commit**

```bash
git add src/components/WeekTypeBanner.tsx
git commit -m "feat: rewrite WeekTypeBanner to support 8 week types"
```

---

## Task 7: i18n Locale Files

**Files:**
- Modify: `public/locales/en/trainer.json`
- Modify: `public/locales/it/trainer.json`
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`
- Modify: `public/locales/en/components.json`
- Modify: `public/locales/it/components.json`

### 7a — trainer.json `weekTypes` section

- [ ] **Step 1: Update English `weekTypes` in `public/locales/en/trainer.json`**

Replace the `"weekTypes"` block:

```json
"weekTypes": {
    "tecnica": "Technique Week",
    "tecnicaDesc": "Focus on exercise technique and form",
    "ipertrofia": "Hypertrophy Week",
    "ipertrofiaDesc": "Muscle growth oriented training",
    "volume": "Volume Week",
    "volumeDesc": "High training volume",
    "forzaGenerale": "General Strength Week",
    "forzaGeneraleDesc": "General strength development",
    "intensificazione": "Intensification Week",
    "intensificazioneDesc": "High intensity training with heavy loads",
    "picco": "Peak Week",
    "piccoDesc": "Pre-competition peak performance week",
    "test": "Test Week",
    "testDesc": "Personal record evaluation and testing",
    "deload": "Deload Week",
    "deloadDesc": "Recovery and regeneration"
},
```

- [ ] **Step 2: Update Italian `weekTypes` in `public/locales/it/trainer.json`**

Replace the `"weekTypes"` block:

```json
"weekTypes": {
    "tecnica": "Settimana Tecnica",
    "tecnicaDesc": "Focus sulla tecnica degli esercizi",
    "ipertrofia": "Settimana Ipertrofia",
    "ipertrofiaDesc": "Allenamento orientato alla crescita muscolare",
    "volume": "Settimana di Volume",
    "volumeDesc": "Alto volume di allenamento",
    "forzaGenerale": "Settimana Forza Generale",
    "forzaGeneraleDesc": "Sviluppo della forza generale",
    "intensificazione": "Settimana di Intensificazione",
    "intensificazioneDesc": "Alta intensità e carichi elevati",
    "picco": "Settimana di Picco",
    "piccoDesc": "Settimana pre-gara ad alta intensità",
    "test": "Settimana Test",
    "testDesc": "Valutazione massimali e test",
    "deload": "Settimana Scarico",
    "deloadDesc": "Recupero e rigenerazione"
},
```

### 7b — trainer.json `editProgram` and `reviewProgram` weekType keys

- [ ] **Step 3: Update English `editProgram` weekType keys**

In `public/locales/en/trainer.json`, find the `editProgram` section and replace the three `weekType*` keys with all eight:

```json
"weekTypeTecnica": "Technique",
"weekTypeIpertrofia": "Hypertrophy",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "General Strength",
"weekTypeIntensificazione": "Intensification",
"weekTypePicco": "Peak",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

- [ ] **Step 4: Update Italian `editProgram` weekType keys in `public/locales/it/trainer.json`**

```json
"weekTypeTecnica": "Tecnica",
"weekTypeIpertrofia": "Ipertrofia",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "Forza Generale",
"weekTypeIntensificazione": "Intensificazione",
"weekTypePicco": "Picco",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

- [ ] **Step 5: Update English `reviewProgram` weekType keys**

Same keys in the `reviewProgram` section of `public/locales/en/trainer.json`:

```json
"weekTypeTecnica": "Technique",
"weekTypeIpertrofia": "Hypertrophy",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "General Strength",
"weekTypeIntensificazione": "Intensification",
"weekTypePicco": "Peak",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

- [ ] **Step 6: Update Italian `reviewProgram` weekType keys**

Same pattern in `public/locales/it/trainer.json` `reviewProgram`:

```json
"weekTypeTecnica": "Tecnica",
"weekTypeIpertrofia": "Ipertrofia",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "Forza Generale",
"weekTypeIntensificazione": "Intensificazione",
"weekTypePicco": "Picco",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

### 7c — trainee.json `weekType` and `currentProgram` sections

- [ ] **Step 7: Update English trainee.json**

In `public/locales/en/trainee.json`, replace `"weekType"` block:

```json
"weekType": {
    "tecnica": "Technique",
    "ipertrofia": "Hypertrophy",
    "volume": "Volume",
    "forza_generale": "General Strength",
    "intensificazione": "Intensification",
    "picco": "Peak",
    "test": "Test",
    "deload": "Deload"
},
```

In the `currentProgram` section, replace the three `weekType*` keys:

```json
"weekTypeTecnica": "Technique",
"weekTypeIpertrofia": "Hypertrophy",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "General Strength",
"weekTypeIntensificazione": "Intensification",
"weekTypePicco": "Peak",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

- [ ] **Step 8: Update Italian trainee.json**

In `public/locales/it/trainee.json`, replace `"weekType"` block:

```json
"weekType": {
    "tecnica": "Tecnica",
    "ipertrofia": "Ipertrofia",
    "volume": "Volume",
    "forza_generale": "Forza Generale",
    "intensificazione": "Intensificazione",
    "picco": "Picco",
    "test": "Test",
    "deload": "Deload"
},
```

In `currentProgram`, replace the three `weekType*` keys:

```json
"weekTypeTecnica": "Tecnica",
"weekTypeIpertrofia": "Ipertrofia",
"weekTypeVolume": "Volume",
"weekTypeForzaGenerale": "Forza Generale",
"weekTypeIntensificazione": "Intensificazione",
"weekTypePicco": "Picco",
"weekTypeTest": "Test",
"weekTypeDeload": "Deload",
```

> Remove `"weekTypeStandard"` key.

### 7d — components.json `weekTypeBanner.badges` section

- [ ] **Step 9: Update English components.json**

In `public/locales/en/components.json`, replace `"weekTypeBanner.badges"`:

```json
"weekTypeBanner": {
    "week": "Week",
    "badges": {
        "tecnica": "Technique",
        "ipertrofia": "Hypertrophy",
        "volume": "Volume",
        "forzaGenerale": "General Strength",
        "intensificazione": "Intensification",
        "picco": "Peak",
        "test": "Test",
        "deload": "Deload"
    }
},
```

- [ ] **Step 10: Update Italian components.json**

In `public/locales/it/components.json`, replace `"weekTypeBanner.badges"`:

```json
"weekTypeBanner": {
    "week": "Settimana",
    "badges": {
        "tecnica": "Tecnica",
        "ipertrofia": "Ipertrofia",
        "volume": "Volume",
        "forzaGenerale": "Forza Generale",
        "intensificazione": "Intensificazione",
        "picco": "Picco",
        "test": "Test",
        "deload": "Deload"
    }
},
```

- [ ] **Step 11: Commit**

```bash
git add public/locales/
git commit -m "feat: update i18n locale files for 8 WeekType values"
```

---

## Task 8: Trainer Edit Page

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

- [ ] **Step 1: Import `WeekType` from `@prisma/client` and use it everywhere in this file**

Add to imports at the top of the file (check if `@prisma/client` is already imported):

```typescript
import { WeekType } from '@prisma/client'
```

Then replace both occurrences of the inline literal union:
- Line ~120 local data interface: `weekType: 'normal' | 'test' | 'deload'` → `weekType: WeekType`
- Line ~1256 `handleWeekTypeChange` parameter: `newType: 'normal' | 'test' | 'deload'` → `newType: WeekType`

Do NOT redefine the union — use the import.

- [ ] **Step 2: Update `weekTypeBadgeLabels` useMemo (lines ~1097-1104)**

Replace the existing useMemo:

```typescript
const weekTypeBadgeLabels = useMemo(
    () => ({
        tecnica: t('editProgram.weekTypeTecnica'),
        ipertrofia: t('editProgram.weekTypeIpertrofia'),
        volume: t('editProgram.weekTypeVolume'),
        forza_generale: t('editProgram.weekTypeForzaGenerale'),
        intensificazione: t('editProgram.weekTypeIntensificazione'),
        picco: t('editProgram.weekTypePicco'),
        test: t('editProgram.weekTypeTest'),
        deload: t('editProgram.weekTypeDeload'),
    }),
    [t]
)
```

- [ ] **Step 3: Replace week type selector buttons (lines ~2990-3033)**

Replace the `<>` fragment containing the three `<button>` elements with all eight. Use `flex-wrap gap-2` (already on parent `div`):

```tsx
<>
    {(
        [
            'tecnica',
            'ipertrofia',
            'volume',
            'forza_generale',
            'intensificazione',
            'picco',
            'test',
            'deload',
        ] as const
    ).map((type) => (
        <button
            key={type}
            type="button"
            onClick={() => handleWeekTypeChange(week.id, type)}
            disabled={saving}
            className={`rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                week.weekType === type
                    ? 'ring-2 ring-offset-1 ring-current opacity-100'
                    : 'opacity-70 hover:opacity-100'
            }`}
        >
            <WeekTypeBadge weekType={type} labels={weekTypeBadgeLabels} />
        </button>
    ))}
</>
```

> The `ring-current` uses the badge's own color via `currentColor`. Each badge already has a solid background so this is visible. If you want per-type ring colours, replace `ring-current` with explicit ring classes per type using the same CONFIG pattern — but `ring-current` is simpler and sufficient.

- [ ] **Step 4: Type-check the edit file**

Run: `npm run type-check 2>&1 | grep "_content.tsx" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "feat: update edit page WeekType selector for 8 training phases"
```

---

## Task 9: Trainer Review + Publish Pages

**Files:**
- Modify: `src/app/trainer/programs/[id]/review/_content.tsx`
- Modify: `src/app/trainer/programs/[id]/publish/_content.tsx`

### 9a — Review page

- [ ] **Step 1: Import `WeekType` from `@prisma/client`; replace inline literal union**

Add/verify import: `import { WeekType } from '@prisma/client'`

Find: `weekType: 'normal' | 'test' | 'deload'` (line ~66)
Replace: `weekType: WeekType`

- [ ] **Step 2: Replace `weekTypeLabel` function (lines ~514-524)**

Replace the if-chain with a lookup map. Use the imported `WeekType` for the parameter type — no inline union:

```typescript
weekTypeLabel: (weekType: WeekType) => {
    const labels: Record<WeekType, string> = {
        tecnica: t('reviewProgram.weekTypeTecnica'),
        ipertrofia: t('reviewProgram.weekTypeIpertrofia'),
        volume: t('reviewProgram.weekTypeVolume'),
        forza_generale: t('reviewProgram.weekTypeForzaGenerale'),
        intensificazione: t('reviewProgram.weekTypeIntensificazione'),
        picco: t('reviewProgram.weekTypePicco'),
        test: t('reviewProgram.weekTypeTest'),
        deload: t('reviewProgram.weekTypeDeload'),
    }
    return labels[weekType] ?? weekType
},
```

- [ ] **Step 3: Update WeekTypeBadge labels prop (lines ~877-885)**

Replace the `labels` prop on `<WeekTypeBadge>` in the review table:

```tsx
<WeekTypeBadge
    weekType={week.weekType}
    labels={{
        tecnica: t('reviewProgram.weekTypeTecnica'),
        ipertrofia: t('reviewProgram.weekTypeIpertrofia'),
        volume: t('reviewProgram.weekTypeVolume'),
        forza_generale: t('reviewProgram.weekTypeForzaGenerale'),
        intensificazione: t('reviewProgram.weekTypeIntensificazione'),
        picco: t('reviewProgram.weekTypePicco'),
        test: t('reviewProgram.weekTypeTest'),
        deload: t('reviewProgram.weekTypeDeload'),
    }}
/>
```

### 9b — Publish page

- [ ] **Step 4: Import `WeekType` from `@prisma/client`; replace inline literal union**

Add/verify import: `import { WeekType } from '@prisma/client'`

Find: `weekType: 'normal' | 'test' | 'deload'` (line ~23)
Replace: `weekType: WeekType`

The `<WeekTypeBadge weekType={week.weekType} />` at line ~343 passes no custom labels so it uses the component's default Italian labels — no further change needed.

- [ ] **Step 5: Type-check**

Run: `npm run type-check 2>&1 | grep -E "review|publish" | head -10`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/[id]/review/_content.tsx src/app/trainer/programs/[id]/publish/_content.tsx
git commit -m "feat: update review and publish pages for 8 WeekType values"
```

---

## Task 10: Trainee Pages

**Files:**
- Modify: `src/app/trainee/dashboard/_content.tsx`
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

### 10a — Trainee dashboard

- [ ] **Step 1: Import `WeekType` from `@prisma/client`; replace inline literal union**

Add/verify import: `import { WeekType } from '@prisma/client'`

Find: `weekType: 'normal' | 'test' | 'deload'` (line ~38)
Replace: `weekType: WeekType`

- [ ] **Step 2: Remove the `!== 'normal'` guard (line ~195)**

Find:
```tsx
{nextWorkout.weekType !== 'normal' && (
    <div className="flex items-center justify-center mt-2">
        <WeekTypeBadge
            weekType={nextWorkout.weekType}
            labels={{
                normal: t('trainee:weekType.normal'),
                test: t('trainee:weekType.test'),
                deload: t('trainee:weekType.deload'),
            }}
        />
    </div>
)}
```

Replace with (always show badge, update labels):
```tsx
<div className="flex items-center justify-center mt-2">
    <WeekTypeBadge
        weekType={nextWorkout.weekType}
        labels={{
            tecnica: t('trainee:weekType.tecnica'),
            ipertrofia: t('trainee:weekType.ipertrofia'),
            volume: t('trainee:weekType.volume'),
            forza_generale: t('trainee:weekType.forza_generale'),
            intensificazione: t('trainee:weekType.intensificazione'),
            picco: t('trainee:weekType.picco'),
            test: t('trainee:weekType.test'),
            deload: t('trainee:weekType.deload'),
        }}
    />
</div>
```

### 10b — ProgramDetailContent

- [ ] **Step 3: Import `WeekType` from `@prisma/client`; delete local redefinition**

Add/verify import: `import { WeekType } from '@prisma/client'`

Find and DELETE: `type WeekType = 'normal' | 'test' | 'deload'` (line ~28)

All usages of `WeekType` in the file now resolve to the Prisma import.

- [ ] **Step 4: Replace `weekTypeLabel` function (lines ~493-505)**

```typescript
weekTypeLabel: (weekType: WeekType) => {
    const labels: Record<WeekType, string> = {
        tecnica: t('currentProgram.weekTypeTecnica'),
        ipertrofia: t('currentProgram.weekTypeIpertrofia'),
        volume: t('currentProgram.weekTypeVolume'),
        forza_generale: t('currentProgram.weekTypeForzaGenerale'),
        intensificazione: t('currentProgram.weekTypeIntensificazione'),
        picco: t('currentProgram.weekTypePicco'),
        test: t('currentProgram.weekTypeTest'),
        deload: t('currentProgram.weekTypeDeload'),
    }
    return labels[weekType]
},
```

### 10c — Trainee workout detail

- [ ] **Step 5: Import `WeekType` from `@prisma/client`; replace inline literal union**

Add/verify import: `import { WeekType } from '@prisma/client'`

Find: `weekType: 'normal' | 'test' | 'deload'` (line ~87)
Replace: `weekType: WeekType`

- [ ] **Step 6: Update WeekTypeBadge labels (lines ~709-715)**

```tsx
<WeekTypeBadge
    weekType={workout.weekType}
    labels={{
        tecnica: t('weekType.tecnica'),
        ipertrofia: t('weekType.ipertrofia'),
        volume: t('weekType.volume'),
        forza_generale: t('weekType.forza_generale'),
        intensificazione: t('weekType.intensificazione'),
        picco: t('weekType.picco'),
        test: t('weekType.test'),
        deload: t('weekType.deload'),
    }}
/>
```

- [ ] **Step 7: Type-check trainee pages**

Run: `npm run type-check 2>&1 | grep -E "trainee|dashboard" | head -10`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/app/trainee/
git commit -m "feat: update trainee pages for 8 WeekType values"
```

---

## Task 11: Utilities

**Files:**
- Modify: `src/lib/program-pdf-export.ts`
- Modify: `src/lib/trainee-program-data.ts`

### 11a — PDF export

- [ ] **Step 1: Import `WeekType` from `@prisma/client`; delete local redefinition**

Add import: `import { WeekType } from '@prisma/client'`

Find and DELETE: `type WeekType = 'normal' | 'test' | 'deload'` (line ~3)

The `weekTypeLabel` callback signature in the `labels` parameter (line ~46) uses this type — it now resolves to the Prisma import. The caller (review content) passes a compliant function. No other changes needed.

### 11b — Trainee program data

- [ ] **Step 2: Update type cast (line ~191)**

Find: `weekType: week.weekType as 'normal' | 'test' | 'deload',`
Replace: `weekType: week.weekType,`

The Prisma-generated `WeekType` now matches our local types so the cast is unnecessary. Verify the surrounding interface at lines ~60 and ~73 also accepts string (`weekType: string`) — if so, no change needed to those; if they have the old literal union, update them too.

- [ ] **Step 3: Type-check utilities**

Run: `npm run type-check 2>&1 | grep -E "pdf-export|trainee-program" | head -10`
Expected: No errors

- [ ] **Step 4: Full type-check**

Run: `npm run type-check 2>&1 | grep "error TS" | head -20`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/program-pdf-export.ts src/lib/trainee-program-data.ts
git commit -m "feat: update PDF export and trainee program data utilities for 8 WeekType values"
```

---

## Task 12: Fix Tests

**Files:**
- Modify: `tests/integration/program-progress.test.ts`
- Modify: `tests/integration/program-detail.test.ts`
- Modify: `tests/integration/programs.test.ts`
- Modify: `tests/integration/trainee-workout-detail.test.ts`
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Replace all `weekType: 'normal'` in integration tests**

In each of the four integration test files, do a global search-and-replace:
- Find: `weekType: 'normal'`
- Replace: `weekType: 'volume'`

Files and approximate line counts:
- `tests/integration/program-progress.test.ts` — lines 136, 148, 160, 214
- `tests/integration/program-detail.test.ts` — lines 70, 103
- `tests/integration/programs.test.ts` — lines 159, 201, 353, 383, 391
- `tests/integration/trainee-workout-detail.test.ts` — line 50

- [ ] **Step 2: Update unit test fixture**

In `tests/unit/trainee-workout-focus.test.tsx` line 29:
Find: `weekType: 'normal' as const,`
Replace: `weekType: 'volume' as const,`

- [ ] **Step 3: Run all unit tests**

Run: `npm run test:unit 2>&1 | tail -30`
Expected: All pass

- [ ] **Step 4: Run integration tests**

Run: `npx vitest run tests/integration/ --reporter=verbose 2>&1 | tail -40`
Expected: All pass (or same failures as before this PR — check baseline if needed)

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update test fixtures to use 'volume' instead of removed 'normal' WeekType"
```

---

## Task 13: Components Showcase

**Files:**
- Modify: `src/app/components-showcase/page.tsx`

- [ ] **Step 1: Update WeekTypeBanner showcase (around line 628)**

Find the three existing `<WeekTypeBanner>` examples and replace with all eight:

```tsx
<WeekTypeBanner weekType="tecnica" weekNumber={1} />
<WeekTypeBanner weekType="ipertrofia" weekNumber={2} />
<WeekTypeBanner weekType="volume" weekNumber={3} />
<WeekTypeBanner weekType="forza_generale" weekNumber={4} />
<WeekTypeBanner weekType="intensificazione" weekNumber={5} />
<WeekTypeBanner weekType="picco" weekNumber={6} />
<WeekTypeBanner weekType="test" weekNumber={7} />
<WeekTypeBanner weekType="deload" weekNumber={8} />
```

- [ ] **Step 2: Run full type-check one final time**

Run: `npm run type-check 2>&1 | grep "error TS" | head -20`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: No new lint errors

- [ ] **Step 4: Run all unit tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/app/components-showcase/page.tsx
git commit -m "feat: add all 8 WeekType variants to components showcase"
```

---

## Task 14: Apply DB Migration

> This task runs the actual database migration. Run against dev DB first.

- [ ] **Step 1: Apply migration**

Run: `npm run prisma:migrate`
Expected: `Applied 1 migration(s)` — the `20260506000000_expand_week_types` migration

- [ ] **Step 2: Verify via Prisma Studio**

Run: `npm run prisma:studio`
Open `http://localhost:5555`, navigate to `weeks` table, confirm no rows have `weekType = normal`, all rows have valid new types.

- [ ] **Step 3: Start dev server and verify components showcase**

Run: `npm run dev`
Open `http://localhost:3000/components-showcase`
Verify: all 8 WeekTypeBanner variants render with correct colours and icons.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `tecnica`, `ipertrofia`, `volume`, `forza_generale`, `intensificazione`, `picco` — added
- ✅ `test`, `deload` — kept
- ✅ `normal` (= `standard`) — removed
- ✅ Badge for every type
- ✅ Banner for every type
- ✅ DB migration migrates `normal` rows → `volume`
- ✅ All TypeScript types updated
- ✅ All i18n keys updated (EN + IT)
- ✅ All tests updated

**Single source of truth:** `WeekType` is defined ONCE in `prisma/schema.prisma`. All TypeScript files import from `@prisma/client`. The Zod schema uses `z.nativeEnum(WeekType)`. No file redefines the union as a literal type. If you find yourself writing `'tecnica' | 'ipertrofia' | ...` anywhere in TypeScript, stop and use the import instead.

**Potential gotcha:** `forza_generale` (Prisma/Zod underscore) vs `forza-generale` (Tailwind key hyphen). This disconnect is intentional — Prisma enum values can't contain hyphens, but Tailwind CSS class names use hyphens. The badge component uses the string literal `'border-week-forza-generale'` explicitly, not derived from the enum value. Verify this mapping is consistent in WeekTypeBadge and WeekTypeBanner.

**Unused i18n keys (left intentionally):** `publishProgram.weekTypeLoading` and `publishProgram.weekTypeDeload` in trainer.json were pre-existing dead keys — they are not referenced anywhere in source. Leave as-is to avoid unrelated cleanup in this PR.
