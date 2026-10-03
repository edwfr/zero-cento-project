import { logger } from '@/lib/logger'

export type WidgetResult<T> = { ok: true; data: T } | { ok: false }

/** Keeps one failing widget from taking down the whole home page. */
export async function loadWidget<T>(widget: string, load: () => Promise<T>): Promise<WidgetResult<T>> {
    try {
        return { ok: true, data: await load() }
    } catch (error) {
        logger.error({ error, widget }, 'Trainer dashboard widget failed to load')
        return { ok: false }
    }
}
