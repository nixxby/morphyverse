const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export async function getTables() {
  return request('/api/tables')
}

export async function createTable({ id, label, type }) {
  return request('/api/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, label, type }),
  })
}

export async function getInventory() {
  return request('/api/inventory')
}

export async function locateObject(name) {
  return request(`/api/inventory/locate?name=${encodeURIComponent(name)}`)
}

export async function getOutgoingLog() {
  return request('/api/inventory/outgoing')
}

export async function submitScan(tableId, jpegBlob) {
  const form = new FormData()
  form.append('table_id', tableId)
  form.append('image', jpegBlob, 'scan.jpg')
  return request('/api/scan', { method: 'POST', body: form })
}

export async function registerObject(objectName, cropBlob) {
  const form = new FormData()
  form.append('object_name', objectName)
  form.append('crop', cropBlob, 'crop.jpg')
  return request('/api/register', { method: 'POST', body: form })
}
