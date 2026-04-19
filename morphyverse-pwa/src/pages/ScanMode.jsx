import { useRef, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { DetectionOverlay } from '../components/DetectionOverlay'
import { TableSelector } from '../components/TableSelector'
import { Toast } from '../components/Toast'
import { useScanLoop } from '../hooks/useScanLoop'
import { submitScan, createTable, getTables } from '../api/client'
import { useStore } from '../store/store'

export default function ScanMode() {
  const cameraRef = useRef(null)
  const [tableId, setTableId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const { lastScanResult, setLastScanResult, setTables } = useStore()

  // ── New-table form state ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('lab')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const handleCreateTable = async () => {
    if (!newLabel.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const id = crypto.randomUUID()
      await createTable({ id, label: newLabel.trim(), type: newType })
      const updated = await getTables()
      setTables(updated)
      setNewLabel('')
      setNewType('lab')
      setShowCreate(false)
      setTableId(id)           // auto-select the new table in the dropdown
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const doScan = async () => {
    if (!tableId || loading) return
    setLoading(true)
    setError(null)
    try {
      const blob = await cameraRef.current?.captureFrame()
      if (!blob) { setLoading(false); return }
      const result = await submitScan(tableId, blob)
      setLastScanResult({ ...result, imageBlob: blob })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useScanLoop({ enabled: scanning && !!tableId, intervalMs: 30000, onCapture: doScan })

  const toggleScan = () => {
    if (!scanning) {
      setScanning(true)
      setLastScanResult(null)
      setError(null)
      // Trigger first scan immediately
      setTimeout(doScan, 500)
    } else {
      setScanning(false)
      setLastScanResult(null)
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-white pt-2">Scan</h1>

      <Toast events={lastScanResult?.inventory_events} />

      {/* ── Table registration + selector ─────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Table</span>
          <button
            onClick={() => { setShowCreate((v) => !v); setCreateError(null) }}
            className="text-xs font-semibold text-emerald-400"
          >
            {showCreate ? 'Cancel' : '+ New Table'}
          </button>
        </div>

        {showCreate && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTable()}
              placeholder="Table name (e.g. Bench A)"
              className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            <div className="flex gap-2">
              {[['lab', 'Lab Table'], ['production', 'Production']].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-colors ${
                    newType === t
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {createError && <p className="text-red-400 text-xs">{createError}</p>}
            <button
              onClick={handleCreateTable}
              disabled={!newLabel.trim() || creating}
              className="w-full py-2 bg-emerald-500 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Table'}
            </button>
          </div>
        )}

        <TableSelector value={tableId} onChange={setTableId} />
      </div>

      {cameraError ? (
        <div className="aspect-video bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
          <p className="text-red-400 text-sm text-center px-4">{cameraError}</p>
        </div>
      ) : (
        <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden">
          <CameraView ref={cameraRef} onError={setCameraError} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {scanning && !loading && (
            <div className="absolute top-2 right-2 bg-red-500 rounded-full w-2.5 h-2.5 animate-pulse" />
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={toggleScan}
          disabled={!tableId || !!cameraError}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
            scanning
              ? 'bg-red-500 text-white'
              : 'bg-emerald-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500'
          }`}
        >
          {scanning ? 'Stop' : 'Start Scanning'}
        </button>
        {scanning && (
          <button
            onClick={doScan}
            disabled={loading}
            className="px-5 py-3 bg-zinc-800 text-white rounded-xl font-semibold text-sm border border-zinc-700 disabled:opacity-40"
          >
            Scan Now
          </button>
        )}
      </div>

      {lastScanResult && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Scan</h2>
            <span className="text-xs text-zinc-600">
              {lastScanResult.detections?.length ?? 0} object{lastScanResult.detections?.length !== 1 ? 's' : ''}
            </span>
          </div>
          <DetectionOverlay
            imageBlob={lastScanResult.imageBlob}
            detections={lastScanResult.detections}
          />
          {lastScanResult.detections?.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-2">No objects detected</p>
          )}
        </div>
      )}
    </div>
  )
}
