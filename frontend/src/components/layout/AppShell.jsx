import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ErrorBoundary from '@/components/ErrorBoundary'

/**
 * Main application shell wrapping all authenticated and protected routes.
 * Features:
 * - Responsive Collapsible Sidebar (desktop) & Slide-in Drawer with Backdrop (mobile < lg)
 * - Sticky Topbar with FY Selector & Mobile Hamburger
 * - Main content area protected by ErrorBoundary
 * - Framer Motion page entrance transitions keyed on pathname
 */
export default function AppShell() {
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Desktop & Mobile Drawer Sidebar */}
      <Sidebar
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Global Topbar with Mobile Navigation Toggle */}
        <Topbar onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)} />

        {/* Independently Scrollable Main Content wrapped in ErrorBoundary */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="min-h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
