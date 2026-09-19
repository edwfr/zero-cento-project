import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminSession, mockTrainerSession } from './fixtures'

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }))

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: vi.fn(), delete: vi.fn() },
        trainerTrainee: { findFirst: vi.fn() },
        trainingProgram: { deleteMany: vi.fn() },
        exerciseFeedback: { deleteMany: vi.fn() },
        personalRecord: { deleteMany: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: vi.fn(() => ({
        auth: { admin: { deleteUser: deleteUserMock } },
    })),
}))

vi.mock('@/lib/sync-user-metadata', () => ({ syncUserMetadata: vi.fn() }))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from '@/app/api/users/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const trainee = {
    id: 'trainee-uuid-9',
    email: 'luca.bianchi@example.com',
    firstName: 'Luca',
    lastName: 'Bianchi',
    role: 'trainee',
    isActive: true,
    createdAt: new Date('2026-01-01'),
}

function callDelete(id = trainee.id) {
    return DELETE(
        new NextRequest(`http://localhost:3000/api/users/${id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id }) }
    )
}

describe('DELETE /api/users/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(trainee as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([] as any)
        deleteUserMock.mockResolvedValue({ data: {}, error: null })
    })

    it('restricts the endpoint to admin and trainer roles', async () => {
        await callDelete()
        expect(requireRole).toHaveBeenCalledWith(['admin', 'trainer'])
    })

    it('rejects a trainee caller without deleting anything', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 })
        )

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('admin deletes a trainee: auth account first, then all trainee data in one transaction', async () => {
        vi.mocked(prisma.trainingProgram.deleteMany).mockReturnValue('op-programs' as any)
        vi.mocked(prisma.exerciseFeedback.deleteMany).mockReturnValue('op-feedback' as any)
        vi.mocked(prisma.personalRecord.deleteMany).mockReturnValue('op-records' as any)
        vi.mocked(prisma.user.delete).mockReturnValue('op-user' as any)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(deleteUserMock).toHaveBeenCalledWith(trainee.id)
        expect(prisma.trainingProgram.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.exerciseFeedback.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.personalRecord.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(prisma.$transaction).toHaveBeenCalledWith(['op-programs', 'op-feedback', 'op-records', 'op-user'])
        expect(deleteUserMock.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]
        )
    })

    it('trainer deletes own trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'tt-1' } as any)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: trainee.id },
        })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('trainer cannot delete a trainee they do not own', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('cannot delete an admin', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...trainee, role: 'admin' } as any)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const res = await callDelete()

        expect(res.status).toBe(404)
        expect(deleteUserMock).not.toHaveBeenCalled()
    })

    it('aborts without touching the DB when the Supabase deletion fails', async () => {
        deleteUserMock.mockResolvedValue({ data: null, error: { status: 500, message: 'boom' } })

        const res = await callDelete()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('user.deleteFailed')
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('proceeds when the Supabase user is already gone (idempotent retry)', async () => {
        deleteUserMock.mockResolvedValue({ data: null, error: { status: 404, message: 'User not found' } })

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 500 when the DB transaction fails', async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))

        const res = await callDelete()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('user.deleteFailed')
    })

    it('keeps plain delete for non-trainee targets (no Supabase call, no transaction)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...trainee, role: 'trainer' } as any)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })
})
