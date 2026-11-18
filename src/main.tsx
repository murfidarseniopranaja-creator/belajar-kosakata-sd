import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

type BoundaryState = { error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Aplikasi gagal dirender:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const message = this.state.error.message || 'Terjadi kesalahan yang tidak diketahui.'
      return (
        <main role="alert" style={{ maxWidth: 640, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#25334A' }}>
          <h1>Aplikasi mengalami kendala</h1>
          <p>Pesan error: {message}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 18px', borderRadius: 12, border: 0, background: '#32875D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            Muat Ulang
          </button>
        </main>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  document.body.innerHTML = '<p style="font-family:system-ui;padding:2rem">Elemen root aplikasi tidak ditemukan. Muat ulang halaman.</p>'
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </StrictMode>,
  )
}
