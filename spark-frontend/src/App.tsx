import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import RegisterBevestig from './pages/RegisterBevestig'
import ConfirmEmail from './pages/ConfirmEmail'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Instellingen from './pages/Instellingen'
import Klassen from './pages/Klassen'
import Vakken from './pages/Vakken'
import Opdrachten from './pages/Opdrachten'
import Analyse from './pages/Analyse'
import Admin from './pages/Admin'
import Modules from './pages/Modules'
import ChatApp from './ChatApp'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('error=access_denied') || hash.includes('error_code=otp_expired')) {
      if (location.pathname !== '/reset-password') {
        navigate('/reset-password' + hash, { replace: true })
        return
      }
    }
    setChecking(false)
  }, [navigate, location.pathname])

  if (checking) {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('error=')) {
      return null
    }
    setChecking(false)
  }

  return (
    <Routes>
      {/* Publieke routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/bevestig" element={<RegisterBevestig />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Chat — fullscreen, ZONDER DashboardLayout */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatApp />
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
                <Route path="/instellingen" element={<Instellingen />} />
                <Route path="/modules" element={<Modules />} />
                <Route path="/klassen" element={<Klassen />} />
                <Route path="/vakken" element={<Vakken />} />
                <Route path="/opdrachten" element={<Opdrachten />} />
                <Route path="/analyse" element={<Analyse />} />
                <Route path="/admin" element={<Admin />} />
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