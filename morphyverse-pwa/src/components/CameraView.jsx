import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useCamera } from '../hooks/useCamera'

export const CameraView = forwardRef(function CameraView({ onReady, onError }, ref) {
  const { videoRef, startCamera, stopCamera, captureFrame } = useCamera()

  useImperativeHandle(ref, () => ({ captureFrame }), [captureFrame])

  useEffect(() => {
    startCamera()
      .then(() => onReady?.())
      .catch((err) => onError?.(err.message ?? 'Camera access denied'))
    return () => stopCamera()
  }, [])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  )
})
