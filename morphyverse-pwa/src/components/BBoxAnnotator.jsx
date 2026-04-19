import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { cropImageToBlob } from '../utils/imageUtils'

export const BBoxAnnotator = forwardRef(function BBoxAnnotator({ imageBlob }, ref) {
  const canvasRef = useRef(null)
  const rectRef = useRef(null)
  const drawingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const imgRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getCrop: async () => {
      const rect = rectRef.current
      if (!rect || !imageBlob) return null
      return cropImageToBlob(imageBlob, rect)
    },
  }))

  useEffect(() => {
    if (!imageBlob) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const url = URL.createObjectURL(imageBlob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      imgRef.current = img
      // Use natural image dimensions as canvas buffer — CSS scales display
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      rectRef.current = null
    }
    img.src = url
  }, [imageBlob])

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    }
  }

  const redraw = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imgRef.current
    if (!img) return
    ctx.drawImage(img, 0, 0)
    const r = rectRef.current
    if (r && r.w > 0 && r.h > 0) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = Math.max(2, canvas.width / 200)
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = 'rgba(34,197,94,0.12)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
  }

  const onDown = (e) => {
    e.preventDefault()
    const pos = getCanvasPos(e)
    startRef.current = pos
    drawingRef.current = true
    rectRef.current = null
  }

  const onMove = (e) => {
    e.preventDefault()
    if (!drawingRef.current) return
    const pos = getCanvasPos(e)
    rectRef.current = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    }
    redraw()
  }

  const onUp = (e) => {
    e.preventDefault()
    drawingRef.current = false
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full touch-none cursor-crosshair"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    />
  )
})
