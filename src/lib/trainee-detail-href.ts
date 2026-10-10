/** Tabs of the trainer's trainee detail page that a link can open directly. */
export type TraineeDetailTabName = 'planning' | 'notes' | 'programs' | 'records' | 'reports' | 'measurements' | 'subscription'

/** Link to a trainee's detail page; without a tab it opens the default view (planning). */
export function traineeDetailHref(traineeId: string, tab?: TraineeDetailTabName): string {
    const base = `/trainer/trainees/${encodeURIComponent(traineeId)}`
    return tab ? `${base}?tab=${tab}` : base
}
