import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
  info:     ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    // In production, send to error tracker (Sentry, etc.)
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen bg-page dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={36} className="text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            An unexpected error occurred. This has been logged automatically.
          </p>

          {/* Error details (dev only) */}
          {import.meta.env.DEV && this.state.error && (
            <details className="text-left mb-6">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
                Show error details
              </summary>
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs text-red-600
                overflow-auto max-h-40 text-left whitespace-pre-wrap">
                {this.state.error.message}
                {'\n\n'}
                {this.state.info?.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={14} /> Refresh page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null, info: null }); window.location.href = '/' }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700
                rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Home size={14} /> Go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
