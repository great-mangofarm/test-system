import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import TestCasesPage from './pages/TestCasesPage'
import QaGroupPage from './pages/QaGroupPage'
import AdminPage from './pages/AdminPage'
import DevRequestsPage from './pages/DevRequestsPage'
import { Toaster } from './components/ui/toaster'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

// 스태프는 메인 대신 개발요청 페이지로
function Home() {
  const { user } = useAuth()
  if (user?.role === 'staff') return <Navigate to="/requests" replace />
  return <HomePage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/requests" element={<RequireAuth><DevRequestsPage /></RequireAuth>} />
      <Route path="/products/:productId/suites/:suiteId" element={<RequireAuth><TestCasesPage /></RequireAuth>} />
      <Route path="/products/:productId/qa/:groupId" element={<RequireAuth><QaGroupPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
