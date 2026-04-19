import { useStore } from '../store/store'

export function TableSelector({ value, onChange }) {
  const tables = useStore((s) => s.tables)

  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="" disabled>Select a table…</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.type})
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">▾</div>
    </div>
  )
}
