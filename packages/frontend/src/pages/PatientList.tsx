import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { PatientCard } from '../components/PatientCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { usePatients, useDeletePatient } from '../hooks/usePatients'

export function PatientListPage() {
  const navigate = useNavigate()
  const { data: patients, isLoading, error } = usePatients()
  const deletePatient = useDeletePatient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const patientToDelete = patients?.find((p) => p.id === deletingId)

  return (
    <Layout
      title="Patient Profiles"
      actions={
        <button
          onClick={() => navigate('/patients/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          + New Patient
        </button>
      }
    >
      {isLoading && (
        <div className="text-center py-16 text-gray-500">Loading patients...</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Failed to load patients: {error.message}
        </div>
      )}
      {patients && patients.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">No patient profiles yet.</p>
          <button
            onClick={() => navigate('/patients/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-lg"
          >
            Create your first patient
          </button>
        </div>
      )}
      {patients && patients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onStart={() => navigate(`/session/${patient.id}`)}
              onEdit={() => navigate(`/patients/${patient.id}/edit`)}
              onDelete={() => setDeletingId(patient.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete patient profile?"
        description={`This will permanently delete "${patientToDelete?.name}" and all associated session transcripts.`}
        confirmLabel="Delete"
        loading={deletePatient.isPending}
        onConfirm={() => {
          if (deletingId) {
            deletePatient.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
          }
        }}
      />
    </Layout>
  )
}
