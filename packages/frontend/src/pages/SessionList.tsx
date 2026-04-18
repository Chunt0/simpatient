import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusBadge } from '../components/StatusBadge'
import { useSessions, useDeleteSession } from '../hooks/useSessions'

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function SessionListPage() {
  const navigate = useNavigate()
  const { data: sessions, isLoading, error } = useSessions()
  const deleteSession = useDeleteSession()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sessionToDelete = sessions?.find((s) => s.id === deletingId)

  return (
    <Layout title="Session History">
      {isLoading && (
        <div className="text-center py-16 text-gray-500">Loading sessions...</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Failed to load sessions: {error.message}
        </div>
      )}
      {sessions && sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">No sessions recorded yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Start a session from the <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">Patients</button> page.
          </p>
        </div>
      )}
      {sessions && sessions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.patientName ?? 'Unknown patient'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(s.startedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDuration(s.durationSeconds)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={!s.endedAt} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/sessions/${s.id}`)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="text-red-500 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete session?"
        description={`Delete the session for "${sessionToDelete?.patientName ?? 'this patient'}" from ${sessionToDelete ? formatDate(sessionToDelete.startedAt) : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteSession.isPending}
        onConfirm={() => {
          if (deletingId) {
            deleteSession.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
          }
        }}
      />
    </Layout>
  )
}
