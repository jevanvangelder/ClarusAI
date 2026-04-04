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
import KlasDetail from './pages/KlasDetail'
import Vakken from './pages/Vakken'
import VakDetail from './pages/VakDetail'
import StudentOpdrachtDetail from './pages/StudentOpdrachtDetail'
import StudentOpdrachtenOverzicht from './pages/StudentOpdrachtenOverzicht'
import Opdrachten from './pages/Opdrachten'
import Analyse from './pages/Analyse'
import Admin from './pages/Admin'
import Modules from './pages/Modules'
import ChatApp from './ChatApp'
import { useAuth } from './contexts/AuthContext'

function OpdrachtenRoute() {
  const { role } = useAuth()
  if (role === 'student') return <StudentOpdrachtenOverzicht />
  return <Opdrachten />
}

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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/bevestig" element={<RegisterBevestig />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatApp />
          </ProtectedRoute>
        }
      />

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
                <Route path="/klassen/:id" element={<KlasDetail />} />
                <Route path="/vakken" element={<Vakken />} />
                <Route path="/vakken/:id" element={<VakDetail />} />
                <Route path="/vakken/:id/opdracht/:assignmentId" element={<StudentOpdrachtDetail />} />
                <Route path="/opdrachten" element={<OpdrachtenRoute />} />
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