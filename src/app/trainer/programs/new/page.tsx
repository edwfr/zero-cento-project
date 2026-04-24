import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import NewProgramContent from './NewProgramContent'

interface NewProgramPageProps {
    searchParams?: Promise<{ traineeId?: string }>
}

interface TraineeOption {
    id: string
    firstName: string
    lastName: string
}

function sortTraineesByLastName(trainees: TraineeOption[]): TraineeOption[] {
    return trainees.sort((left, right) => {
        const lastNameComparison = left.lastName.localeCompare(right.lastName, 'it', {
            sensitivity: 'base',
        })

        if (lastNameComparison !== 0) {
            return lastNameComparison
        }

        return left.firstName.localeCompare(right.firstName, 'it', {
            sensitivity: 'base',
        })
    })
}

async function getAvailableTrainees(userId: string, role: string): Promise<TraineeOption[]> {
    if (role === 'admin') {
        const trainees = await prisma.user.findMany({
            where: {
                role: 'trainee',
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
            },
            orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' },
            ],
        })

        return sortTraineesByLastName(trainees)
    }

    const traineeAssociations = await prisma.trainerTrainee.findMany({
        where: {
            trainerId: userId,
        },
        select: {
            trainee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    isActive: true,
                },
            },
        },
    })

    return sortTraineesByLastName(
        traineeAssociations
            .map((association) => association.trainee)
            .filter((trainee) => trainee.isActive)
            .map(({ id, firstName, lastName }) => ({
                id,
                firstName,
                lastName,
            }))
    )
}

export default async function NewProgramPage({ searchParams }: NewProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer' && session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const trainees = await getAvailableTrainees(session.user.id, session.user.role)
    const requestedTraineeId = resolvedSearchParams?.traineeId
    const hasRequestedTrainee = trainees.some((trainee) => trainee.id === requestedTraineeId)
    const initialTraineeId = hasRequestedTrainee
        ? requestedTraineeId!
        : trainees[0]?.id || ''
    const backHref = hasRequestedTrainee
        ? `/trainer/trainees/${requestedTraineeId}`
        : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <div className="py-6">
                <NewProgramContent
                    trainees={trainees}
                    initialTraineeId={initialTraineeId}
                />
            </div>
        </DashboardLayout>
    )
}
