import { getSessionIncludingInactive } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import AccountInactiveContent from './_content'

async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
}

export default async function AccountInactivePage() {
    const session = await getSessionIncludingInactive()

    if (!session) {
        redirect('/login')
    }

    // Only show this page if user is inactive
    if (session.user.isActive) {
        redirect(`/${session.user.role}/dashboard`)
    }

    let trainerName: string | null = null

    // For trainees, fetch assigned trainer
    if (session.user.role === 'trainee') {
        const trainer = await prisma.trainerTrainee.findFirst({
            where: {
                traineeId: session.user.id,
            },
            select: {
                trainer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        if (trainer) {
            trainerName = `${trainer.trainer.firstName} ${trainer.trainer.lastName}`
        }
    }

    return <AccountInactiveContent trainerName={trainerName} userRole={session.user.role} onLogout={handleLogout} />
}
