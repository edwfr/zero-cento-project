import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainerTrainee: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}))

import { GET, PUT } from '@/app/api/trainer/trainees/[id]/notes/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const traineeId = 'trainee-uuid-1'
const validDocument = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] }],
}

const withIdParam = (id = traineeId) => ({ params: Promise.resolve({ id }) })

function makeRequest(method = 'GET', body?: unknown) {
    return new NextRequest(`http://localhost/api/trainer/trainees/${traineeId}/notes`, {
        method,
        ...(body === undefined ? {} : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    })
}

describe('trainer trainee notes API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
    })

    it('returns an empty document for an owned trainee without a note', async () => {
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
            trainerNotes: null,
            trainerNotesUpdatedAt: null,
        } as any)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
        expect(body.data.updatedAt).toBeNull()
        expect(requireRole).toHaveBeenCalledWith(['trainer'])
        expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId },
            select: { trainerNotes: true, trainerNotesUpdatedAt: true },
        })
    })

    it('returns the saved document for an owned trainee', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
            trainerNotes: validDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as any)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(validDocument)
        expect(body.data.updatedAt).toBe(updatedAt.toISOString())
    })

    it('saves a valid document for an owned trainee', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'assignment-1' } as any)
        vi.mocked(prisma.trainerTrainee.update).mockResolvedValue({
            trainerNotes: validDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as any)

        const response = await PUT(makeRequest('PUT', { document: validDocument }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(validDocument)
        expect(body.data.updatedAt).toBe(updatedAt.toISOString())
        expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId },
            select: { id: true },
        })
        expect(prisma.trainerTrainee.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'assignment-1' },
            data: expect.objectContaining({ trainerNotes: validDocument }),
        }))
    })

    it('rejects a document that exceeds the complexity limit before checking ownership', async () => {
        const oversizedContent = Array.from({ length: 501 }, () => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
        }))
        const response = await PUT(makeRequest('PUT', {
            document: { type: 'doc', content: oversizedContent },
        }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prisma.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('silently strips unknown nodes when saving', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        const sanitizedDocument = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] }],
        }
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'assignment-1' } as any)
        vi.mocked(prisma.trainerTrainee.update).mockResolvedValue({
            trainerNotes: sanitizedDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as any)

        const response = await PUT(makeRequest('PUT', {
            document: {
                type: 'doc',
                content: [
                    { type: 'image' },
                    { type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] },
                ],
            },
        }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(sanitizedDocument)
        expect(prisma.trainerTrainee.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ trainerNotes: sanitizedDocument }),
        }))
    })

    it('rejects access to a trainee assigned to another trainer', async () => {
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('passes through unauthenticated responses', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const response = await GET(makeRequest(), withIdParam())

        expect(response.status).toBe(401)
    })
})
