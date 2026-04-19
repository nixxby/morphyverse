# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

**MorphyVerse PWA** — a Progressive Web App for AI-powered lab inventory tracking. It is one of three components in the MorphyVerse system:

- **This repo (Person 3):** React PWA — phone-facing UI
- **morphyverse-server (Person 2):** FastAPI server on Replit — inventory hub
- **morphyverse-inference (Person 1):** YOLOE-26 inference server on a laptop

The PWA communicates **only with the Replit server** (`VITE_API_BASE_URL`). It never calls the inference server directly.

---

## Commands

Once the project is scaffolded (see TODOs in `mv-pwa-prd.md`):

```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run preview   # Preview production build locally
```

Initial setup:
```bash
npm create vite@latest morphyverse-pwa -- --template react
npm install tailwindcss zustand react-router-dom
npx tailwindcss init -p
```

---

## Architecture

**Stack:** React 18 + Vite, Tailwind CSS, Zustand, React Router v6, Web APIs (MediaDevices, Canvas, Service Worker)

**Routing (App.jsx):**
- `/` → Dashboard (inventory list + search + table list)
- `/scan` → ScanMode (camera + auto-capture every 30s + detection overlay)
- `/register` → Register (3-step: capture → crop → name)
- `/outgoing` → OutgoingLog (read-only consumed parts log)

**State (Zustand store at `src/store/store.js`):**
```js
{ tables, inventory, lastScanResult, setTables, setInventory, setLastScanResult }
```
`tables` and `inventory` are persisted to `localStorage` as offline fallback on init.

**Key components:**
- `CameraView.jsx` — `getUserMedia({ facingMode: 'environment' })` video element; exposes `captureFrame() → Promise<Blob>` via `useImperativeHandle`
- `BBoxAnnotator.jsx` — canvas-based bbox draw tool; exposes `getCrop() → Blob` via ref
- `DetectionOverlay.jsx` — draws scan image + bbox overlays with labels on canvas
- `Toast.jsx` — fixed-position toast list, auto-dismiss 4s

**Key hooks:**
- `useCamera.js` — `startCamera / stopCamera / captureFrame`
- `useScanLoop.js` — `setInterval` wrapper, cleans up on unmount

**API client (`src/api/client.js`):** All 7 functions use `import.meta.env.VITE_API_BASE_URL` as base and throw on non-2xx.

---

## API Contract

All requests go to `VITE_API_BASE_URL` (Replit server URL):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/scan` | Multipart: `table_id` + `image` (JPEG) → detections + inventory_events |
| `POST` | `/api/register` | Multipart: `object_name` + `crop` (JPEG) → registered object |
| `GET` | `/api/tables` | List all tables |
| `POST` | `/api/tables` | Create table (`type`: `"lab"` or `"production"`) |
| `GET` | `/api/inventory` | All objects with central count |
| `GET` | `/api/inventory/locate?name=<query>` | Locate object across tables |
| `GET` | `/api/inventory/outgoing` | Consumed parts log |

Scan response shape:
```json
{
  "table_id": "...",
  "detections": [{ "object_id", "name", "count", "confidence", "bboxes": [[x1,y1,x2,y2]] }],
  "inventory_events": [{ "event_type", "object_id", "object_name", "table_id", "quantity" }]
}
```

`inventory_events.event_type` values: `"checkout"`, `"return"`, `"consumed"`

---

## PWA Requirements

- `public/manifest.json`: `display: "standalone"`, two icons (192×192, 512×512)
- `public/sw.js`: cache shell on install; serve cached on network failure
- Must be hosted on HTTPS (Vercel or Replit Static) — required for camera access
- iOS Safari: no background sync; manual scan only

---

## Environment

```
VITE_API_BASE_URL=https://your-replit.replit.app
```

---

## Key Behaviours

- **Scan loop:** `setInterval` at 30s; `captureFrame()` → `submitScan()` → store result → render overlay + toasts
- **Search debounce:** 400ms before calling `locateObject()`
- **Dashboard refresh:** `getInventory()` every 10s
- **Offline:** load `tables` + `inventory` from `localStorage` on init; disable scan loop if server unreachable
- **`imageUtils.cropImageToBlob(sourceBlob, { x, y, w, h }) → Promise<Blob>`:** offscreen canvas crop, returns JPEG blob at 0.85 quality
- **Outgoing log sort:** by `disappeared_at` descending (client-side fallback, server already sorts)

---

## Implementation Order

The `mv-pwa-prd.md` file contains 20 ordered TODOs covering the full implementation from Vite scaffold through Android end-to-end testing. Follow that order when building out the app.
