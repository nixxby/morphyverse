import { useRef, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { BBoxAnnotator } from '../components/BBoxAnnotator'
import { registerObject } from '../api/client'

const STEPS = ['Capture', 'Crop', 'Name']

export default function Register() {
  const cameraRef = useRef(null)
  const annotatorRef = useRef(null)
  const [step, setStep] = useState(0)
  const [frameBlob, setFrameBlob] = useState(null)
  const [cropBlob, setCropBlob] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [cameraError, setCameraError] = useState(null)

  const reset = () => {
    setStep(0)
    setFrameBlob(null)
    setCropBlob(null)
    setName('')
    setError(null)
    setCameraError(null)
  }

  const handleCapture = async () => {
    const blob = await cameraRef.current?.captureFrame()
    if (blob) {
      setFrameBlob(blob)
      setStep(1)
    }
  }

  const handleCrop = async () => {
    const crop = await annotatorRef.current?.getCrop()
    if (crop) {
      setCropBlob(crop)
      setStep(2)
    }
  }

  const handleRegister = async () => {
    if (!name.trim() || !cropBlob) return
    setLoading(true)
    setError(null)
    try {
      const result = await registerObject(name.trim(), cropBlob)
      setSuccess(`"${result.name}" registered successfully!`)
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

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm text-center">
          {success}
        </div>
      )}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {/* Step 0: Capture */}
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

      {/* Step 1: Crop */}
      {step === 1 && frameBlob && (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm text-center">Draw a box around the object</p>
          <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden">
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

      {/* Step 2: Name */}
      {step === 2 && (
        <div className="space-y-3">
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
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-semibold text-sm border border-zinc-700"
            >
              Back
            </button>
            <button
              onClick={handleRegister}
              disabled={!name.trim() || loading}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Registering…' : 'Register'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
