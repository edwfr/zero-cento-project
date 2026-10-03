import { prisma } from '@/lib/prisma'

export interface DashboardTrainee {
    id: string
    firstName: string
    lastName: string
    isActive: boolean
}

/** One query per request: the page shell passes the result to every widget. */
export async function getTrainerTrainees(trainerId: string): Promise<DashboardTrainee[]> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId },
        select: { trainee: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
    })
    return links.map((link) => link.trainee)
}

export function activeTraineeIds(trainees: DashboardTrainee[]): string[] {
    return trainees.filter((trainee) => trainee.isActive).map((trainee) => trainee.id)
}

export function fullName(person: { firstName: string; lastName: string }): string {
    return `${person.firstName} ${person.lastName}`.trim()
}

export function initials(person: { firstName: string; lastName: string }): string {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()
}
