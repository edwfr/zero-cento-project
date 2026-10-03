import type { DashboardLocale, Translate } from '@/lib/trainer-dashboard/i18n'
import type { DashboardTrainee } from '@/lib/trainer-dashboard/trainees'

/** Everything a widget needs, resolved once by the page shell. */
export interface WidgetContext {
    trainerId: string
    trainees: DashboardTrainee[]
    now: Date
    locale: DashboardLocale
    t: Translate
}
