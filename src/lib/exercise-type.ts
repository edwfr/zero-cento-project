import type { ExerciseType as PrismaExerciseType } from '@prisma/client'

/**
 * Single source of truth for exercise types.
 * Adding a type: extend the Prisma enum, this tuple, EXERCISE_TYPE_META and the
 * `common:exerciseTypes` i18n keys — type-check fails until all are in sync.
 */
export const EXERCISE_TYPES = ['fundamental', 'accessory', 'postural'] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]

// Compile-time guard: fails type-check if the Prisma enum and EXERCISE_TYPES diverge
type AssertSameUnion = [PrismaExerciseType] extends [ExerciseType]
    ? [ExerciseType] extends [PrismaExerciseType]
        ? true
        : never
    : never
const prismaEnumInSync: AssertSameUnion = true
void prismaEnumInSync

export interface ExerciseTypeMeta {
    labelKey: string
    pluralKey: string
    shortKey: string
    /** Label used by the create/edit radio group */
    formLabelKey: string
    badgeClass: string
    sortOrder: number
}

const keysFor = (type: ExerciseType) => ({
    labelKey: `common:exerciseTypes.${type}.label`,
    pluralKey: `common:exerciseTypes.${type}.plural`,
    shortKey: `common:exerciseTypes.${type}.short`,
})

export const EXERCISE_TYPE_META: Record<ExerciseType, ExerciseTypeMeta> = {
    fundamental: {
        ...keysFor('fundamental'),
        formLabelKey: 'trainer:exercises.fundamentalSBD',
        badgeClass: 'border-red-200 bg-red-100 text-red-800',
        sortOrder: 1,
    },
    accessory: {
        ...keysFor('accessory'),
        formLabelKey: keysFor('accessory').labelKey,
        badgeClass: 'border-blue-200 bg-blue-100 text-blue-800',
        sortOrder: 2,
    },
    postural: {
        ...keysFor('postural'),
        formLabelKey: keysFor('postural').labelKey,
        badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        sortOrder: 3,
    },
}

export const DEFAULT_EXERCISE_TYPE: ExerciseType = 'accessory'

export function isExerciseType(value: unknown): value is ExerciseType {
    return typeof value === 'string' && (EXERCISE_TYPES as readonly string[]).includes(value)
}

const sortOrderOf = (type: string | null | undefined) =>
    isExerciseType(type) ? EXERCISE_TYPE_META[type].sortOrder : Number.MAX_SAFE_INTEGER

/** Comparator: fundamental → accessory → postural → unknown */
export function compareExerciseType(a: string | null | undefined, b: string | null | undefined): number {
    return sortOrderOf(a) - sortOrderOf(b)
}
