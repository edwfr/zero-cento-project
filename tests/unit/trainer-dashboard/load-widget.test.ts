import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { logger } from '@/lib/logger'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'

describe('loadWidget', () => {
    it('wraps the loaded data', async () => {
        await expect(loadWidget('todo-today', async () => [1, 2])).resolves.toEqual({ ok: true, data: [1, 2] })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('logs and reports failure instead of throwing', async () => {
        const error = new Error('db down')

        await expect(loadWidget('todo-today', async () => { throw error })).resolves.toEqual({ ok: false })
        expect(logger.error).toHaveBeenCalledWith({ error, widget: 'todo-today' }, 'Trainer dashboard widget failed to load')
    })
})
