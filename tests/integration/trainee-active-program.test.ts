import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/active-program/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTraineeSession } from '../helpers/sessions'
import { asTrainee } from '../helpers/auth-mock'
import { requireRole } from '@/lib/auth'

const makeRequest = () => new NextRequest('http://localhost:3000/api/trainee/active-program')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/trainee/active-program', () => {
    it('returns 200 with id when active program exists', async () => {
        asTrainee()
        prismaMock.trainingProgram.findFirst.mockResolvedValue({ id: 'prog-1' })

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ programId: 'prog-1' })
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { traineeId: mockTraineeSession.user.id, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })
    })

    it('returns 404 when no active program', async () => {
        asTrainee()
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
    })

    it('rejects non-trainees', async () => {
        vi.mocked(requireRole).mockImplementation(async () => {
            throw new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })
        })

        const res = await GET(makeRequest())
        expect(res.status).toBe(403)
    })
})
