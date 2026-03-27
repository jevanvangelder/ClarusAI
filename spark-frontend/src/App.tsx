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

      {/* Beschermde routes met Dashboard layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/chat" element={<ChatApp />} />
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