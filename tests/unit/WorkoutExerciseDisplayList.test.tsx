import { describe, it, expect } from 'vitest'
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
