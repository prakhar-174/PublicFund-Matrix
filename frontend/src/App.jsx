import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthContext'
import { FiscalYearProvider } from '@/store/FiscalYearContext'
import AuthGuard from '@/components/AuthGuard'
import AppShell from '@/components/layout/AppShell'

import LandingPage from '@/pages/Landing/LandingPage'
import LoginPage from '@/pages/Login/LoginPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import BudgetsPage from '@/pages/Budgets/BudgetsPage'
import BudgetDetailPage from '@/pages/Budgets/BudgetDetailPage'
import AnalyticsPage from '@/pages/Analytics/AnalyticsPage'
import OptimizerPage from '@/pages/Optimizer/OptimizerPage'
import UsersPage from '@/pages/Admin/UsersPage'
import ImportPage from '@/pages/Admin/ImportPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated Application Shell */}
        <Route element={<AuthGuard />}>
          <Route
            element={
              <FiscalYearProvider>
                <AppShell />
              </FiscalYearProvider>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="budgets/:deptId" element={<BudgetDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="optimizer" element={<OptimizerPage />} />

            {/* Admin-only Routes */}
            <Route element={<AuthGuard requiredRole="admin" />}>
              <Route path="admin/users" element={<UsersPage />} />
              <Route path="admin/import" element={<ImportPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
