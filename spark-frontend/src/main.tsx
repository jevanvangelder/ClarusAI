import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary"
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import "@github/spark/spark"

import ChatApp from './ChatApp.tsx'
import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import ConfirmEmail from './pages/ConfirmEmail.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatApp />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)