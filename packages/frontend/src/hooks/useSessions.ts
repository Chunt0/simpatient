import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useSessions() {
  return useQuery({ queryKey: ['sessions'], queryFn: api.sessions.list })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api.sessions.get(id),
    enabled: !!id,
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.sessions.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
