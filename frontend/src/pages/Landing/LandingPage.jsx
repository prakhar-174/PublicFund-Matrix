import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, animate } from 'framer-motion'
import {
  Landmark,
  Sparkles,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Crosshair,
  Sliders,
  AlertTriangle,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function StatCounter({ targetValue, formatFn, label, inView, prefersReduced }) {
  const [display, setDisplay] = useState(() => formatFn(prefersReduced ? targetValue : 0))

  useEffect(() => {
    if (!inView || prefersReduced) return

    const controls = animate(0, targetValue, {
      duration: 1.6,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(formatFn(latest)),
    })

    return () => controls.stop()
  }, [inView, targetValue, formatFn, prefersReduced])

  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-3xl lg:text-4xl font-bold tabular-nums text-accent-blue tracking-tight">
        {display}
      </span>
      <span className="text-sm text-slate-400 mt-1">{label}</span>
    </div>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const listener = (e) => setPrefersReduced(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Section Refs for in-view animations
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' })

  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })

  const howItWorksRef = useRef(null)
  const howItWorksInView = useInView(howItWorksRef, { once: true, margin: '-80px' })

  const ctaRef = useRef(null)
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' })

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const features = [
    {
      icon: BarChart3,
      color: 'text-accent-blue',
      title: 'Visual Budget Analysis',
      description: 'Interactive treemaps and bar charts reveal allocation patterns at a glance',
    },
    {
      icon: TrendingUp,
      color: 'text-accent-emerald',
      title: 'Year-over-Year Comparison',
      description: 'Track how each department’s budget and spending has evolved across fiscal years',
    },
    {
      icon: Crosshair,
      color: 'text-accent-violet',
      title: 'Performance Scoring',
      description: 'Score departments on outcomes relative to spend and surface underperformers',
    },
    {
      icon: Sliders,
      color: 'text-accent-amber',
      title: 'AI-Powered Optimizer',
      description: 'Generate data-driven reallocation recommendations with one click',
    },
    {
      icon: AlertTriangle,
      color: 'text-accent-red',
      title: 'Underfunding Alerts',
      description: 'Automatically flag departments where requested funding significantly exceeds allocation',
    },
    {
      icon: Upload,
      color: 'text-accent-blue',
      title: 'CSV & Excel Import',
      description: 'Bulk-import budget data from existing spreadsheets — no manual entry',
    },
  ]

  const steps = [
    {
      step: '1',
      title: 'Import your data',
      description: 'Upload existing budget spreadsheets or connect your department data directly through the admin panel',
    },
    {
      step: '2',
      title: 'Analyze & compare',
      description: 'Explore interactive charts, performance scores, and year-over-year trends across every department',
    },
    {
      step: '3',
      title: 'Optimize & report',
      description: 'Run the allocation optimizer, review AI-generated recommendations, and export reports for stakeholders',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Three background gradient orbs drifting slowly */}
      <motion.div
        aria-hidden="true"
        className="absolute top-12 -left-20 w-[550px] h-[550px] rounded-full bg-accent-blue/[0.08] blur-[120px] pointer-events-none -z-10"
        animate={prefersReduced ? {} : { x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute top-28 -right-20 w-[500px] h-[500px] rounded-full bg-accent-violet/[0.06] blur-[120px] pointer-events-none -z-10"
        animate={prefersReduced ? {} : { x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent-emerald/[0.05] blur-[120px] pointer-events-none -z-10"
        animate={prefersReduced ? {} : { x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Navbar */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-800 py-3.5 shadow-lg shadow-black/40'
            : 'bg-transparent py-5'
        )}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-accent-blue group-hover:border-accent-blue/50 transition-colors">
              <Landmark className="w-[22px] h-[22px] text-accent-blue" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">BudgetIQ</span>
          </Link>

          <Link to="/login">
            <motion.button
              type="button"
              whileHover={prefersReduced ? {} : { scale: 1.02 }}
              whileTap={prefersReduced ? {} : { scale: 0.97 }}
              className="border border-slate-700 text-slate-300 hover:border-accent-blue hover:text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
            >
              Sign In
            </motion.button>
          </Link>
        </div>
      </header>

      {/* Section 1 — Hero */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 px-6 text-center max-w-7xl mx-auto relative z-10">
        {/* Eyebrow Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: prefersReduced ? 0 : 0 }}
          className="inline-flex items-center gap-1.5 border border-accent-blue/30 bg-accent-blue/10 text-accent-blue text-xs font-medium px-3.5 py-1 rounded-full mb-8 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Government Financial Intelligence</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: prefersReduced ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: prefersReduced ? 0 : 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto"
        >
          <span>Smarter Budget Allocation</span>
          <span
            className="block mt-2"
            style={{
              background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            for Public Good
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: prefersReduced ? 0 : 0.2 }}
          className="text-lg text-slate-400 max-w-xl mx-auto mt-6 leading-relaxed"
        >
          Analyze departmental spending, compare historical budgets, and generate data-driven
          allocation recommendations — all in one secure platform.
        </motion.p>

        {/* CTA Buttons Row */}
        <motion.div
          initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: prefersReduced ? 0 : 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/login" className="w-full sm:w-auto">
            <motion.button
              type="button"
              whileHover={prefersReduced ? {} : { scale: 1.03 }}
              whileTap={prefersReduced ? {} : { scale: 0.98 }}
              className="w-full sm:w-auto bg-accent-blue hover:bg-blue-600 text-white font-medium px-8 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-colors"
            >
              <span>Get Started</span>
              <ArrowRight className="w-[18px] h-[18px]" />
            </motion.button>
          </Link>

          <button
            type="button"
            onClick={scrollToHowItWorks}
            className="w-full sm:w-auto text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-8 py-3 rounded-lg font-medium transition-colors"
          >
            See How It Works
          </button>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: prefersReduced ? 0 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 24,
            delay: prefersReduced ? 0 : 0.4,
          }}
          className="mt-16 max-w-5xl mx-auto w-full rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/80 overflow-hidden text-left"
          style={{ boxShadow: '0 -20px 80px -20px rgba(59,130,246,0.15)' }}
        >
          {/* Mockup Window Chrome Header */}
          <div className="h-8 bg-slate-800 flex items-center px-3.5 gap-1.5 border-b border-slate-750">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="mx-auto text-[11px] text-slate-400 font-mono flex items-center gap-1.5 opacity-75">
              <span>https://budgetiq.gov/dashboard</span>
            </div>
          </div>

          {/* Abstract Dashboard SVG Illustration */}
          <div className="p-6 bg-slate-950/70">
            <svg
              viewBox="0 0 960 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
            >
              {/* Row of 4 KPI cards */}
              <g id="kpi-cards">
                {/* Card 1 */}
                <rect x="0" y="0" width="225" height="80" rx="8" fill="#1E293B" stroke="#334155" />
                <circle cx="20" cy="24" r="4" fill="#3B82F6" />
                <rect x="32" y="20" width="70" height="8" rx="4" fill="#94A3B8" opacity="0.8" />
                <rect x="20" y="44" width="110" height="14" rx="4" fill="#FFFFFF" />
                <rect x="150" y="46" width="55" height="10" rx="3" fill="#10B981" opacity="0.3" />

                {/* Card 2 */}
                <rect x="245" y="0" width="225" height="80" rx="8" fill="#1E293B" stroke="#334155" />
                <circle cx="265" cy="24" r="4" fill="#10B981" />
                <rect x="277" y="20" width="80" height="8" rx="4" fill="#94A3B8" opacity="0.8" />
                <rect x="265" y="44" width="95" height="14" rx="4" fill="#FFFFFF" />
                <rect x="395" y="46" width="55" height="10" rx="3" fill="#10B981" opacity="0.3" />

                {/* Card 3 */}
                <rect x="490" y="0" width="225" height="80" rx="8" fill="#1E293B" stroke="#334155" />
                <circle cx="510" cy="24" r="4" fill="#F59E0B" />
                <rect x="522" y="20" width="75" height="8" rx="4" fill="#94A3B8" opacity="0.8" />
                <rect x="510" y="44" width="105" height="14" rx="4" fill="#FFFFFF" />
                <rect x="640" y="46" width="55" height="10" rx="3" fill="#F59E0B" opacity="0.3" />

                {/* Card 4 */}
                <rect x="735" y="0" width="225" height="80" rx="8" fill="#1E293B" stroke="#334155" />
                <circle cx="755" cy="24" r="4" fill="#8B5CF6" />
                <rect x="767" y="20" width="65" height="8" rx="4" fill="#94A3B8" opacity="0.8" />
                <rect x="755" y="44" width="85" height="14" rx="4" fill="#FFFFFF" />
                <rect x="885" y="46" width="55" height="10" rx="3" fill="#3B82F6" opacity="0.3" />
              </g>

              {/* Main Visuals Row: Treemap (left) and Bar Chart (right) */}
              {/* Treemap Container */}
              <g id="treemap-section">
                <rect x="0" y="105" width="580" height="375" rx="8" fill="#1E293B" stroke="#334155" />
                <text x="20" y="135" fill="#FFFFFF" fontSize="13" fontWeight="600" fontFamily="sans-serif">
                  Department Allocation Treemap
                </text>
                <text x="20" y="152" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
                  Distribution by budget volume
                </text>

                {/* Treemap Subdivisions using accent palette */}
                <rect x="20" y="170" width="310" height="170" rx="4" fill="#3B82F6" opacity="0.85" />
                <text x="35" y="195" fill="#FFFFFF" fontSize="12" fontWeight="600">Health & Family Welfare</text>
                <text x="35" y="215" fill="#FFFFFF" fontSize="11" opacity="0.85">₹89,287 Cr · 94%</text>

                <rect x="340" y="170" width="220" height="90" rx="4" fill="#10B981" opacity="0.85" />
                <text x="355" y="195" fill="#FFFFFF" fontSize="11" fontWeight="600">Education</text>
                <text x="355" y="212" fill="#FFFFFF" fontSize="10" opacity="0.85">₹42,500 Cr · 98%</text>

                <rect x="340" y="270" width="105" height="70" rx="4" fill="#8B5CF6" opacity="0.85" />
                <text x="350" y="292" fill="#FFFFFF" fontSize="10" fontWeight="600">Transport</text>
                <text x="350" y="306" fill="#FFFFFF" fontSize="9" opacity="0.85">₹21,000 Cr</text>

                <rect x="455" y="270" width="105" height="70" rx="4" fill="#F59E0B" opacity="0.85" />
                <text x="465" y="292" fill="#FFFFFF" fontSize="10" fontWeight="600">Agriculture</text>
                <text x="465" y="306" fill="#FFFFFF" fontSize="9" opacity="0.85">₹18,400 Cr</text>

                <rect x="20" y="350" width="220" height="110" rx="4" fill="#EF4444" opacity="0.75" />
                <text x="35" y="375" fill="#FFFFFF" fontSize="11" fontWeight="600">Rural Development</text>
                <text x="35" y="392" fill="#FFFFFF" fontSize="10" opacity="0.85">₹34,100 Cr · Deficit</text>

                <rect x="250" y="350" width="310" height="110" rx="4" fill="#334155" stroke="#475569" />
                <text x="265" y="375" fill="#94A3B8" fontSize="11" fontWeight="600">Energy & Infrastructure</text>
                <text x="265" y="392" fill="#94A3B8" fontSize="10">₹29,800 Cr · Balanced</text>
              </g>

              {/* Bar Chart Container (right) */}
              <g id="barchart-section">
                <rect x="600" y="105" width="360" height="375" rx="8" fill="#1E293B" stroke="#334155" />
                <text x="620" y="135" fill="#FFFFFF" fontSize="13" fontWeight="600" fontFamily="sans-serif">
                  Spending Progression
                </text>
                <text x="620" y="152" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
                  Monthly actuals vs allocation
                </text>

                {/* Grid lines */}
                <line x1="620" y1="200" x2="940" y2="200" stroke="#334155" strokeDasharray="3 3" />
                <line x1="620" y1="260" x2="940" y2="260" stroke="#334155" strokeDasharray="3 3" />
                <line x1="620" y1="320" x2="940" y2="320" stroke="#334155" strokeDasharray="3 3" />
                <line x1="620" y1="380" x2="940" y2="380" stroke="#334155" strokeDasharray="3 3" />
                <line x1="620" y1="440" x2="940" y2="440" stroke="#475569" />

                {/* Vertical bars in accent-blue */}
                <rect x="635" y="340" width="22" height="100" rx="3" fill="#3B82F6" opacity="0.6" />
                <rect x="670" y="300" width="22" height="140" rx="3" fill="#3B82F6" opacity="0.7" />
                <rect x="705" y="270" width="22" height="170" rx="3" fill="#3B82F6" opacity="0.8" />
                <rect x="740" y="230" width="22" height="210" rx="3" fill="#3B82F6" opacity="0.85" />
                <rect x="775" y="210" width="22" height="230" rx="3" fill="#3B82F6" />
                <rect x="810" y="190" width="22" height="250" rx="3" fill="#3B82F6" />
                <rect x="845" y="220" width="22" height="220" rx="3" fill="#3B82F6" opacity="0.85" />
                <rect x="880" y="250" width="22" height="190" rx="3" fill="#3B82F6" opacity="0.75" />
                <rect x="915" y="280" width="22" height="160" rx="3" fill="#3B82F6" opacity="0.65" />
              </g>
            </svg>
          </div>
        </motion.div>
      </section>

      {/* Section 2 — Stats Bar */}
      <section
        ref={statsRef}
        className="w-full bg-slate-900 border-y border-slate-800 py-10 relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          <StatCounter
            targetValue={2.4}
            formatFn={(v) => `₹${v.toFixed(1)}T+`}
            label="Budgets analyzed"
            inView={statsInView}
            prefersReduced={prefersReduced}
          />
          <StatCounter
            targetValue={150}
            formatFn={(v) => `${Math.floor(v)}+`}
            label="Government departments"
            inView={statsInView}
            prefersReduced={prefersReduced}
          />
          <StatCounter
            targetValue={98.2}
            formatFn={(v) => `${v.toFixed(1)}%`}
            label="Allocation accuracy"
            inView={statsInView}
            prefersReduced={prefersReduced}
          />
          <StatCounter
            targetValue={3}
            formatFn={(v) => `${Math.floor(v)}× faster`}
            label="Reporting vs. manual"
            inView={statsInView}
            prefersReduced={prefersReduced}
          />
        </div>
      </section>

      {/* Section 3 — Features */}
      <section ref={featuresRef} className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Everything your finance team needs
          </h2>
          <p className="text-slate-400 mt-3 text-base">
            Engineered specifically for public sector budgeting, departmental oversight, and policy execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14 max-w-6xl mx-auto">
          {features.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.45,
                  delay: prefersReduced ? 0 : index * 0.07,
                  ease: 'easeOut',
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors hover:shadow-lg hover:shadow-blue-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-5">
                    <Icon className={cn('w-6 h-6', item.color)} />
                  </div>
                  <h3 className="text-lg font-semibold text-white tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Section 4 — How It Works */}
      <section
        id="how-it-works"
        ref={howItWorksRef}
        className="py-24 px-6 max-w-7xl mx-auto relative z-10"
      >
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Up and running in three steps
          </h2>
          <p className="text-slate-400 mt-3 text-base">
            Seamless onboarding designed to turn raw departmental financial records into actionable intelligence.
          </p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-6xl mx-auto">
          {/* Connector Line (Desktop Only) */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-5 left-[16%] right-[16%] border-t border-dashed border-slate-700 -z-0"
          />

          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: prefersReduced ? 0 : index * 0.12,
                ease: 'easeOut',
              }}
              className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left bg-slate-900/40 md:bg-transparent p-6 md:p-0 rounded-xl md:rounded-none border border-slate-800/60 md:border-none"
            >
              <div className="w-10 h-10 rounded-full bg-accent-blue/15 border border-accent-blue/30 text-accent-blue font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-white mt-5">
                {item.title}
              </h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section 5 — CTA Footer Banner */}
      <section
        ref={ctaRef}
        className="w-full bg-gradient-to-r from-accent-blue/10 via-accent-violet/10 to-accent-emerald/10 border-y border-slate-800 py-20 text-center px-6 relative z-10"
      >
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
          >
            Ready to bring clarity to public spending?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={ctaInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: prefersReduced ? 0 : 0.1 }}
            className="text-slate-400 mt-4 text-base max-w-lg mx-auto leading-relaxed"
          >
            Empower your finance directors and department analysts with intelligent allocation insights and scenario modeling.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: prefersReduced ? 0 : 0.2 }}
            className="mt-8"
          >
            <Link to="/login">
              <motion.button
                type="button"
                whileHover={prefersReduced ? {} : { scale: 1.03 }}
                whileTap={prefersReduced ? {} : { scale: 0.98 }}
                className="bg-accent-blue hover:bg-blue-600 text-white font-medium px-10 py-4 text-base rounded-lg transition-colors shadow-xl shadow-blue-500/25"
              >
                Sign In to BudgetIQ
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2 px-6">
        <Landmark className="w-4 h-4 text-accent-blue/70" />
        <span>© 2026 BudgetIQ. Built for government transparency.</span>
      </footer>
    </div>
  )
}
