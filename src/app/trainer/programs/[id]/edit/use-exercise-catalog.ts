'use client'

import { useCallback, useState } from 'react'
import type { ExerciseType } from '@/lib/exercise-type'

const PRIMARY_COLOR = 'rgb(var(--brand-primary))'

export interface ExerciseCatalogItem {
    id: string
    name: string
    type: ExerciseType
    notes: string[]
    movementPattern: { id: string; name: string; color: string } | null
    isBodyweightLoaded: boolean
}

/**
 * Library exercises for the program editor dropdowns, sorted by name.
 * `refreshExerciseCatalog` reloads every page of `/api/exercises`; a failed refresh
 * keeps the current catalog, so a network blip never empties the dropdowns.
 */
export function useExerciseCatalog() {
    const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseCatalogItem[]>([])

    const refreshExerciseCatalog = useCallback(async () => {
        try {
            const movementPatternsRes = await fetch('/api/movement-patterns')
            const movementPatternsData = await movementPatternsRes.json()

            const allExercises: any[] = []
            let cursor: string | null = null

            while (true) {
                const searchParams = new URLSearchParams({
                    limit: '500',
                })

                if (cursor) {
                    searchParams.set('cursor', cursor)
                }

                const exercisesRes = await fetch(`/api/exercises?${searchParams.toString()}`)
                const exercisesData = await exercisesRes.json()

                if (!exercisesRes.ok) {
                    return
                }

                const pageItems = Array.isArray(exercisesData.data?.items)
                    ? exercisesData.data.items
                    : []
                allExercises.push(...pageItems)

                const hasMore = Boolean(exercisesData.data?.pagination?.hasMore)
                const nextCursor = exercisesData.data?.pagination?.nextCursor

                if (!hasMore || typeof nextCursor !== 'string' || nextCursor.length === 0) {
                    break
                }

                cursor = nextCursor
            }

            const patternColorsMap = new Map<string, string>()
            if (movementPatternsRes.ok && movementPatternsData.data?.items) {
                movementPatternsData.data.items.forEach((pattern: any) => {
                    if (pattern.movementPatternColors && pattern.movementPatternColors.length > 0) {
                        patternColorsMap.set(pattern.id, pattern.movementPatternColors[0].color)
                    }
                })
            }

            const nextCatalog: ExerciseCatalogItem[] = allExercises.map((exercise: any) => {
                const movementPattern = exercise.movementPattern
                    ? {
                        id: exercise.movementPattern.id,
                        name: exercise.movementPattern.name,
                        color: patternColorsMap.get(exercise.movementPattern.id) || PRIMARY_COLOR,
                    }
                    : null

                return {
                    id: exercise.id,
                    name: exercise.name,
                    type: exercise.type,
                    notes: Array.isArray(exercise.notes)
                        ? exercise.notes.filter((note: unknown) => typeof note === 'string')
                        : [],
                    movementPattern,
                    isBodyweightLoaded: Boolean(exercise.isBodyweightLoaded),
                }
            })

            setExerciseCatalog(
                nextCatalog.sort((left, right) =>
                    left.name.localeCompare(right.name, 'it', { sensitivity: 'base' })
                )
            )
        } catch {
            // Keep the current catalog: a failed refresh must not empty the dropdowns
        }
    }, [])

    return { exerciseCatalog, refreshExerciseCatalog }
}
