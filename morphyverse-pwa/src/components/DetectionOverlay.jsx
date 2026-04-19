import { useEffect, useRef } from 'react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

export function DetectionOverlay({ imageBlob, detections }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!imageBlob) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const url = URL.createObjectURL(imageBlob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)

      detections?.forEach((det, di) => {
        const color = COLORS[di % COLORS.length]
        det.bboxes?.forEach(([x1, y1, x2, y2]) => {
          ctx.strokeStyle = color
          ctx.lineWidth = 3
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

          const label = `${det.name} ${Math.round(det.confidence * 100)}%`
          ctx.font = `bold ${Math.max(14, canvas.width / 50)}px sans-serif`
          const tw = ctx.measureText(label).width
          ctx.fillStyle = color
          ctx.fillRect(x1, y1 - 22, tw + 10, 22)
          ctx.fillStyle = '#fff'
          ctx.fillText(label, x1 + 5, y1 - 5)
        })
      })
    }
    img.src = url
  }, [imageBlob, detections])

  if (!imageBlob) return null

  return <canvas ref={canvasRef} className="w-full rounded-xl" />
}
