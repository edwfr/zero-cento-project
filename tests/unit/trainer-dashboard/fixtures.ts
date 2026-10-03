import type { DashboardTrainee } from '@/lib/trainer-dashboard/trainees'

/** Saturday 3 Oct 2026, 10:00 UTC (12:00 in Rome). ISO week starts Mon 28 Sep. */
export const NOW = new Date('2026-10-03T10:00:00.000Z')

/** UTC midnight of a calendar day, the shape of ExerciseFeedback.date. */
export const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** A precise UTC instant, the shape of createdAt. */
export const at = (isoDateTime: string) => new Date(`${isoDateTime}.000Z`)

export const makeTrainee = (
    id: string,
    firstName: string,
    lastName: string,
    isActive = true,
): DashboardTrainee => ({ id, firstName, lastName, isActive })

/** t3 is deactivated: every widget must ignore it. */
export const TRAINEES: DashboardTrainee[] = [
    makeTrainee('t1', 'Anna', 'Rossi'),
    makeTrainee('t2', 'Luca', 'Bianchi'),
    makeTrainee('t3', 'Sara', 'Verdi', false),
]
