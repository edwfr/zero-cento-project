import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/DashboardLayout'
import WorkoutTemplateEditor from '@/components/WorkoutTemplateEditor'

interface EditTemplatePageProps {
    params: Promise<{ id: string }>
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
    const { id } = await params
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    if (!isUuid(id)) {
        notFound()
    }

    const template = await prisma.workoutTemplate.findFirst({
        where: { id, trainerId: session.user.id },
        include: {
            workouts: {
                orderBy: { dayIndex: 'asc' },
                include: { exercises: { orderBy: { order: 'asc' } } },
            },
        },
    })

    if (!template) {
        notFound()
    }

    return (
        <DashboardLayout user={session.user} backHref="/trainer/templates">
            <WorkoutTemplateEditor
                initialTemplate={{
                    id: template.id,
                    name: template.name,
                    workoutsPerWeek: template.workoutsPerWeek,
                    workouts: template.workouts.map((w) => ({
                        dayIndex: w.dayIndex,
                        exercises: w.exercises.map((e) => ({
                            exerciseId: e.exerciseId,
                            sets: e.sets,
                            reps: e.reps,
                            restTime: e.restTime,
                        })),
                    })),
                }}
            />
        </DashboardLayout>
    )
}
