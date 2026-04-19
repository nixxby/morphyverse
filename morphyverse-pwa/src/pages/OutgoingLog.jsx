import { useEffect, useState } from 'react'
import { getOutgoingLog } from '../api/client'

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function OutgoingLog() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOutgoingLog()
      .then((data) =>
        setLog([...data].sort((a, b) => new Date(b.disappeared_at) - new Date(a.disappeared_at)))
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-white pt-2">Outgoing Log</h1>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {!loading && !error && log.length === 0 && (
        <p className="text-zinc-600 text-sm text-center py-12">No outgoing parts yet</p>
      )}

      <div className="space-y-2">
        {log.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.object_name}</p>
                <p className="text-zinc-400 text-xs mt-0.5 truncate">{item.table_label}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-emerald-400 text-sm font-bold">×{item.quantity}</p>
                <p className="text-zinc-500 text-xs">{relativeTime(item.disappeared_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
