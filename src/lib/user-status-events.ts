import { prisma } from './prisma'

/**
 * Among the given inactive users, the ones that never completed onboarding:
 * no `activated` event means the trainee is still waiting for activation,
 * while an inactive user with one was deactivated by a trainer or admin.
 */
export async function findPendingActivationIds(inactiveUserIds: string[]): Promise<Set<string>> {
    if (inactiveUserIds.length === 0) return new Set()

    const activated = await prisma.userStatusEvent.findMany({
        where: { userId: { in: inactiveUserIds }, type: 'activated' },
        select: { userId: true },
        distinct: ['userId'],
    })
    const activatedIds = new Set(activated.map((event) => event.userId))

    return new Set(inactiveUserIds.filter((id) => !activatedIds.has(id)))
}
