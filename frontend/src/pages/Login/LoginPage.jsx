import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Landmark, Loader2, AlertCircle } from 'lucide-react'

import { useAuth } from '@/store/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data) => {
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await login(data)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Invalid email or password. Please try again.'
      setErrorMessage(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden px-4 py-8">
      {/* Three blurred drifting background orbs */}
      <motion.div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none"
        animate={{
          x: [0, 80, 0],
          y: [0, 60, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-accent-violet/5 blur-3xl pointer-events-none"
        animate={{
          x: [0, -70, 0],
          y: [0, 80, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-accent-emerald/5 blur-3xl pointer-events-none"
        animate={{
          x: [0, 60, 0],
          y: [0, -70, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      />

      {/* Centered login card */}
      <div className="relative z-10 w-full max-w-[420px] bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        {/* Top of card */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-3 shadow-inner">
            <Landmark className="w-8 h-8 text-accent-blue" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BudgetIQ</h1>
          <p className="text-sm text-slate-400 mt-1">
            Government Budget Allocation Analyzer
          </p>
        </div>

        {/* Error notification */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 overflow-hidden"
            >
              <Alert variant="destructive" className="bg-accent-red/10 border-accent-red/20 text-accent-red py-3">
                <AlertCircle className="h-4 w-4 text-accent-red" />
                <AlertDescription className="text-sm text-accent-red font-medium ml-2">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form fields */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="analyst@finance.gov"
              className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-accent-blue focus-visible:border-accent-blue"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-accent-red font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-slate-200">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-accent-blue focus-visible:border-accent-blue"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-accent-red font-medium">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-2">
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 inline-flex items-center justify-center rounded-lg bg-accent-blue text-white font-medium text-sm hover:bg-accent-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-60 transition-colors shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  )
}
