import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

/**
 * Main application shell wrapping all authenticated and protected routes.
 * Features collapsible sidebar, sticky topbar with FY selector, independent scroll area,
 * and Framer Motion page entrance animations.
 */
export default function AppShell() {
  const location = useLocation()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Collapsible Left Navigation */}
      <Sidebar />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Global Topbar */}
        <Topbar />

        {/* Independently Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
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
        </main>
      </div>
    </div>
  )
}
