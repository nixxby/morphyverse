import { useRef, useState, useEffect } from 'react'
import { CameraView } from '../components/CameraView'
import { BBoxAnnotator } from '../components/BBoxAnnotator'
import { registerObject } from '../api/client'

const STEPS = ['Capture', 'Crop', 'Name']

export default function Register() {
  const cameraRef    = useRef(null)
  const annotatorRef = useRef(null)
  const [step, setStep]           = useState(0)
  const [frameBlob, setFrameBlob] = useState(null)
  const [crops, setCrops]         = useState([])     // accumulated crop blobs
  const [cropUrls, setCropUrls]   = useState([])     // object URLs for thumbnails
  const [name, setName]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const [cameraError, setCameraError] = useState(null)

  // Keep thumbnail URLs in sync with crops blobs
  useEffect(() => {
    const urls = crops.map((b) => URL.createObjectURL(b))
    setCropUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [crops])

  const reset = () => {
    setStep(0); setFrameBlob(null); setCrops([]); setName('')
    setError(null); setCameraError(null)
  }

  const handleCapture = async () => {
    const blob = await cameraRef.current?.captureFrame()
    if (blob) { setFrameBlob(blob); setStep(1) }
  }

  const handleCrop = async () => {
    const crop = await annotatorRef.current?.getCrop()
    if (crop) {
      setCrops((prev) => [...prev, crop])
      setStep(2)
    }
  }

  const handleAddAnother = () => {
    setFrameBlob(null)
    setCameraError(null)
    setStep(0)
  }

  const handleRegister = async () => {
    if (!name.trim() || crops.length === 0) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all(crops.map((crop) => registerObject(name.trim(), crop)))
      setSuccess(
        crops.length === 1
          ? `"${name.trim()}" registered!`
          : `"${name.trim()}" registered with ${crops.length} views!`
      )
      reset()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-white pt-2">Register Object</h1>

      {/* Step indicator */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 text-center">
            <div className={`h-1 rounded-full mb-1.5 transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
            <span className={`text-xs transition-colors ${i === step ? 'text-emerald-400 font-medium' : 'text-zinc-600'}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Crops count badge (shown in step 0/1 when returning for more views) */}
      {crops.length > 0 && step < 2 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 text-center">
          {crops.length} view{crops.length > 1 ? 's' : ''} saved — capture another angle
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm text-center">
          {success}
        </div>
      )}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {/* ── Step 0: Capture ── */}
      {step === 0 && (
        <div className="space-y-3">
          {cameraError ? (
            <div className="aspect-video bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <p className="text-red-400 text-sm px-4 text-center">{cameraError}</p>
            </div>
          ) : (
            <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden">
              <CameraView ref={cameraRef} onError={setCameraError} />
            </div>
          )}
          <button
            onClick={handleCapture}
            disabled={!!cameraError}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            Capture Photo
          </button>
        </div>
      )}

      {/* ── Step 1: Crop ── */}
      {step === 1 && frameBlob && (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm text-center">
            Zoom in if needed, then draw a box around the object
          </p>
          {/* Taller container so image fits without clipping */}
          <div className="h-80 bg-zinc-900 rounded-xl overflow-hidden">
            <BBoxAnnotator ref={annotatorRef} imageBlob={frameBlob} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(0)}
              className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-semibold text-sm border border-zinc-700"
            >
              Retake
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm"
            >
              Confirm Crop
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Name + multi-view ── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm text-center">What is this object called?</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            placeholder="e.g. 775 DC Motor"
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />

          {/* Captured crop thumbnails */}
          {cropUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-zinc-500 text-xs">
                {cropUrls.length} view{cropUrls.length > 1 ? 's' : ''} captured
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cropUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900"
                  >
                    <img src={url} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[10px] text-zinc-300 py-0.5">
                      View {i + 1}
                    </div>
                    {/* Remove single view */}
                    <button
                      onClick={() => setCrops((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full text-zinc-300 text-[10px] flex items-center justify-center leading-none"
                      title="Remove this view"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add another view button */}
          <button
            onClick={handleAddAnother}
            className="w-full py-2.5 bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-sm border border-zinc-700 border-dashed"
          >
            + Add Another View
          </button>

          {/* Register */}
          <button
            onClick={handleRegister}
            disabled={!name.trim() || crops.length === 0 || loading}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {loading
              ? 'Registering…'
              : crops.length > 1
              ? `Register (${crops.length} views)`
              : 'Register'}
          </button>
        </div>
      )}
    </div>
  )
}
