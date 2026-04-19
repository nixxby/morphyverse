export function ObjectCard({ name, count }) {
  return (
    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <span className="text-white text-sm font-medium truncate mr-3">{name}</span>
      <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full shrink-0">
        {count}
      </span>
    </div>
  )
}
