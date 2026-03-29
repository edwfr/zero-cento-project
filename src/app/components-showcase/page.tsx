'use client'

import { useState } from 'react'
import { WeightType, RestTime, ExerciseType, WeekType } from '@prisma/client'
import {
    WeightTypeSelector,
    RPESelector,
    RestTimeSelector,
    RepsInput,
    FeedbackForm,
    ExerciseCard,
    MovementPatternTag,
    YoutubeEmbed,
    WeekTypeBanner,
    LoadingSpinner,
    FullPageLoader,
    InlineLoader,
    ToastProvider,
    useToast,
} from '@/components'

function ComponentShowcase() {
    const { showToast } = useToast()
    const [weightType, setWeightType] = useState<WeightType>('absolute')
    const [rpe, setRpe] = useState<number | null>(null)
    const [restTime, setRestTime] = useState<RestTime>('m2')
    const [reps, setReps] = useState<string>('8')
    const [showFullPageLoader, setShowFullPageLoader] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl space-y-12">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-5xl font-bold">
                        <span className="text-gray-900">Zero</span>
                        <span className="text-brand-primary">Cento</span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-600">UI Components Showcase</p>
                    <div className="mt-4 flex justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-brand-primary"></div>
                            <span className="text-sm text-gray-600">Primary: #FFA700</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-black"></div>
                            <span className="text-sm text-gray-600">Secondary: #000000</span>
                        </div>
                    </div>
                </div>

                {/* Toast Demos */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Toast Notifications</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => showToast('Operazione completata con successo!', 'success')}
                            className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-white hover:bg-green-600"
                        >
                            Success Toast
                        </button>
                        <button
                            onClick={() => showToast('Si è verificato un errore', 'error')}
                            className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
                        >
                            Error Toast
                        </button>
                        <button
                            onClick={() => showToast('Attenzione: controlla i dati inseriti', 'warning')}
                            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white hover:bg-yellow-600"
                        >
                            Warning Toast
                        </button>
                        <button
                            onClick={() => showToast('Informazione: caricamento completato', 'info')}
                            className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600"
                        >
                            Info Toast
                        </button>
                    </div>
                </section>

                {/* Loading Spinners */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Loading Spinners</h2>
                    <div className="flex items-center gap-8">
                        <LoadingSpinner size="sm" label="Small" />
                        <LoadingSpinner size="md" label="Medium" />
                        <LoadingSpinner size="lg" label="Large" />
                        <LoadingSpinner size="xl" label="Extra Large" />
                    </div>
                    <div className="mt-6">
                        <button
                            onClick={() => {
                                setShowFullPageLoader(true)
                                setTimeout(() => setShowFullPageLoader(false), 3000)
                            }}
                            className="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white hover:bg-brand-primary/90"
                        >
                            Show Full Page Loader (3s)
                        </button>
                        <InlineLoader className="ml-4" />
                    </div>
                    {showFullPageLoader && <FullPageLoader message="Caricamento demo..." />}
                </section>

                {/* Week Type Banners */}
                <section className="space-y-4 rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Week Type Banners</h2>
                    <WeekTypeBanner weekType="normal" weekNumber={1} />
                    <WeekTypeBanner weekType="test" weekNumber={4} />
                    <WeekTypeBanner weekType="deload" weekNumber={8} />
                </section>

                {/* Form Components */}
                <section className="space-y-6 rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Form Components</h2>

                    <WeightTypeSelector value={weightType} onChange={setWeightType} />
                    <RPESelector value={rpe} onChange={setRpe} />
                    <RestTimeSelector value={restTime} onChange={setRestTime} />
                    <RepsInput value={reps} onChange={setReps} />
                </section>

                {/* Exercise Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Exercise Cards</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <ExerciseCard
                            id="1"
                            name="Back Squat"
                            type="fundamental"
                            movementPattern={{ id: '1', name: 'Squat', color: '#ef4444' }}
                            muscleGroups={[
                                { id: '1', name: 'Quadricipiti' },
                                { id: '2', name: 'Glutei' },
                            ]}
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            notes="Esercizio fondamentale per le gambe"
                            showActions
                            onEdit={() => showToast('Modifica esercizio', 'info')}
                            onDelete={() => showToast('Elimina esercizio', 'warning')}
                        />
                        <ExerciseCard
                            id="2"
                            name="Romanian Deadlift"
                            type="accessory"
                            movementPattern={{ id: '2', name: 'Hinge', color: '#10b981' }}
                            muscleGroups={[{ id: '3', name: 'Ischiocrurali' }]}
                        />
                        <ExerciseCard
                            id="3"
                            name="Bench Press"
                            type="fundamental"
                            movementPattern={{ id: '3', name: 'Press', color: '#FFA700' }}
                            muscleGroups={[
                                { id: '4', name: 'Pettorali' },
                                { id: '5', name: 'Deltoidi' },
                            ]}
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        />
                    </div>
                </section>

                {/* Movement Pattern Tags */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Movement Pattern Tags</h2>
                    <div className="flex flex-wrap gap-3">
                        <MovementPatternTag name="Squat" color="#ef4444" />
                        <MovementPatternTag name="Hinge" color="#10b981" />
                        <MovementPatternTag name="Press" color="#FFA700" />
                        <MovementPatternTag name="Pull" color="#3b82f6" />
                        <MovementPatternTag name="Carry" color="#8b5cf6" />
                        <MovementPatternTag name="Lunge" color="#ec4899" />
                    </div>
                </section>

                {/* YouTube Embed */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">YouTube Embed</h2>
                    <div className="mx-auto max-w-2xl">
                        <YoutubeEmbed
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            title="Tutorial Back Squat"
                        />
                    </div>
                </section>

                {/* Feedback Form */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Feedback Form</h2>
                    <FeedbackForm
                        workoutExerciseName="Back Squat"
                        prescribedSets={4}
                        prescribedReps="8"
                        prescribedWeight={100}
                        onSubmit={(data) => {
                            console.log('Feedback submitted:', data)
                            showToast('Feedback salvato con successo!', 'success')
                        }}
                        onCancel={() => showToast('Operazione annullata', 'info')}
                    />
                </section>
            </div>
        </div>
    )
}

export default function ComponentsShowcasePage() {
    return (
        <ToastProvider>
            <ComponentShowcase />
        </ToastProvider>
    )
}
