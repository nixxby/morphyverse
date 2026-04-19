import { useEffect, useRef } from 'react'

export function useScanLoop({ enabled, intervalMs = 30000, onCapture }) {
  const onCaptureRef = useRef(onCapture)
  onCaptureRef.current = onCapture

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => onCaptureRef.current?.(), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
