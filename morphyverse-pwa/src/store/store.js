import { create } from 'zustand'

function fromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

export const useStore = create((set) => ({
  tables: fromStorage('mv_tables', []),
  inventory: fromStorage('mv_inventory', []),
  lastScanResult: null,

  setTables: (tables) => {
    try { localStorage.setItem('mv_tables', JSON.stringify(tables)) } catch {}
    set({ tables })
  },
  setInventory: (inventory) => {
    try { localStorage.setItem('mv_inventory', JSON.stringify(inventory)) } catch {}
    set({ inventory })
  },
  setLastScanResult: (lastScanResult) => set({ lastScanResult }),
}))
