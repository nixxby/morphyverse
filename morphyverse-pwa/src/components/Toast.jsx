import { useEffect, useRef, useState } from 'react'

const LABEL = {
  checkout: (e) => `📤 ${e.object_name} checked out`,
  return: (e) => `📥 ${e.object_name} returned`,
  consumed: (e) => `🔧 ${e.object_name} consumed`,
}

export function Toast({ events }) {
  const [items, setItems] = useState([])
  const prevRef = useRef(null)

  useEffect(() => {
    if (!events?.length || events === prevRef.current) return
    prevRef.current = events

    const newItems = events.map((e) => ({
      id: Math.random().toString(36).slice(2),
      text: LABEL[e.event_type]?.(e) ?? e.event_type,
    }))

    setItems((prev) => [...prev, ...newItems])
    newItems.forEach(({ id }) => {
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000)
    })
  }, [events])

  if (!items.length) return null

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((i) => (
        <div
          key={i.id}
          className="bg-zinc-800 border border-zinc-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl max-w-xs w-full text-center"
        >
          {i.text}
        </div>
      ))}
    </div>
  )
}
