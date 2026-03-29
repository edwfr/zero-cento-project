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
    ProgressBar,
    StatCard,
    ConfirmationModal,
    ErrorBoundary,
    NavigationCard,
    DatePicker,
    AutocompleteSearch,
} from '@/components'
import type { AutocompleteOption } from '@/components'

function ComponentShowcase() {
    const { showToast } = useToast()
    const [weightType, setWeightType] = useState<WeightType>('absolute')
    const [rpe, setRpe] = useState<number | null>(null)
    const [restTime, setRestTime] = useState<RestTime>('m2')
    const [reps, setReps] = useState<string>('8')
    const [showFullPageLoader, setShowFullPageLoader] = useState(false)
    const [confirmModalOpen, setConfirmModalOpen] = useState(false)
    const [confirmVariant, setConfirmVariant] = useState<'danger' | 'warning' | 'info' | 'success'>('danger')
    const [isConfirming, setIsConfirming] = useState(false)
    const [dateValue, setDateValue] = useState<string>('')
    const [dateWithDefault, setDateWithDefault] = useState<string>('2026-03-29')
    const [selectedExercise, setSelectedExercise] = useState<AutocompleteOption | null>(null)
    const [autocompleteQuery, setAutocompleteQuery] = useState<string>('')

    const exerciseOptions: AutocompleteOption[] = [
        { id: '1', label: 'Back Squat', sublabel: 'Squat · Quadricipiti, Glutei' },
        { id: '2', label: 'Romanian Deadlift', sublabel: 'Hinge · Ischiocrurali' },
        { id: '3', label: 'Bench Press', sublabel: 'Press · Pettorali, Deltoidi' },
        { id: '4', label: 'Pull-Up', sublabel: 'Pull · Dorsali, Bicipiti' },
        { id: '5', label: 'Overhead Press', sublabel: 'Press · Deltoidi, Tricipiti' },
        { id: '6', label: 'Hip Thrust', sublabel: 'Hinge · Glutei' },
        { id: '7', label: 'Lunges', sublabel: 'Lunge · Quadricipiti, Glutei' },
        { id: '8', label: 'Farmer Carry', sublabel: 'Carry · Core, Trapezi' },
    ].filter(o =>
        !autocompleteQuery ||
        o.label.toLowerCase().includes(autocompleteQuery.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(autocompleteQuery.toLowerCase())
    )

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

                {/* Progress Bars */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Progress Bars</h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sizes</h3>
                            <div className="space-y-3">
                                <ProgressBar current={3} total={10} label="Small Progress" size="sm" />
                                <ProgressBar current={5} total={10} label="Medium Progress" size="md" />
                                <ProgressBar current={7} total={10} label="Large Progress" size="lg" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Colors</h3>
                            <div className="space-y-3">
                                <ProgressBar current={2} total={8} label="Primary" color="primary" showPercentage />
                                <ProgressBar current={6} total={8} label="Success" color="success" showPercentage />
                                <ProgressBar current={5} total={8} label="Warning" color="warning" showPercentage />
                                <ProgressBar current={1} total={8} label="Danger" color="danger" showPercentage />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stat Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Stat Cards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard
                            title="Utenti Attivi"
                            value={1247}
                            subtitle="Crescita mensile"
                            icon="👥"
                            color="primary"
                            trend={{ value: 12, label: "+12%", isPositive: true }}
                            onClick={() => showToast('Clicked Utenti Attivi', 'info')}
                        />
                        <StatCard
                            title="Workout Completati"
                            value={8432}
                            subtitle="Questo mese"
                            icon="💪"
                            color="success"
                            trend={{ value: 8, label: "+8%", isPositive: true }}
                        />
                        <StatCard
                            title="Feedback Medi"
                            value={4.7}
                            subtitle="Soddisfazione utenti"
                            icon="⭐"
                            color="warning"
                        />
                        <StatCard
                            title="Programmi Attivi"
                            value={342}
                            subtitle="In corso"
                            icon="📋"
                            color="info"
                        />
                        <StatCard
                            title="Trainer Certificati"
                            value={89}
                            subtitle="Professionisti"
                            icon="🏅"
                            color="success"
                        />
                        <StatCard
                            title="Tasso di Abbandono"
                            value={2.3}
                            subtitle="Diminuzione trimestrale"
                            icon="📉"
                            color="danger"
                            trend={{ value: -1.2, label: "-1.2%", isPositive: true }}
                        />
                    </div>
                </section>

                {/* Confirmation Modals */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Confirmation Modals</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => {
                                setConfirmVariant('danger')
                                setConfirmModalOpen(true)
                            }}
                            className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
                        >
                            Danger Modal
                        </button>
                        <button
                            onClick={() => {
                                setConfirmVariant('warning')
                                setConfirmModalOpen(true)
                            }}
                            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white hover:bg-yellow-600"
                        >
                            Warning Modal
                        </button>
                        <button
                            onClick={() => {
                                setConfirmVariant('info')
                                setConfirmModalOpen(true)
                            }}
                            className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600"
                        >
                            Info Modal
                        </button>
                        <button
                            onClick={() => {
                                setConfirmVariant('success')
                                setConfirmModalOpen(true)
                            }}
                            className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-white hover:bg-green-600"
                        >
                            Success Modal
                        </button>
                    </div>

                    <ConfirmationModal
                        isOpen={confirmModalOpen}
                        onClose={() => setConfirmModalOpen(false)}
                        onConfirm={async () => {
                            setIsConfirming(true)
                            await new Promise(resolve => setTimeout(resolve, 2000))
                            setIsConfirming(false)
                            setConfirmModalOpen(false)
                            showToast('Azione confermata!', 'success')
                        }}
                        title={
                            confirmVariant === 'danger' ? 'Elimina elemento' :
                                confirmVariant === 'warning' ? 'Attenzione' :
                                    confirmVariant === 'info' ? 'Informazione' :
                                        'Operazione completata'
                        }
                        message={
                            confirmVariant === 'danger' ? 'Sei sicuro di voler eliminare questo elemento? Questa azione non può essere annullata.' :
                                confirmVariant === 'warning' ? 'Questa operazione potrebbe avere effetti collaterali. Vuoi continuare?' :
                                    confirmVariant === 'info' ? 'Questa è una finestra informativa. Conferma per procedere.' :
                                        'Operazione completata con successo. Conferma per chiudere.'
                        }
                        variant={confirmVariant}
                        isLoading={isConfirming}
                    />
                </section>

                {/* Error Boundary Demo */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Error Boundary</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        L'ErrorBoundary cattura errori JavaScript nei componenti figli. Demo:
                    </p>
                    <ErrorBoundary>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-800 font-semibold">✓ Componente funzionante</p>
                            <p className="text-sm text-green-700 mt-1">
                                Questo contenuto è protetto da ErrorBoundary e viene renderizzato correttamente.
                            </p>
                        </div>
                    </ErrorBoundary>
                </section>

                {/* Navigation Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Navigation Cards</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Card di navigazione utilizzate nelle dashboard per indirizzare l'utente alle sezioni principali.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <NavigationCard
                            href="#"
                            icon="👥"
                            title="Gestione Utenti"
                            description="Visualizza e gestisci tutti gli utenti del sistema."
                            color="blue"
                        />
                        <NavigationCard
                            href="#"
                            icon="📋"
                            title="Programmi"
                            description="Crea e gestisci i programmi di allenamento."
                            color="green"
                        />
                        <NavigationCard
                            href="#"
                            icon="💪"
                            title="Libreria Esercizi"
                            description="Gestisci la libreria globale di esercizi."
                            color="primary"
                        />
                        <NavigationCard
                            href="#"
                            icon="📊"
                            title="Statistiche"
                            description="Analisi avanzate sull'utilizzo della piattaforma."
                            color="purple"
                        />
                        <NavigationCard
                            href="#"
                            icon="🏆"
                            title="Massimali"
                            description="Visualizza i personal record degli atleti."
                            color="yellow"
                        />
                        <NavigationCard
                            href="#"
                            icon="⚙️"
                            title="Impostazioni"
                            description="Configurazione generale dell'applicazione."
                            color="secondary"
                        />
                    </div>
                </section>

                {/* Date Picker */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Date Picker</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Input data con locale italiano (GG/MM/AAAA). Supporta selezione manuale e picker nativo.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DatePicker
                            label="Data inizio programma"
                            value={dateValue}
                            onChange={setDateValue}
                            required
                        />
                        <DatePicker
                            label="Data con valore default"
                            value={dateWithDefault}
                            onChange={setDateWithDefault}
                            min="2026-01-01"
                            max="2026-12-31"
                        />
                        <DatePicker
                            label="Campo disabilitato"
                            value="2026-06-15"
                            onChange={() => { }}
                            disabled
                        />
                    </div>
                    {dateValue && (
                        <p className="mt-4 text-sm text-gray-600">
                            Valore selezionato (ISO): <span className="font-mono font-semibold text-brand-primary">{dateValue}</span>
                        </p>
                    )}
                </section>

                {/* Autocomplete Search */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Autocomplete Search</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Dropdown ricercabile con navigazione tastiera (↑↓ Enter Esc) e supporto ricerca asincrona.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AutocompleteSearch
                            label="Seleziona esercizio"
                            options={exerciseOptions}
                            value={selectedExercise?.id}
                            onSelect={(opt) => {
                                setSelectedExercise(opt)
                                if (opt) showToast(`Selezionato: ${opt.label}`, 'success')
                            }}
                            onSearch={setAutocompleteQuery}
                            placeholder="Cerca esercizio..."
                            required
                        />
                        <AutocompleteSearch
                            label="Campo disabilitato"
                            options={[]}
                            onSelect={() => { }}
                            placeholder="Non modificabile..."
                            disabled
                        />
                    </div>
                    {selectedExercise && (
                        <p className="mt-4 text-sm text-gray-600">
                            Selezionato: <span className="font-semibold text-brand-primary">{selectedExercise.label}</span>
                            {selectedExercise.sublabel && (
                                <span className="text-gray-500"> — {selectedExercise.sublabel}</span>
                            )}
                        </p>
                    )}
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
