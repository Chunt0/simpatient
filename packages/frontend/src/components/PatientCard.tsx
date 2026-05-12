import type { PatientSummary } from '../types/patient'

interface PatientCardProps {
  patient: PatientSummary
  onStart: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PatientCard({ patient, onStart, onEdit, onDelete }: PatientCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{patient.name}</h3>
          <p className="text-sm text-gray-500">
            {patient.age} y/o {patient.sex}
          </p>
        </div>
      </div>
      <div className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
        <span className="font-medium text-amber-800">Chief complaint: </span>
        {patient.chiefComplaint}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={onStart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Start Session
        </button>
        <button
          onClick={onEdit}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
