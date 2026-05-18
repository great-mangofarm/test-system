import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from './store/auth'
import LoginPage from './pages/LoginPage'
import ProductsPage from './pages/ProductsPage'
import SuitesPage from './pages/SuitesPage'
import TestCasesPage from './pages/TestCasesPage'
import { Toaster } from './components/ui/toaster'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><ProductsPage /></RequireAuth>} />
        <Route path="/products/:productId/suites" element={<RequireAuth><SuitesPage /></RequireAuth>} />
        <Route path="/products/:productId/suites/:suiteId" element={<RequireAuth><TestCasesPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
