import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './useSession'
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession(); const location = useLocation()
  return session ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}
