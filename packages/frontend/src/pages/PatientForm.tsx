import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SystemPromptEditor } from '../components/SystemPromptEditor'
import { usePatient, useCreatePatient, useUpdatePatient } from '../hooks/usePatients'
import type { PatientFormData } from '../types/patient'

const defaultForm: PatientFormData = {
  name: '',
  age: 0,
  sex: '',
  chiefComplaint: '',
  medicalHistory: '',
  medications: '',
  allergies: '',
  vitalSigns: '',
  personalityNotes: '',
  systemPrompt: '',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const textareaClass = `${inputClass} resize-y`

export function PatientFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { data: existingPatient } = usePatient(id ?? '')
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient(id ?? '')

  const [form, setForm] = useState<PatientFormData>(defaultForm)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (existingPatient) {
      setForm({
        name: existingPatient.name,
        age: existingPatient.age,
        sex: existingPatient.sex,
        chiefComplaint: existingPatient.chiefComplaint,
        medicalHistory: existingPatient.medicalHistory,
        medications: existingPatient.medications,
        allergies: existingPatient.allergies,
        vitalSigns: existingPatient.vitalSigns,
        personalityNotes: existingPatient.personalityNotes,
        systemPrompt: existingPatient.systemPrompt,
      })
    }
  }, [existingPatient])

  const set = (field: keyof PatientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const data = { ...form, age: Number(form.age) }
    try {
      if (isEdit) {
        await updatePatient.mutateAsync(data)
      } else {
        await createPatient.mutateAsync(data)
      }
      navigate('/')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const isPending = createPatient.isPending || updatePatient.isPending

  return (
    <Layout title={isEdit ? 'Edit Patient Profile' : 'New Patient Profile'}>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name *">
              <input required className={inputClass} value={form.name} onChange={set('name')} placeholder="e.g. Maria Gonzalez" />
            </Field>
            <Field label="Age *">
              <input required type="number" min={0} max={120} className={inputClass} value={form.age} onChange={set('age')} />
            </Field>
          </div>
          <Field label="Sex *">
            <input required className={inputClass} value={form.sex} onChange={set('sex')} placeholder="e.g. female, male" />
          </Field>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Clinical Information</h2>
          <Field label="Chief Complaint *">
            <input required className={inputClass} value={form.chiefComplaint} onChange={set('chiefComplaint')} placeholder="e.g. chest pain for 2 hours" />
          </Field>
          <Field label="Medical History" hint="(optional)">
            <textarea rows={3} className={textareaClass} value={form.medicalHistory} onChange={set('medicalHistory')} placeholder="Past diagnoses, surgeries, conditions..." />
          </Field>
          <Field label="Current Medications" hint="(optional — one per line)">
            <textarea rows={2} className={textareaClass} value={form.medications} onChange={set('medications')} placeholder="Metformin 500mg twice daily..." />
          </Field>
          <Field label="Allergies" hint="(optional)">
            <input className={inputClass} value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin — rash; NKDA" />
          </Field>
          <Field label="Vital Signs" hint="(optional)">
            <input className={inputClass} value={form.vitalSigns} onChange={set('vitalSigns')} placeholder="e.g. BP 145/92, HR 88, RR 18, SpO2 97%, Temp 37.2°C" />
          </Field>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Personality & Behavior</h2>
          <Field label="Personality Notes" hint="(optional)">
            <textarea rows={2} className={textareaClass} value={form.personalityNotes} onChange={set('personalityNotes')} placeholder="e.g. anxious, tends to minimize symptoms, asks many questions" />
          </Field>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <SystemPromptEditor
            value={form.systemPrompt}
            onChange={(v) => setForm((prev) => ({ ...prev, systemPrompt: v }))}
            patientFields={form}
          />
        </section>

        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {submitError}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Patient'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  )
}
