import { useState } from 'react'
import { buildSystemPrompt } from '../lib/promptBuilder'

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
  patientFields: {
    name: string
    age: number | string
    sex: string
    chiefComplaint: string
    medicalHistory: string
    medications: string
    allergies: string
    vitalSigns: string
    personalityNotes: string
  }
}

export function SystemPromptEditor({ value, onChange, patientFields }: SystemPromptEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  const generated = buildSystemPrompt({
    ...patientFields,
    age: typeof patientFields.age === 'string' ? parseInt(patientFields.age) || 0 : patientFields.age,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          System Prompt
          <span className="ml-1 text-gray-400 font-normal">(leave blank to auto-generate)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((s) => !s)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showPreview ? 'Hide preview' : 'Preview auto-generated'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-gray-500 hover:underline"
            >
              Reset to auto
            </button>
          )}
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave blank to auto-generate from patient fields above..."
        rows={5}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />

      {showPreview && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Auto-generated preview:</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{generated}</pre>
        </div>
      )}
    </div>
  )
}
