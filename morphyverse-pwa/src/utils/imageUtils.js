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
