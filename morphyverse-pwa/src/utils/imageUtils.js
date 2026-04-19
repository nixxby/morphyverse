export function cropImageToBlob(sourceBlob, { x, y, w, h }) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(sourceBlob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const src = document.createElement('canvas')
      src.width = img.naturalWidth
      src.height = img.naturalHeight
      src.getContext('2d').drawImage(img, 0, 0)

      const dst = document.createElement('canvas')
      dst.width = Math.round(w)
      dst.height = Math.round(h)
      dst.getContext('2d').drawImage(src, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h))
      dst.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

// Crops image to the bounding box of a polygon, masking outside pixels with white.
// points: [{x, y}] in image natural coordinates
export function polygonCropToBlob(sourceBlob, points) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(sourceBlob)
    img.onload = () => {
      URL.revokeObjectURL(url)

      // Bounding box of polygon (clamped to image bounds)
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.max(0, Math.floor(Math.min(...xs)))
      const minY = Math.max(0, Math.floor(Math.min(...ys)))
      const maxX = Math.min(img.naturalWidth, Math.ceil(Math.max(...xs)))
      const maxY = Math.min(img.naturalHeight, Math.ceil(Math.max(...ys)))
      const w = maxX - minX
      const h = maxY - minY
      if (w <= 0 || h <= 0) { resolve(null); return }

      // Draw full image onto a canvas with alpha support
      const full = document.createElement('canvas')
      full.width = img.naturalWidth
      full.height = img.naturalHeight
      const ctx = full.getContext('2d')
      ctx.drawImage(img, 0, 0)

      // Use destination-in compositing: keep pixels inside the polygon, make outside transparent
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      ctx.beginPath()
      points.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()

      // Crop to bounding box; white background fills transparent (polygon exterior) areas
      const dst = document.createElement('canvas')
      dst.width = w
      dst.height = h
      const dctx = dst.getContext('2d')
      dctx.fillStyle = '#ffffff'
      dctx.fillRect(0, 0, w, h)
      dctx.drawImage(full, minX, minY, w, h, 0, 0, w, h)

      dst.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}
