/**
 * useVoiceSession — thin wrapper around the LiveKit token + Room connection lifecycle.
 *
 * Used when you want to manage the connection outside the LiveKitRoom component tree
 * (e.g. pre-fetching connection details before rendering the room). The SessionPage
 * uses this hook to fetch the token and then hands the details off to <LiveKitRoom>.
 */
import { useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { TokenResponse } from '../types/patient'

type SessionState = 'idle' | 'connecting' | 'connected' | 'error'

export function useVoiceSession() {
  const [state, setState] = useState<SessionState>('idle')
  const [details, setDetails] = useState<TokenResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (patientId: string) => {
    setState('connecting')
    setError(null)
    try {
      const tokenResponse = await api.token.create(patientId)
      setDetails(tokenResponse)
      setState('connected')
      return tokenResponse
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect'
      setError(message)
      setState('error')
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setDetails(null)
    setError(null)
  }, [])

  return { state, details, error, connect, reset }
}
