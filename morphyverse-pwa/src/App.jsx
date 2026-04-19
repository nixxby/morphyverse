import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ScanMode from './pages/ScanMode'
import Register from './pages/Register'
import OutgoingLog from './pages/OutgoingLog'

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const NAV = [
  { to: '/', label: 'Inventory', Icon: GridIcon, end: true },
  { to: '/scan', label: 'Scan', Icon: ScanIcon },
  { to: '/register', label: 'Register', Icon: PlusIcon },
  { to: '/outgoing', label: 'Outgoing', Icon: ArrowUpIcon },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 max-w-lg mx-auto relative">
        <main className="min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<ScanMode />} />
            <Route path="/register" element={<Register />} />
            <Route path="/outgoing" element={<OutgoingLog />} />
          </Routes>
        </main>

        <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-center">
          <div className="w-full max-w-lg bg-zinc-900/95 backdrop-blur border-t border-zinc-800 flex">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-zinc-500'
                  }`
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </BrowserRouter>
  )
}
