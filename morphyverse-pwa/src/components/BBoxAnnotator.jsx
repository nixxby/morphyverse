import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Line, Rect } from 'react-konva'
import { cropImageToBlob, polygonCropToBlob } from '../utils/imageUtils'

const MAGNIFIER_SIZE = 130
const MAGNIFIER_ZOOM = 4
const VERTEX_R = 10      // vertex hit radius in stage px
const CLOSE_DIST = 22    // px distance to snap-close polygon

export const BBoxAnnotator = forwardRef(function BBoxAnnotator({ imageBlob }, ref) {
  const containerRef = useRef(null)
  const magnifierRef = useRef(null)
  const imgRef = useRef(null)
  const scaleRef = useRef(1)
  const drawingRectRef = useRef(false)
  const rectStartRef = useRef({ x: 0, y: 0 })

  const [img, setImg] = useState(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [mode, setMode] = useState('rect')

  // rect state (stage coords)
  const [rect, setRect] = useState(null)

  // polygon state (stage coords)
  const [points, setPoints] = useState([])
  const [closed, setClosed] = useState(false)

  // magnifier: {stageX, stageY, top, left} | null
  const [magnifier, setMagnifier] = useState(null)

  // Expose getCrop() to parent (Register.jsx)
  useImperativeHandle(ref, () => ({
    getCrop: () => {
      const sc = scaleRef.current
      if (!imageBlob) return Promise.resolve(null)
      if (mode === 'rect') {
        if (!rect || rect.w < 4) return Promise.resolve(null)
        return cropImageToBlob(imageBlob, {
          x: rect.x / sc, y: rect.y / sc,
          w: rect.w / sc, h: rect.h / sc,
        })
      }
      if (points.length < 3 || !closed) return Promise.resolve(null)
      return polygonCropToBlob(imageBlob, points.map((p) => ({ x: p.x / sc, y: p.y / sc })))
    },
  }))

  // Load image from blob
  useEffect(() => {
    if (!imageBlob) return
    const image = new window.Image()
    const url = URL.createObjectURL(imageBlob)
    image.onload = () => {
      URL.revokeObjectURL(url)
      imgRef.current = image
      setImg(image)
      setRect(null); setPoints([]); setClosed(false); setMagnifier(null)
    }
    image.onerror = () => URL.revokeObjectURL(url)
    image.src = url
  }, [imageBlob])

  // Compute Stage dimensions from container + image aspect ratio
  useLayoutEffect(() => {
    if (!img || !containerRef.current) return
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      const w = el.offsetWidth
      if (!w) return
      const h = Math.round(w * (img.naturalHeight / img.naturalWidth))
      scaleRef.current = w / img.naturalWidth
      setStageSize({ width: w, height: h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [img])

  // Draw into magnifier canvas whenever magnifier position changes
  useEffect(() => {
    const mc = magnifierRef.current
    if (!magnifier || !mc || !imgRef.current) return
    const sc = scaleRef.current
    mc.width = MAGNIFIER_SIZE
    mc.height = MAGNIFIER_SIZE
    const ctx = mc.getContext('2d')

    // Source region in natural image coordinates
    const imgX = magnifier.stageX / sc
    const imgY = magnifier.stageY / sc
    const srcW = MAGNIFIER_SIZE / MAGNIFIER_ZOOM
    const srcH = MAGNIFIER_SIZE / MAGNIFIER_ZOOM

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE)
    ctx.drawImage(imgRef.current, imgX - srcW / 2, imgY - srcH / 2, srcW, srcH, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE)

    // Crosshair
    ctx.strokeStyle = 'rgba(34,197,94,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(MAGNIFIER_SIZE / 2, 6);  ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE - 6)
    ctx.moveTo(6, MAGNIFIER_SIZE / 2);  ctx.lineTo(MAGNIFIER_SIZE - 6, MAGNIFIER_SIZE / 2)
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#22c55e'
    ctx.fill()
  }, [magnifier])

  // Compute magnifier position (in container-relative CSS px) from a stage coordinate
  const getMagnifier = (stageX, stageY) => {
    const cRect = containerRef.current.getBoundingClientRect()
    // stage top-left in viewport; stageX/Y are stage coords === CSS px within stage
    const relX = stageX
    const relY = stageY
    return {
      stageX, stageY,
      top: Math.max(4, relY - MAGNIFIER_SIZE - 18),
      left: Math.max(4, Math.min(relX - MAGNIFIER_SIZE / 2, stageSize.width - MAGNIFIER_SIZE - 4)),
    }
  }

  const getPos = (e) => e.target.getStage().getPointerPosition()

  // True if the click target is the Stage background or the image (not a shape)
  const isBackground = (e) => {
    const cls = e.target.getClassName()
    return cls === 'Image' || e.target === e.target.getStage()
  }

  // ── Stage event handlers ────────────────────────────────────────────────────

  const onStageDown = (e) => {
    if (!isBackground(e)) return
    const pos = getPos(e)
    if (mode === 'rect') {
      drawingRectRef.current = true
      rectStartRef.current = pos
      setRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
    }
  }

  const onStageMove = (e) => {
    if (mode !== 'rect' || !drawingRectRef.current) return
    const pos = getPos(e)
    const sx = rectStartRef.current.x, sy = rectStartRef.current.y
    setRect({ x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w: Math.abs(pos.x - sx), h: Math.abs(pos.y - sy) })
    setMagnifier(getMagnifier(pos.x, pos.y))
  }

  const onStageUp = () => {
    drawingRectRef.current = false
    setMagnifier(null)
  }

  const onStageClick = (e) => {
    if (mode !== 'polygon' || closed || !isBackground(e)) return
    const pos = getPos(e)

    // Snap to first point if close enough → close polygon
    if (points.length >= 3) {
      const dx = pos.x - points[0].x
      const dy = pos.y - points[0].y
      if (Math.sqrt(dx * dx + dy * dy) < CLOSE_DIST) {
        setClosed(true)
        return
      }
    }
    setPoints((prev) => [...prev, pos])
  }

  // ── Vertex drag handlers (polygon) ─────────────────────────────────────────

  const onVertexDragMove = (e, i) => {
    const pos = { x: e.target.x(), y: e.target.y() }
    setPoints((prev) => prev.map((p, idx) => (idx === i ? pos : p)))
    setMagnifier(getMagnifier(pos.x, pos.y))
  }

  const onVertexDragEnd = () => setMagnifier(null)

  // ── Mode switch ─────────────────────────────────────────────────────────────

  const switchMode = (m) => {
    setMode(m); setRect(null); setPoints([]); setClosed(false); setMagnifier(null)
    drawingRectRef.current = false
  }

  // Flat array of [x,y,...] for Konva Line
  const flatPts = points.flatMap((p) => [p.x, p.y])
  const linePts = closed && points.length > 0 ? [...flatPts, points[0].x, points[0].y] : flatPts

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* Mode toggle */}
      <div className="flex gap-2 shrink-0">
        {[['rect', '▭  Rectangle'], ['polygon', '⬡  Polygon']].map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-xs rounded-xl font-semibold transition-colors ${
              mode === m
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stage container */}
      <div ref={containerRef} className="relative flex-1 min-h-0 bg-zinc-900 rounded-xl overflow-hidden">
        {img && stageSize.width > 0 && (
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            style={{ cursor: 'crosshair', display: 'block' }}
            onMouseDown={onStageDown}  onTouchStart={onStageDown}
            onMouseMove={onStageMove}  onTouchMove={onStageMove}
            onMouseUp={onStageUp}      onTouchEnd={onStageUp}
            onClick={onStageClick}     onTap={onStageClick}
          >
            <Layer>
              {/* Background image */}
              <KonvaImage image={img} width={stageSize.width} height={stageSize.height} />

              {/* ── Rect mode ── */}
              {mode === 'rect' && rect && rect.w > 2 && (
                <Rect
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                  stroke="#22c55e" strokeWidth={2.5}
                  fill="rgba(34,197,94,0.12)"
                  dash={[6, 3]}
                />
              )}

              {/* ── Polygon mode — edges ── */}
              {mode === 'polygon' && points.length > 1 && (
                <Line
                  points={linePts}
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  closed={closed}
                  fill={closed ? 'rgba(34,197,94,0.15)' : 'transparent'}
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {/* ── Polygon mode — vertices ── */}
              {mode === 'polygon' && points.map((pt, i) => (
                <Circle
                  key={i}
                  x={pt.x} y={pt.y}
                  radius={i === 0 ? VERTEX_R * 1.5 : VERTEX_R}
                  fill={i === 0 ? '#22c55e' : '#ffffff'}
                  stroke={i === 0 ? '#ffffff' : '#22c55e'}
                  strokeWidth={2.5}
                  shadowColor="rgba(0,0,0,0.5)"
                  shadowBlur={4}
                  draggable
                  hitStrokeWidth={10}
                  onDragMove={(e) => onVertexDragMove(e, i)}
                  onDragEnd={onVertexDragEnd}
                />
              ))}
            </Layer>
          </Stage>
        )}

        {/* ── Magnifier loupe ── */}
        {magnifier && (
          <div
            className="absolute pointer-events-none rounded-full overflow-hidden shadow-2xl"
            style={{
              width: MAGNIFIER_SIZE,
              height: MAGNIFIER_SIZE,
              top: magnifier.top,
              left: magnifier.left,
              border: '2.5px solid #22c55e',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            <canvas ref={magnifierRef} width={MAGNIFIER_SIZE} height={MAGNIFIER_SIZE} />
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex gap-2 shrink-0">
        {mode === 'polygon' && (
          <>
            <button
              onClick={() => setClosed(true)}
              disabled={points.length < 3 || closed}
              className="flex-1 py-2 text-xs bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-30"
            >
              Close · {points.length} pts
            </button>
            <button
              onClick={() => {
                if (closed) { setClosed(false) } else { setPoints((p) => p.slice(0, -1)) }
              }}
              disabled={points.length === 0}
              className="px-3 py-2 text-xs bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700 disabled:opacity-30"
            >
              Undo
            </button>
          </>
        )}
        <button
          onClick={() => { setRect(null); setPoints([]); setClosed(false); drawingRectRef.current = false }}
          className="px-3 py-2 text-xs bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700"
        >
          Reset
        </button>
      </div>

      {/* ── Status hint ── */}
      <p className="text-xs text-center shrink-0 min-h-[1rem]">
        {mode === 'rect' && (
          <span className="text-zinc-500">
            {rect && rect.w > 2 ? '✓ Drag to redraw box' : 'Drag to draw a bounding box'}
          </span>
        )}
        {mode === 'polygon' && !closed && (
          <span className="text-zinc-500">
            {points.length === 0
              ? 'Tap to place first vertex'
              : points.length < 3
              ? `${points.length} vertex — keep adding`
              : 'Tap green vertex to close, or use Close button'}
          </span>
        )}
        {mode === 'polygon' && closed && (
          <span className="text-emerald-400">✓ Closed — drag any vertex to refine</span>
        )}
      </p>
    </div>
  )
})
