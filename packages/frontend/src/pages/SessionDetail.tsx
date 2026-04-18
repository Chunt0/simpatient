import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { StatusBadge } from '../components/StatusBadge'
import { useSession } from '../hooks/useSessions'

function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'In progress'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: session, isLoading, error } = useSession(id ?? '')

  const handleExport = () => {
    if (!session) return
    const patientName = session.patient?.name ?? 'Unknown'
    const header = `SimPatient Session Transcript\nPatient: ${patientName}\nDate: ${formatDate(session.startedAt)}\nDuration: ${formatDuration(session.durationSeconds)}\n${'─'.repeat(50)}\n\n`
    const body = session.entries
      .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.role === 'student' ? 'STUDENT' : 'PATIENT'}: ${e.text}`)
      .join('\n\n')
    const blob = new Blob([header + body], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${id}-${patientName.replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout
      title={session ? `Session — ${session.patient?.name ?? 'Unknown patient'}` : 'Session Detail'}
      actions={
        session?.entries.length ? (
          <button
            onClick={handleExport}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Export transcript
          </button>
        ) : undefined
      }
    >
      {isLoading && <div className="text-center py-16 text-gray-500">Loading session...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error.message}
        </div>
      )}
      {session && (
        <div className="flex flex-col gap-5">
          {/* Session metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Patient</p>
                <p className="font-semibold text-gray-900">{session.patient?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Chief Complaint</p>
                <p className="text-gray-700">{session.patient?.chiefComplaint ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Started</p>
                <p className="text-gray-700">{formatDate(session.startedAt)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Duration</p>
                <p className="text-gray-700">{formatDuration(session.durationSeconds)}</p>
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge active={!session.endedAt} />
            </div>
          </div>

          {/* Transcript */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ minHeight: '400px' }}>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Transcript
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({session.entries.length} messages)
                </span>
              </h2>
            </div>
            {session.entries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No transcript entries recorded.
              </div>
            ) : (
              <TranscriptPanel entries={session.entries} className="flex-1" />
            )}
          </div>

          <button
            onClick={() => navigate('/sessions')}
            className="text-blue-600 hover:underline text-sm self-start"
          >
            ← Back to sessions
          </button>
        </div>
      )}
    </Layout>
  )
}
