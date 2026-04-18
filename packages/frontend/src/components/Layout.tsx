import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
}

export function Layout({ children, title, actions }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-blue-700 hover:text-blue-800">
              SimPatient
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                to="/"
                className={`font-medium transition-colors ${
                  location.pathname === '/' ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Patients
              </Link>
              <Link
                to="/sessions"
                className={`font-medium transition-colors ${
                  location.pathname.startsWith('/sessions') ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sessions
              </Link>
            </nav>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {title && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
        )}
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
