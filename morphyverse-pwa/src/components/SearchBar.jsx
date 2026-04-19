import { useEffect, useRef, useState } from 'react'
import { locateObject } from '../api/client'

function timeStr(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await locateObject(query.trim()))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [query])

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search objects…"
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {results !== null && (
        <div className="mt-2 space-y-1">
          {results.length === 0 ? (
            <p className="text-zinc-500 text-sm px-1 py-2">Not on any table — check central storage</p>
          ) : (
            results.map((r) => (
              <div key={r.object_id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm font-medium">{r.object_name}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">{r.table_label} · {r.count} units</p>
                  </div>
                  <p className="text-zinc-500 text-xs">{timeStr(r.last_seen)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
