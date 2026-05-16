import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from '@/components/WorkoutExerciseDisplayList'

const items: ExerciseDisplayItem[] = [
    {
        id: 'we-1',
        exerciseName: 'Squat',
        scheme: '3 x 8',
        performedSets: [
            { setNumber: 1, reps: 8, weight: 100, completed: true },
            { setNumber: 2, reps: 7, weight: 100, completed: true },
        ],
        trainerNote: 'Keep knees out',
        traineeNote: 'Felt easy',
    },
    {
        id: 'we-2',
        exerciseName: 'Bench Press',
        scheme: '4 x 6',
        performedSets: [],
        traineeNote: null,
    },
]

describe('WorkoutExerciseDisplayList', () => {
    it('renders exercise names', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Squat')).toBeTruthy()
        expect(screen.getByText('Bench Press')).toBeTruthy()
    })

    it('renders performed set rows when sets are present', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('#1 · 8 rep · 100 kg')).toBeTruthy()
        expect(screen.getByText('#2 · 7 rep · 100 kg')).toBeTruthy()
    })

    it('renders scheme when no performed sets', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('4 x 6')).toBeTruthy()
    })

    it('renders enriched scheme with kg and @RPE when no performed sets', () => {
        const enrichedItems: ExerciseDisplayItem[] = [
            {
                id: 'we-3',
                exerciseName: 'Deadlift',
                scheme: '3 x 8 · 80kg · @RPE 8',
                performedSets: [],
            },
        ]

        render(<WorkoutExerciseDisplayList items={enrichedItems} />)
        expect(screen.getByText('3 x 8 · 80kg · @RPE 8')).toBeTruthy()
    })

    it('renders trainer note', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Keep knees out')).toBeTruthy()
    })

    it('renders trainee note', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Felt easy')).toBeTruthy()
    })

    it('renders custom emptyText when items is empty', () => {
        render(<WorkoutExerciseDisplayList items={[]} emptyText="Nessun esercizio" />)
        expect(screen.getByText('Nessun esercizio')).toBeTruthy()
    })
})

describe('WorkoutExerciseDisplayList — per-set RPE', () => {
    const baseItem: ExerciseDisplayItem = {
        id: 'ex1',
        exerciseName: 'Squat',
        scheme: '3 x 8',
        performedSets: [
            { setNumber: 1, reps: 8, weight: 60, completed: true, actualRpe: 8 },
            { setNumber: 2, reps: 8, weight: 60, completed: true, actualRpe: null },
        ],
    }

    it('renders @ RPE x for sets with actualRpe', () => {
        render(<WorkoutExerciseDisplayList items={[baseItem]} />)
        expect(screen.getByText(/#1 · 8 rep · 60 kg @ RPE 8/)).toBeInTheDocument()
    })

    it('omits RPE for sets without actualRpe', () => {
        render(<WorkoutExerciseDisplayList items={[baseItem]} />)
        expect(screen.getByText(/#2 · 8 rep · 60 kg$/)).toBeInTheDocument()
    })

    it('passes rpe to a custom setRowLabel', () => {
        const labelFn = vi.fn((set: number, reps: number, weight: number, rpe: number | null) =>
            `#${set} ${reps}x${weight} rpe=${rpe ?? '-'}`
        )
        render(<WorkoutExerciseDisplayList items={[baseItem]} setRowLabel={labelFn} />)
        expect(labelFn).toHaveBeenCalledWith(1, 8, 60, 8)
        expect(labelFn).toHaveBeenCalledWith(2, 8, 60, null)
    })
})
