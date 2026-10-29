import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Standard React Class Error Boundary for capturing uncaught runtime render exceptions.
 * Renders a centered red alert with error description and a window reload button.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled component error:', error, errorInfo)
  }

  handleRetry = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] h-full w-full flex items-center justify-center p-6">
          <Alert className="max-w-md border-destructive/50 bg-destructive/10 text-destructive shadow-2xl p-6">
            <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
            <AlertTitle className="text-base font-bold text-white tracking-tight">
              Something went wrong
            </AlertTitle>
            <AlertDescription className="text-xs text-destructive/90 mt-2 space-y-4">
              <p className="font-mono bg-destructive/10 p-2.5 rounded border border-destructive/20 break-words">
                {this.state.error?.message || 'An unexpected rendering error occurred in the application view.'}
              </p>
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                  className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs flex items-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}

