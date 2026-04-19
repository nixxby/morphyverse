import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Line, Rect } from 'react-konva'
import { cropImageToBlob, polygonCropToBlob } from '../utils/imageUtils'

const MAGNIFIER_SIZE = 130
const MAGNIFIER_ZOOM = 4
const VERTEX_R = 10
const CLOSE_DIST = 22
const MINIMAP_W = 110
const MINIMAP_H = 72
const MIN_ZOOM = 1
const MAX_ZOOM = 5

function clampPan(x, y, z, sw, sh) {
  return {
    x: Math.max(sw * (1 - z), Math.min(0, x)),
    y: Math.max(sh * (1 - z), Math.min(0, y)),
  }
}

export const BBoxAnnotator = forwardRef(function BBoxAnnotator({ imageBlob }, ref) {
  const containerRef   = useRef(null)
  const stageRef       = useRef(null)
  const magnifierRef   = useRef(null)
  const minimapRef     = useRef(null)
  const imgRef         = useRef(null)
  const scaleRef       = useRef(1)          // stage-px → natural-px conversion
  const stageOffsetRef = useRef({ x: 0, y: 0 }) // stage canvas offset inside containerRef
  const containerSzRef = useRef({ w: 0, h: 0 })
  const drawingRectRef = useRef(false)
  const rectStartRef   = useRef({ x: 0, y: 0 })

  const [img, setImg]           = useState(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [mode, setMode]         = useState('rect')
  const [zoom, setZoom]         = useState(1)
  const [pan, setPan]           = useState({ x: 0, y: 0 })

  // rect state (stage/layer coords)
  const [rect, setRect]   = useState(null)
  // polygon state (stage/layer coords)
  const [points, setPoints] = useState([])
  const [closed, setClosed] = useState(false)
  // magnifier
  const [magnifier, setMagnifier] = useState(null)

  // ── Expose getCrop() ──────────────────────────────────────────────────────
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

  // ── Load image blob ───────────────────────────────────────────────────────
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

  // ── Compute stage size: fit image inside container ────────────────────────
  useLayoutEffect(() => {
    if (!img || !containerRef.current) return
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      const cw = el.offsetWidth
      const ch = el.offsetHeight
      if (!cw || !ch) return
      const aspect = img.naturalWidth / img.naturalHeight
      let sw, sh
      if (aspect > cw / ch) { sw = cw; sh = cw / aspect }
      else                   { sh = ch; sw = ch * aspect }
      sw = Math.round(sw); sh = Math.round(sh)
      stageOffsetRef.current = { x: (cw - sw) / 2, y: (ch - sh) / 2 }
      containerSzRef.current = { w: cw, h: ch }
      scaleRef.current = sw / img.naturalWidth
      setStageSize({ width: sw, height: sh })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [img])

  // ── Reset stage position/scale when stageSize changes ────────────────────
  useEffect(() => {
    if (!stageRef.current || !stageSize.width) return
    stageRef.current.scale({ x: 1, y: 1 })
    stageRef.current.position({ x: 0, y: 0 })
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRect(null); setPoints([]); setClosed(false)
  }, [stageSize.width, stageSize.height])

  // ── Draw minimap ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mc = minimapRef.current
    if (!mc || !imgRef.current || !stageSize.width) return
    mc.width  = MINIMAP_W
    mc.height = MINIMAP_H
    const ctx = mc.getContext('2d')
    ctx.drawImage(imgRef.current, 0, 0, MINIMAP_W, MINIMAP_H)
    if (zoom > 1) {
      const vpX = (-pan.x / zoom / stageSize.width)  * MINIMAP_W
      const vpY = (-pan.y / zoom / stageSize.height) * MINIMAP_H
      const vpW = MINIMAP_W / zoom
      const vpH = MINIMAP_H / zoom
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 1.5
      ctx.strokeRect(
        Math.max(0, vpX), Math.max(0, vpY),
        Math.min(MINIMAP_W, vpW), Math.min(MINIMAP_H, vpH),
      )
    }
  }, [zoom, pan, stageSize, img])

  // ── Draw magnifier loupe ──────────────────────────────────────────────────
  useEffect(() => {
    const mc = magnifierRef.current
    if (!magnifier || !mc || !imgRef.current) return
    const sc = scaleRef.current
    mc.width  = MAGNIFIER_SIZE
    mc.height = MAGNIFIER_SIZE
    const ctx = mc.getContext('2d')
    const imgX = magnifier.layerX / sc
    const imgY = magnifier.layerY / sc
    const srcW = MAGNIFIER_SIZE / MAGNIFIER_ZOOM
    const srcH = MAGNIFIER_SIZE / MAGNIFIER_ZOOM
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE)
    ctx.drawImage(imgRef.current, imgX - srcW/2, imgY - srcH/2, srcW, srcH, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE)
    ctx.strokeStyle = 'rgba(34,197,94,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(MAGNIFIER_SIZE/2, 6);             ctx.lineTo(MAGNIFIER_SIZE/2, MAGNIFIER_SIZE-6)
    ctx.moveTo(6, MAGNIFIER_SIZE/2);             ctx.lineTo(MAGNIFIER_SIZE-6, MAGNIFIER_SIZE/2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(MAGNIFIER_SIZE/2, MAGNIFIER_SIZE/2, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#22c55e'
    ctx.fill()
  }, [magnifier])

  // ── Coordinate helpers ────────────────────────────────────────────────────

  // Raw canvas pointer → layer (image display) coords
  const getLayerPos = (e) => {
    const s = e.target.getStage()
    const p = s.getPointerPosition()
    return { x: (p.x - s.x()) / s.scaleX(), y: (p.y - s.y()) / s.scaleY() }
  }

  // Layer coords → magnifier object (positioned in containerRef space)
  const getMagnifierFromLayer = (lx, ly) => {
    const s = stageRef.current
    if (!s) return null
    const sx  = lx * s.scaleX() + s.x()
    const sy  = ly * s.scaleY() + s.y()
    const off = stageOffsetRef.current
    const cx  = off.x + sx
    const cy  = off.y + sy
    const cw  = containerSzRef.current.w
    return {
      layerX: lx, layerY: ly,
      top:  Math.max(4, cy - MAGNIFIER_SIZE - 18),
      left: Math.max(4, Math.min(cx - MAGNIFIER_SIZE / 2, cw - MAGNIFIER_SIZE - 4)),
    }
  }

  const isBackground = (e) => {
    const cls = e.target.getClassName()
    return cls === 'Image' || e.target === e.target.getStage()
  }

  // ── Zoom slider ───────────────────────────────────────────────────────────
  const handleZoomSlider = (newZoom) => {
    const s = stageRef.current
    if (!s || !stageSize.width) { setZoom(newZoom); return }
    const sw = stageSize.width, sh = stageSize.height
    const currZ = s.scaleX()
    const curr  = s.position()
    const newX  = sw / 2 - (sw / 2 - curr.x) * (newZoom / currZ)
    const newY  = sh / 2 - (sh / 2 - curr.y) * (newZoom / currZ)
    const cl    = clampPan(newX, newY, newZoom, sw, sh)
    s.scale({ x: newZoom, y: newZoom })
    s.position(cl)
    setZoom(newZoom)
    setPan({ ...cl })
  }

  // ── Stage drag (pan mode) ─────────────────────────────────────────────────
  const onStageDragEnd = (e) => {
    if (e.target !== stageRef.current) return
    const s   = stageRef.current
    const pos = s.position()
    const cl  = clampPan(pos.x, pos.y, zoom, stageSize.width, stageSize.height)
    s.position(cl)
    setPan({ ...cl })
  }

  // ── Stage draw events ─────────────────────────────────────────────────────
  const onStageDown = (e) => {
    if (mode === 'pan' || !isBackground(e)) return
    const pos = getLayerPos(e)
    if (mode === 'rect') {
      drawingRectRef.current = true
      rectStartRef.current = pos
      setRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
    }
  }

  const onStageMove = (e) => {
    if (mode !== 'rect' || !drawingRectRef.current) return
    const pos = getLayerPos(e)
    const sx = rectStartRef.current.x, sy = rectStartRef.current.y
    setRect({ x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w: Math.abs(pos.x - sx), h: Math.abs(pos.y - sy) })
    setMagnifier(getMagnifierFromLayer(pos.x, pos.y))
  }

  const onStageUp = () => { drawingRectRef.current = false; setMagnifier(null) }

  const onStageClick = (e) => {
    if (mode !== 'polygon' || closed || !isBackground(e)) return
    const pos = getLayerPos(e)
    if (points.length >= 3) {
      const dx = pos.x - points[0].x, dy = pos.y - points[0].y
      if (Math.sqrt(dx*dx + dy*dy) < CLOSE_DIST) { setClosed(true); return }
    }
    setPoints((prev) => [...prev, pos])
  }

  // ── Polygon vertex drag ───────────────────────────────────────────────────
  const onVertexDragMove = (e, i) => {
    const pos = { x: e.target.x(), y: e.target.y() }
    setPoints((prev) => prev.map((p, idx) => idx === i ? pos : p))
    setMagnifier(getMagnifierFromLayer(pos.x, pos.y))
  }
  const onVertexDragEnd = () => setMagnifier(null)

  // ── Mode switch ───────────────────────────────────────────────────────────
  const switchMode = (m) => {
    setMode(m); setRect(null); setPoints([]); setClosed(false); setMagnifier(null)
    drawingRectRef.current = false
  }

  // ── Minimap click to pan ──────────────────────────────────────────────────
  const onMinimapClick = (e) => {
    const mc = minimapRef.current
    if (!mc) return
    const r  = mc.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const lx = mx / MINIMAP_W * stageSize.width
    const ly = my / MINIMAP_H * stageSize.height
    const s  = stageRef.current
    if (!s) return
    const z  = s.scaleX()
    const cl = clampPan(stageSize.width/2 - lx*z, stageSize.height/2 - ly*z, z, stageSize.width, stageSize.height)
    s.position(cl)
    setPan({ ...cl })
  }

  const flatPts  = points.flatMap((p) => [p.x, p.y])
  const linePts  = closed && points.length > 0 ? [...flatPts, points[0].x, points[0].y] : flatPts
  const strokeW  = Math.max(1, 2.5 / zoom)
  const dashPat  = [6 / zoom, 3 / zoom]
  const vRadius  = (r) => Math.max(3, r / zoom)

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* ── Mode toggle ── */}
      <div className="flex gap-2 shrink-0">
        {[['rect', '▭ Rect'], ['polygon', '⬡ Poly'], ['pan', '✥ Pan']].map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-xs rounded-xl font-semibold transition-colors ${
              mode === m ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Stage container ── */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center"
      >
        {img && stageSize.width > 0 && (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            draggable={mode === 'pan'}
            style={{ cursor: mode === 'pan' ? 'grab' : 'crosshair', display: 'block', flexShrink: 0 }}
            onMouseDown={onStageDown}  onTouchStart={onStageDown}
            onMouseMove={onStageMove}  onTouchMove={onStageMove}
            onMouseUp={onStageUp}      onTouchEnd={onStageUp}
            onClick={onStageClick}     onTap={onStageClick}
            onDragEnd={onStageDragEnd}
          >
            <Layer>
              <KonvaImage image={img} width={stageSize.width} height={stageSize.height} />

              {mode === 'rect' && rect && rect.w > 2 && (
                <Rect
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                  stroke="#22c55e" strokeWidth={strokeW}
                  fill="rgba(34,197,94,0.12)" dash={dashPat}
                />
              )}

              {mode === 'polygon' && points.length > 1 && (
                <Line
                  points={linePts} stroke="#22c55e" strokeWidth={strokeW}
                  closed={closed} fill={closed ? 'rgba(34,197,94,0.15)' : 'transparent'}
                  lineCap="round" lineJoin="round"
                />
              )}

              {mode === 'polygon' && points.map((pt, i) => (
                <Circle
                  key={i} x={pt.x} y={pt.y}
                  radius={vRadius(i === 0 ? VERTEX_R * 1.5 : VERTEX_R)}
                  fill={i === 0 ? '#22c55e' : '#ffffff'}
                  stroke={i === 0 ? '#ffffff' : '#22c55e'}
                  strokeWidth={strokeW}
                  shadowColor="rgba(0,0,0,0.5)" shadowBlur={4}
                  draggable hitStrokeWidth={vRadius(10)}
                  onDragMove={(e) => onVertexDragMove(e, i)}
                  onDragEnd={onVertexDragEnd}
                />
              ))}
            </Layer>
          </Stage>
        )}

        {/* Magnifier loupe */}
        {magnifier && (
          <div
            className="absolute pointer-events-none rounded-full overflow-hidden shadow-2xl"
            style={{
              width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE,
              top: magnifier.top, left: magnifier.left,
              border: '2.5px solid #22c55e',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            <canvas ref={magnifierRef} width={MAGNIFIER_SIZE} height={MAGNIFIER_SIZE} />
          </div>
        )}

        {/* Minimap navigator (only when zoomed in) */}
        {img && zoom > 1 && (
          <div
            className="absolute bottom-2 right-2 rounded-lg overflow-hidden border border-zinc-500 shadow-lg cursor-pointer"
            style={{ width: MINIMAP_W, height: MINIMAP_H, opacity: 0.9 }}
            title="Click to navigate"
          >
            <canvas
              ref={minimapRef}
              width={MINIMAP_W}
              height={MINIMAP_H}
              onClick={onMinimapClick}
              style={{ display: 'block' }}
            />
          </div>
        )}
      </div>

      {/* ── Zoom slider ── */}
      {img && (
        <div className="flex items-center gap-2 shrink-0 px-1">
          <span className="text-zinc-500 text-xs">1×</span>
          <input
            type="range"
            min={MIN_ZOOM} max={MAX_ZOOM} step={0.1}
            value={zoom}
            onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-500 h-1"
          />
          <span className="text-zinc-400 text-xs w-8 text-right">{zoom.toFixed(1)}×</span>
        </div>
      )}

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
              onClick={() => { if (closed) setClosed(false); else setPoints((p) => p.slice(0, -1)) }}
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
            {rect && rect.w > 2 ? '✓ Drag to redraw · zoom to refine' : 'Drag to draw a bounding box'}
          </span>
        )}
        {mode === 'pan' && (
          <span className="text-zinc-500">Drag to pan · tap minimap to jump</span>
        )}
        {mode === 'polygon' && !closed && (
          <span className="text-zinc-500">
            {points.length === 0 ? 'Tap to place first vertex'
              : points.length < 3 ? `${points.length} vertices — keep adding`
              : 'Tap green vertex to close'}
          </span>
        )}
        {mode === 'polygon' && closed && (
          <span className="text-emerald-400">✓ Closed — drag any vertex to refine</span>
        )}
      </p>
    </div>
  )
})
