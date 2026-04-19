import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useRoomContext,
} from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import type { TranscriptionSegment, Participant } from 'livekit-client'
import { api } from '../lib/api'
import { TranscriptPanel } from '../components/TranscriptPanel'
import type { TokenResponse, TranscriptEntry } from '../types/patient'

// ── Agent state pill ────────────────────────────────────────────────────────

function AgentStatePill({ state }: { state: string }) {
  const config: Record<string, { label: string; bg: string; dot: string; pulse: boolean }> = {
    connecting: { label: 'Connecting…', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500', pulse: true },
    initializing: { label: 'Patient joining…', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500', pulse: true },
    listening: { label: 'Listening', bg: 'bg-green-100  text-green-800  border-green-200', dot: 'bg-green-500', pulse: true },
    thinking: { label: 'Thinking…', bg: 'bg-blue-100   text-blue-800   border-blue-200', dot: 'bg-blue-500', pulse: true },
    speaking: { label: 'Patient speaking', bg: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500', pulse: true },
    disconnected: { label: 'Disconnected', bg: 'bg-gray-100   text-gray-600   border-gray-200', dot: 'bg-gray-400', pulse: false },
  }
  const c = config[state] ?? config.disconnected
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}

// ── Session active banner ────────────────────────────────────────────────────

function SessionBanner({ patient, state }: { patient: TokenResponse['patient']; state: string }) {
  const isLive = state !== 'disconnected'
  return (
    <div className={`px-4 py-2 flex items-center gap-3 text-sm font-medium border-b ${isLive ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      {isLive
        ? <>Session active &mdash; simulating <strong>{patient.name}</strong></>
        : 'Session ended'}
    </div>
  )
}

// ── Inner component (must be inside LiveKitRoom context) ────────────────────

interface SessionInnerProps {
  details: TokenResponse
  onLeave: () => void
}

function SessionInner({ details, onLeave }: SessionInnerProps) {
  const { state } = useVoiceAssistant()
  const room = useRoomContext()
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const handler = (
      segments: TranscriptionSegment[],
      participant: Participant | undefined,
    ) => {
      const finalSegments = segments.filter((s) => s.final)
      const text = finalSegments.map((s) => s.text).join(' ').trim()
      if (!text) return
      const isAgent = participant?.identity !== room.localParticipant.identity
      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sessionId: '',
          role: isAgent ? 'patient' : 'student',
          text,
          timestamp: new Date().toISOString(),
        },
      ])
    }
    room.on(RoomEvent.TranscriptionReceived, handler)
    return () => { room.off(RoomEvent.TranscriptionReceived, handler) }
  }, [room])

  const toggleMic = useCallback(async () => {
    const nextMuted = !isMuted
    await room.localParticipant.setMicrophoneEnabled(!nextMuted)
    setIsMuted(nextMuted)
  }, [room, isMuted])

  const handleLeave = useCallback(() => {
    room.disconnect()
    onLeave()
  }, [room, onLeave])

  const { patient } = details

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <RoomAudioRenderer />

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-blue-700">SimPatient</span>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">{patient.name}</span>
          <AgentStatePill state={state} />
        </div>
        <button
          onClick={handleLeave}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors"
        >
          End Session
        </button>
      </header>

      {/* Live status banner */}
      <SessionBanner patient={patient} state={state} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col overflow-y-auto">

          {/* Patient identity */}
          <div className="p-4 border-b border-gray-100 bg-blue-50">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Loaded Patient Profile</p>
            <p className="text-lg font-bold text-gray-900">{patient.name}</p>
            <p className="text-sm text-gray-600">{patient.age} y/o &middot; {patient.gender}</p>
          </div>

          {/* Clinical details */}
          <div className="p-4 flex flex-col gap-4 text-sm flex-1">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Chief Complaint</p>
              <p className="text-gray-900">{patient.chiefComplaint}</p>
            </div>

            {patient.vitalSigns && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vital Signs</p>
                <p className="text-gray-800 leading-relaxed">{patient.vitalSigns}</p>
              </div>
            )}

            {/* Microphone control */}
            <div className="mt-auto pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Microphone</p>
              <button
                onClick={toggleMic}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${isMuted
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                {isMuted ? 'Mic muted — tap to unmute' : 'Mic active — tap to mute'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main transcript area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Speak naturally — <strong className="text-gray-700">{patient.name}</strong> will respond in real time.
            </p>
            <span className="text-xs text-gray-400">{transcript.length} turn{transcript.length !== 1 ? 's' : ''}</span>
          </div>
          <TranscriptPanel entries={transcript} className="flex-1" />
        </main>
      </div>
    </div>
  )
}

// ── Page entry point ─────────────────────────────────────────────────────────

export function SessionPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [details, setDetails] = useState<TokenResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    api.token
      .create(patientId)
      .then(setDetails)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to connect'))
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading patient profile…</p>
      </div>
    )
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm w-full text-center">
          <p className="text-red-700 font-medium mb-1">Failed to start session</p>
          <p className="text-red-600 text-sm">{error ?? 'Unknown error'}</p>
        </div>
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">
          Return to patient list
        </button>
      </div>
    )
  }

  const goToReview = () => navigate(`/sessions/${details.sessionId}`)

  return (
    <LiveKitRoom
      serverUrl={details.url}
      token={details.token}
      connect
      audio
      video={false}
      onDisconnected={goToReview}
    >
      <SessionInner details={details} onLeave={goToReview} />
    </LiveKitRoom>
  )
}
