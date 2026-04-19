import { useEffect } from 'react'
import { getTables, getInventory } from '../api/client'
import { useStore } from '../store/store'
import { ObjectCard } from '../components/ObjectCard'
import { SearchBar } from '../components/SearchBar'

export default function Dashboard() {
  const { tables, inventory, setTables, setInventory } = useStore()

  useEffect(() => {
    const load = async () => {
      try {
        const [t, inv] = await Promise.all([getTables(), getInventory()])
        setTables(t)
        setInventory(inv)
      } catch (e) {
        console.warn('Dashboard: using cached data', e.message)
      }
    }
    load()
    const id = setInterval(async () => {
      try { setInventory(await getInventory()) } catch {}
    }, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-xl font-bold text-white pt-2">Inventory</h1>

      <SearchBar />

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Objects ({inventory.length})
        </h2>
        {inventory.length === 0 ? (
          <p className="text-zinc-600 text-sm">No inventory data — connect to server</p>
        ) : (
          <div className="space-y-2">
            {inventory.map((obj) => (
              <ObjectCard key={obj.object_id} name={obj.name} count={obj.count} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Tables ({tables.length})
        </h2>
        {tables.length === 0 ? (
          <p className="text-zinc-600 text-sm">No tables configured</p>
        ) : (
          <div className="space-y-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <span className="text-white text-sm">{t.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.type === 'lab'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}
                >
                  {t.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
