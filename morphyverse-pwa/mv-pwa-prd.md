# MorphyVerse — Phone PWA
### Technical Design Document — Person 3 of 3
*April 2026*

---

## Context

You are building the MorphyVerse phone app as a Progressive Web App (PWA). It runs in Chrome on Android (primary) and Safari on iPhone (secondary). Users open it in their browser — no app store required.

The PWA talks to the Replit server only (Person 2). It never calls the inference laptop directly. Person 2 has given you all the API endpoints you need — they are defined below exactly as you must call them.

---

## API Contract — All calls go to `VITE_API_BASE_URL` (Replit server)

---

### `POST /api/scan`

Call this every 30 seconds (or on manual trigger) when in scan mode.

**You send:** `multipart/form-data`

| Field | Type |
|---|---|
| `table_id` | string |
| `image` | JPEG blob (camera frame) |

**You receive:**

```json
{
  "table_id": "bench-west-01",
  "detections": [
    {
      "object_id": "uuid-string",
      "name": "775 DC Motor",
      "count": 2,
      "confidence": 0.82,
      "bboxes": [[x1, y1, x2, y2], [x1, y1, x2, y2]]
    }
  ],
  "inventory_events": [
    {
      "event_type": "checkout",
      "object_id": "uuid-string",
      "object_name": "775 DC Motor",
      "table_id": "bench-west-01",
      "quantity": 2
    }
  ]
}
```

Use `detections` to render bounding box overlays. Use `inventory_events` to show toast notifications ("775 DC Motor checked out to West Bench").

---

### `POST /api/register`

Call this when user finishes the registration flow.

**You send:** `multipart/form-data`

| Field | Type |
|---|---|
| `object_name` | string |
| `crop` | JPEG blob (cropped bounding box region from the photo) |

**You receive:**

```json
{
  "object_id": "uuid-string",
  "name": "ESP32-C3"
}
```

Show a success toast with the object name on receipt.

---

### `GET /api/tables`

**You receive:**

```json
[
  {
    "id": "bench-west-01",
    "label": "West Bench",
    "type": "lab"
  }
]
```

Use this to populate the table selector dropdown in Scan Mode. Fetch once on app load, store in Zustand.

---

### `POST /api/tables`

Call this from a "Create Table" form (admin use).

**You send:** `application/json`

```json
{
  "id": "bench-west-01",
  "label": "West Bench",
  "type": "lab"
}
```

`type` must be `"lab"` or `"production"`.

---

### `GET /api/inventory`

**You receive:**

```json
[
  {
    "object_id": "uuid-string",
    "name": "775 DC Motor",
    "count": 4
  }
]
```

Show on Dashboard. Auto-refresh every 10 seconds.

---

### `GET /api/inventory/locate?name=<query>`

**You receive:**

```json
[
  {
    "object_id": "uuid-string",
    "object_name": "775 DC Motor",
    "table_id": "bench-west-01",
    "table_label": "West Bench",
    "count": 2,
    "last_seen": "2026-04-19T10:31:00Z"
  }
]
```

Empty array means the object is either in central storage or not registered. Show "Not on any table — check central storage" in that case.

---

### `GET /api/inventory/outgoing`

**You receive:**

```json
[
  {
    "id": "uuid-string",
    "object_id": "uuid-string",
    "object_name": "ESP32-C3",
    "table_id": "prod-table-01",
    "table_label": "Assembly Line 1",
    "quantity": 3,
    "disappeared_at": "2026-04-19T09:12:00Z"
  }
]
```

Display on Outgoing Log page, sorted by `disappeared_at` descending (server already sorts, but sort client-side too as a fallback).

---

## Feature Requirements

**Scan Mode**
- User picks a table from dropdown, taps "Start Scanning"
- Rear camera opens via `getUserMedia`
- Frame captured every 30 seconds automatically; "Scan Now" button for manual
- After each scan response: draw bounding box overlays with object name + confidence on a canvas over the captured frame
- Toast notification for each `inventory_event` in the response

**Registration Mode (3-step wizard)**
1. Capture: user takes a photo with rear camera
2. Crop: user draws a bounding box on the captured image on a canvas; tapping "Confirm" extracts the crop
3. Name: user types object name and hits Submit; sends `POST /api/register`

**Dashboard**
- List of all objects with their central count (from `GET /api/inventory`), auto-refreshed every 10s
- Search bar: user types object name → calls `GET /api/inventory/locate` → shows result inline below search bar
- List of all tables with a summary count (derive from `GET /api/tables` — no per-table count endpoint exists; show table list only)

**Outgoing Log**
- Read-only table of consumed parts from `GET /api/inventory/outgoing`
- Columns: Object, Quantity, Table, Time

**PWA**
- Installable on Android Chrome home screen (manifest + HTTPS)
- Works in Safari iOS without install (no background sync, manual scan only)
- Offline: show last-known inventory from `localStorage` if server unreachable; no scan loop when offline

---

## Stack

- React 18 + Vite
- Tailwind CSS
- Zustand (global state)
- React Router v6
- `MediaDevices API` — camera
- HTML5 Canvas — bbox draw + detection overlay
- Web App Manifest + Service Worker
- Hosted on Vercel or Replit Static (must be HTTPS for camera access)

---

## File Structure

```
morphyverse-pwa/
├── public/
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker — offline shell cache only
├── src/
│   ├── main.jsx                 # React root
│   ├── App.jsx                  # Router: /, /scan, /register, /outgoing
│   ├── pages/
│   │   ├── Dashboard.jsx        # Inventory list + search + table list
│   │   ├── ScanMode.jsx         # Camera + auto-capture loop + overlay
│   │   ├── Register.jsx         # 3-step registration wizard
│   │   └── OutgoingLog.jsx      # Consumed parts log
│   ├── components/
│   │   ├── CameraView.jsx       # getUserMedia video + captureFrame()
│   │   ├── BBoxAnnotator.jsx    # Canvas draw tool → getCrop() → Blob
│   │   ├── DetectionOverlay.jsx # Canvas overlay of bboxes on scan result image
│   │   ├── TableSelector.jsx    # Dropdown from /api/tables
│   │   ├── ObjectCard.jsx       # Object name + count chip
│   │   ├── SearchBar.jsx        # Input → /api/inventory/locate → result display
│   │   └── Toast.jsx            # Inventory event notifications
│   ├── hooks/
│   │   ├── useCamera.js         # getUserMedia setup/teardown, captureFrame → Blob
│   │   └── useScanLoop.js       # setInterval wrapper, cleans up on unmount
│   ├── api/
│   │   └── client.js            # All fetch calls — functions listed below
│   ├── store/
│   │   └── store.js             # Zustand store — tables, inventory, lastScanResult
│   └── utils/
│       └── imageUtils.js        # cropImageToBlob(imageBlob, bbox) → Blob
├── .env                         # VITE_API_BASE_URL=https://your-replit.replit.app
├── vite.config.js
└── package.json
```

---

## `api/client.js` — Function Signatures

All functions use `VITE_API_BASE_URL` as the base. All throw on non-2xx responses.

```js
getTables()
  // GET /api/tables
  // Returns: Array<{ id, label, type }>

createTable({ id, label, type })
  // POST /api/tables, body: JSON
  // Returns: { id, label, type }

getInventory()
  // GET /api/inventory
  // Returns: Array<{ object_id, name, count }>

locateObject(name)
  // GET /api/inventory/locate?name=<name>
  // Returns: Array<{ object_id, object_name, table_id, table_label, count, last_seen }>

getOutgoingLog()
  // GET /api/inventory/outgoing
  // Returns: Array<{ id, object_id, object_name, table_id, table_label, quantity, disappeared_at }>

submitScan(tableId, jpegBlob)
  // POST /api/scan, multipart: table_id + image
  // Returns: { table_id, detections, inventory_events }

registerObject(objectName, cropBlob)
  // POST /api/register, multipart: object_name + crop
  // Returns: { object_id, name }
```

---

## TODOs (in order)

- [ ] `npm create vite@latest morphyverse-pwa -- --template react`; install `tailwindcss zustand react-router-dom`; init Tailwind
- [ ] `public/manifest.json` — `name: "MorphyVerse"`, `display: "standalone"`, `start_url: "/"`, `background_color`, two icons (192×192, 512×512)
- [ ] `public/sw.js` — on `install` event, cache `["/", "/index.html", "/assets/..."]`; on `fetch` event, return cached response if network fails
- [ ] `api/client.js` — implement all seven functions above; read base URL from `import.meta.env.VITE_API_BASE_URL`; for multipart calls use `FormData` with `formData.append('image', blob, 'scan.jpg')`; throw `Error(response.statusText)` on non-2xx
- [ ] `store/store.js` — Zustand store with: `tables: []`, `inventory: []`, `lastScanResult: null`, `setTables`, `setInventory`, `setLastScanResult`; on init load `tables` and `inventory` from `localStorage` as fallback
- [ ] `hooks/useCamera.js` — `async startCamera()` calls `getUserMedia({ video: { facingMode: 'environment', width: 1280 } })`; attaches stream to a `videoRef`; `captureFrame() → Promise<Blob>` draws current video frame to an offscreen canvas and returns `canvas.toBlob(resolve, 'image/jpeg', 0.85)`; `stopCamera()` stops all tracks; return `{ videoRef, startCamera, stopCamera, captureFrame }`
- [ ] `hooks/useScanLoop.js` — accepts `{ enabled: bool, intervalMs: number, onCapture: async fn }`; starts `setInterval(onCapture, intervalMs)` when `enabled=true`; clears interval on `enabled=false` or unmount
- [ ] `components/CameraView.jsx` — renders `<video ref={videoRef} autoPlay playsInline muted>`; calls `startCamera` on mount, `stopCamera` on unmount; exposes `captureFrame` to parent via `useImperativeHandle`
- [ ] `components/BBoxAnnotator.jsx` — renders a `<canvas>` with the captured image drawn on it; mouse/touch `pointerdown` → `pointermove` → `pointerup` draws a single rect; `getCrop() → Blob` uses `imageUtils.cropImageToBlob` with the drawn rect coordinates; exposes `getCrop` via ref
- [ ] `utils/imageUtils.js` — `cropImageToBlob(sourceBlob, { x, y, w, h }) → Promise<Blob>`: draw `sourceBlob` onto an offscreen canvas, use `getImageData` to extract the region, draw into a second canvas sized to `w×h`, return as JPEG blob
- [ ] `components/DetectionOverlay.jsx` — accepts `{ imageBlob, detections }`; draws `imageBlob` on canvas; for each detection draws a rect at `bboxes[i]` with label `"name (confidence%)"` in white text on a coloured background
- [ ] `components/Toast.jsx` — renders a fixed-position toast list; accepts `{ events: inventory_events[] }`; shows one toast per event: `"checkout"` → "📤 {name} checked out to {table}", `"return"` → "📥 {name} returned", `"consumed"` → "🔧 {name} consumed at {table}"; auto-dismiss after 4s
- [ ] `components/TableSelector.jsx` — dropdown populated from Zustand `tables`; shows label + type badge; calls `setSelectedTable` on change
- [ ] `components/SearchBar.jsx` — controlled input with 400ms debounce; on change calls `locateObject(query)`; renders results below the input as a small card list showing `table_label + last_seen`; shows "Not on any table" if empty array returned
- [ ] `pages/ScanMode.jsx` — `TableSelector` at top; "Start" button calls `startCamera` + enables scan loop; each loop iteration calls `captureFrame` → `submitScan(tableId, frame)` → stores result in Zustand → renders `DetectionOverlay` + `Toast`; "Stop" disables loop + stops camera
- [ ] `pages/Register.jsx` — step 1: `CameraView` + "Capture" button → saves frame blob; step 2: `BBoxAnnotator` with captured frame → "Confirm Crop" calls `getCrop()`; step 3: text input for name + "Register" button → calls `registerObject(name, crop)` → success toast + reset to step 1
- [ ] `pages/Dashboard.jsx` — on mount: `getTables()` + `getInventory()` → store in Zustand + `localStorage`; set up 10s refresh for `getInventory`; render `SearchBar`, `ObjectCard` list, table name list with type badge
- [ ] `pages/OutgoingLog.jsx` — on mount call `getOutgoingLog()`; render as table: Object | Qty | Table | Time (format `disappeared_at` as relative time)
- [ ] `App.jsx` — React Router routes: `/` → Dashboard, `/scan` → ScanMode, `/register` → Register, `/outgoing` → OutgoingLog; bottom nav bar with icons for all four routes
- [ ] Set `VITE_API_BASE_URL` in `.env` to Replit server URL (get from Person 2); deploy to Vercel or Replit Static
- [ ] Test on Android Chrome: install to home screen, open camera, complete one full scan cycle end-to-end
