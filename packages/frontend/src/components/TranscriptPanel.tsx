import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../types/patient'

interface TranscriptPanelProps {
  entries: TranscriptEntry[]
  className?: string
}

export function TranscriptPanel({ entries, className = '' }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-400 text-sm ${className}`}>
        Conversation will appear here...
      </div>
    )
  }

  return (
    <div className={`overflow-y-auto flex flex-col gap-3 p-4 ${className}`}>
      {entries.map((entry) => (
        <div
          key={entry.id ?? entry.timestamp}
          className={`flex ${entry.role === 'student' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
              entry.role === 'student'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}
          >
            <p className="font-medium text-xs mb-1 opacity-70">
              {entry.role === 'student' ? 'Student' : 'Patient'}
            </p>
            <p>{entry.text}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
