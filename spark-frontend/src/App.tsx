import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ConfirmEmail from './pages/ConfirmEmail'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import ChatApp from './ChatApp'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const hash = window.location.hash

    // Vang Supabase recovery/error redirect op — ongeacht welke route
    if (hash.includes('type=recovery') || hash.includes('error=access_denied') || hash.includes('error_code=otp_expired')) {
      // Alleen redirecten als we nog NIET op /reset-password zijn
      if (location.pathname !== '/reset-password') {
        navigate('/reset-password' + hash, { replace: true })
        return
      }
    }

    setChecking(false)
  }, [navigate, location.pathname])

  if (checking) {
    // Even wachten tot hash-check klaar is
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('error=')) {
      return null // Niet renderen tijdens redirect
    }
    setChecking(false)
  }

  return (
    <Routes>
      {/* Publieke routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Chat — fullscreen, ZONDER DashboardLayout */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <div className="relative min-h-screen bg-[#0a0a1a]">
              {/* Terugknop naar Dashboard */}
              <button
                onClick={() => window.location.href = '/'}
                className="
                  fixed top-4 left-4 z-50
                  flex items-center gap-2 px-4 py-2
                  bg-[#0f1029]/90 backdrop-blur-sm
                  border border-white/10 rounded-xl
                  text-white/60 hover:text-white hover:border-white/20
                  transition-all duration-200 text-sm font-medium
                  shadow-lg
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Dashboard
              </button>
              <ChatApp />
            </div>
          </ProtectedRoute>
        }
      />

      {/* Alle andere beschermde routes MET DashboardLayout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}