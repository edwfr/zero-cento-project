# Exercise Focus Card — Type Badge Redesign

**Date:** 2026-05-06  
**Scope:** `ExerciseFocusCard` in `src/app/trainee/workouts/[id]/_content.tsx`

## Goal

Move exercise type (fundamental/accessory) from header row to rest row in the extended exercise focus card. Simultaneously lowercase the "Rest:" label.

## Changes

### 1. Remove badge from header row

**Before:**
```jsx
<div className="flex flex-wrap items-center gap-2 mb-1">
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${...}`}>
        {we.exercise.type === 'fundamental' ? 'F' : 'A'}
    </span>
    <h2 className="text-2xl font-bold text-gray-900">{we.exercise.name}</h2>
</div>
```

**After:**
```jsx
<h2 className="text-2xl font-bold text-gray-900 mb-1">{we.exercise.name}</h2>
```

### 2. Add full-text pill to rest row

**Before:**
```jsx
<div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="w-3 h-3" />
        <span className="font-semibold">{t('workouts.rest')}:</span>
        {formatRestTime(we.restTime)}
    </span>
</div>
```

**After:**
```jsx
<div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="w-3 h-3" />
        <span className="font-semibold">{t('workouts.rest')}:</span>
        {formatRestTime(we.restTime)}
    </span>
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        we.exercise.type === 'fundamental'
            ? 'border-red-200 bg-red-100 text-red-700'
            : 'border-blue-200 bg-blue-100 text-blue-700'
    }`}>
        {we.exercise.type === 'fundamental'
            ? t('trainer:exercises.fundamental')
            : t('trainer:exercises.accessory')}
    </span>
</div>
```

### 3. Translation: lowercase "Rest"

`public/locales/en/trainee.json` and `public/locales/it/trainee.json`:
```
"rest": "Rest"  →  "rest": "rest"
```

## Test impact

`tests/unit/WorkoutExerciseDisplayList.test.tsx` — check for "F"/"A" badge references; update if needed.
