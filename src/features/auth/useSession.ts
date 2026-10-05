import { useSyncExternalStore } from 'react'
import { useApi } from '../../app/apiContext'

export function useSession() {
  const { auth } = useApi()
  return useSyncExternalStore(auth.subscribe, auth.getSession, auth.getSession)
}
