import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Onboarding from '@/pages/Onboarding'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, needsOnboarding } = useAuth()

  // Laat recovery/error redirects door
  const hash = window.location.hash
  if (hash.includes('type=recovery') || hash.includes('error=access_denied') || hash.includes('error_code=')) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Blokkeer toegang tot app totdat naam is ingevuld
  if (needsOnboarding) {
    return <Onboarding />
  }

  return <>{children}</>
}