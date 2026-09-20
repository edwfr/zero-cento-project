import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }))

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

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
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin } from '../helpers/auth-mock'
import { requireRole } from '@/lib/auth'

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
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(trainee as never)
        prismaMock.$transaction.mockResolvedValue([] as never)
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
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('admin deletes a trainee: auth account first, then all trainee data in one transaction', async () => {
        prismaMock.trainingProgram.deleteMany.mockReturnValue('op-programs' as never)
        prismaMock.exerciseFeedback.deleteMany.mockReturnValue('op-feedback' as never)
        prismaMock.personalRecord.deleteMany.mockReturnValue('op-records' as never)
        prismaMock.user.delete.mockReturnValue('op-user' as never)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(deleteUserMock).toHaveBeenCalledWith(trainee.id)
        expect(prismaMock.trainingProgram.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prismaMock.exerciseFeedback.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prismaMock.personalRecord.deleteMany).toHaveBeenCalledWith({ where: { traineeId: trainee.id } })
        expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
        expect(prismaMock.$transaction).toHaveBeenCalledWith(['op-programs', 'op-feedback', 'op-records', 'op-user'])
        expect(deleteUserMock.mock.invocationCallOrder[0]).toBeLessThan(
            prismaMock.$transaction.mock.invocationCallOrder[0]
        )
    })

    it('trainer deletes own trainee', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'tt-1' } as never)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: trainee.id },
        })
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('trainer cannot delete a trainee they do not own', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('cannot delete an admin', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...trainee, role: 'admin' } as never)

        const res = await callDelete()

        expect(res.status).toBe(403)
        expect(deleteUserMock).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

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
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('proceeds when the Supabase user is already gone (idempotent retry)', async () => {
        deleteUserMock.mockResolvedValue({ data: null, error: { status: 404, message: 'User not found' } })

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 500 when the DB transaction fails', async () => {
        prismaMock.$transaction.mockRejectedValue(new Error('db down') as never)

        const res = await callDelete()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('user.deleteFailed')
    })

    it('keeps plain delete for non-trainee targets (no Supabase call, no transaction)', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...trainee, role: 'trainer' } as never)

        const res = await callDelete()

        expect(res.status).toBe(200)
        expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: trainee.id } })
        expect(deleteUserMock).not.toHaveBeenCalled()
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })
})
