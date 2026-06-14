import { Routes, Route, Link, useLocation } from 'react-router-dom'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import CreateCase from './pages/CreateCase'
import LiveFeed from './components/LiveFeed'

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg tracking-tight">
            ◎ Cases API
          </Link>
          <span className="text-gray-400 text-xs font-mono">demo-org / demo-tenant</span>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link
            to="/"
            className={`hover:text-white ${location.pathname === '/' ? 'text-white' : 'text-gray-400'}`}
          >
            Cases
          </Link>
          <Link
            to="/cases/new"
            className={`hover:text-white ${location.pathname === '/cases/new' ? 'text-white' : 'text-gray-400'}`}
          >
            + New Case
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<CaseList />} />
            <Route path="/cases/new" element={<CreateCase />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
          </Routes>
        </main>

        <aside className="w-80 border-l bg-white overflow-auto flex-shrink-0">
          <LiveFeed />
        </aside>
      </div>
    </div>
  )
}
