# HMS Developer Guide

This document is a quick onboarding guide for developers who will continue this project.

## 1) What This App Does

- Entry page lets user select aircraft via hierarchy: `Country -> City -> Fleet -> Aircraft`.
- Viewer page opens selected aircraft model and highlights faulted part.
- GLB Preview page lets you upload a GLB/glTF file and preview it (no conversion needed).

Core user flow:
1. `Entry` (`/`) -> choose aircraft
2. `View` (`/view/:aircraftId`) -> inspect model, fault highlight, isolate/zoom part
3. Optional: `Import` (`/import`) -> upload and preview a GLB file

## 2) Main Architecture

### Routing
- File: `src/router/index.js`
- Routes:
  - `Entry` -> `src/views/HmsEntry.vue`
  - `View` -> `src/views/HmsViewerPage.vue`
  - `Import` -> `src/views/ImportTool.vue`

### Data Source (current)
- File: `src/data/aircraft.js`
- `aircraftList` is mock data used by both entry and viewer pages.
- Each aircraft record includes:
  - selection fields: `country`, `city`, `fleet`
  - display fields: `tailNumber`, `displayName`
  - viewer fields: `modelUrl`, `faultyPart`, `faultType`
  - optional detail model fields: `detailModelUrl`, `detailFaultyPart`

### App Shell
- `src/main.js`: Vue app bootstrap + router install
- `src/App.vue`: header/nav + `<router-view />`

## 3) File Map (What To Open First)

If you are new, open in this order:

1. `src/data/aircraft.js`
2. `src/views/HmsEntry.vue`
3. `src/views/HmsViewerPage.vue`
4. `src/components/HmsViewer.vue`
5. `src/router/index.js`

Supporting modules:
- `src/views/ImportTool.vue` -> uses `GlbUploadViewer`
- `src/components/GlbUploadViewer.vue` -> GLB upload + preview tool

Note: older demo components were removed to keep the repo lean. The previous
STEP/IGES/BREP -> JSON converter (`occt-import-js`) was removed when the project
switched to loading GLB models directly via Three.js `GLTFLoader`.

## 4) Critical Logic You Must Know

### A) Where faulty part is defined
- Source is selected aircraft data in `aircraftList`.
- In `HmsViewerPage.vue`, selected aircraft is found by route param:
  - `route.params.aircraftId`
  - `aircraftList.find(...)`
- That aircraft's `faultyPart` is passed into `HmsViewer` as prop.

### B) Where red fault highlight is applied
- File: `src/components/HmsViewer.vue`
- Function: `applyPartStyle(mesh)`
- Fault condition:
  - `mesh.userData.partName === faultyPartName.value`
- Fault style is applied there:
  - red diffuse + red emissive
  - non-fault meshes can become transparent if `transparentOthers` is active

### C) Where click-to-isolate and zoom happens
- File: `src/components/HmsViewer.vue`
- Flow:
  - `onPointerDown()` -> picks mesh via raycaster
  - `isolatePart(mesh)` -> hides other meshes
  - `focusToBox(bbox, distanceMultiplier)` -> camera fit/zoom
- Zoom tuning:
  - Lower `distanceMultiplier` = closer zoom
  - Higher `distanceMultiplier` = farther framing

### D) Optional detail model switch
- File: `src/components/HmsViewer.vue`
- In `onPointerDown()`, if user clicks faulty part and aircraft has:
  - `detailModelUrl` and `detailFaultyPart`
- Viewer swaps to detail model and updates fault target.

### E) Entry page hierarchy filtering
- File: `src/views/HmsEntry.vue`
- Computed chain:
  - `countries` from all aircraft
  - `cities` filtered by selected country
  - `fleets` filtered by selected country+city
  - `filteredAircraftSorted` filtered by all 3 and sorted by `tailNumber`

## 5) Model Contract (GLB)

`HmsViewer` loads a binary glTF (`.glb`) via Three.js `GLTFLoader`:
- `modelUrl` points to a `.glb` file served from `public/` (e.g. `/F35.glb`).
- Each mesh's **part name** is derived from the glTF node name (`mesh.name`, falling
  back up the parent hierarchy). This name is what `faultyPart` must match.
- On load, every mesh material is replaced with a fresh `MeshStandardMaterial` so the
  HMS highlight/hover/transparency logic can mutate materials per-mesh safely.

If this contract changes, update parsing in `HmsViewer.vue` (`renderGltf` / `pickPartName` / `loadModelFromUrl`).

> Note: If your GLB uses Draco/meshopt compression and fails to load, configure a
> `DRACOLoader`/`MeshoptDecoder` on the `GLTFLoader` instance.

## 6) Embedding Notes (Host App Integration)

- This app may be embedded in another application.
- Back navigation behavior can differ depending on host routing.
- Current viewer uses local route links for "Back to selection".
- If host app must control navigation, replace local links with host routing callback/postMessage or host URL strategy.

## 7) Common Changes and Where To Edit

- Add new aircraft:
  - `src/data/aircraft.js`
- Change selection hierarchy:
  - `src/views/HmsEntry.vue`
- Change viewer behaviors (highlight, isolate, zoom, labels):
  - `src/components/HmsViewer.vue`
- Change route structure:
  - `src/router/index.js`
- Change GLB upload/preview behavior:
  - `src/components/GlbUploadViewer.vue`

## 8) Quick Dev Commands

- Install: `npm install`
- Run dev: `npm run dev`
- Build: `npm run build`

## 9) Suggested Next Refactor (when ready)

When moving from mock to real backend:
- Keep UI contract stable (`id/country/city/fleet/tailNumber/modelUrl/faultyPart...`)
- Introduce service layer (`src/services/aircraftService.js`)
- Keep `HmsEntry` and `HmsViewerPage` consuming normalized data shape

## 10) Fault Highlight Pipeline (Step-by-step)

This section explains, in order, how the app goes from an aircraft selection to a red-highlighted faulty part in the 3D viewer.

### Step 1 — User selects an aircraft (Entry page)
- File: `src/views/HmsEntry.vue`
- The entry page builds a hierarchy from `aircraftList` and finally shows aircraft cards.
- Clicking a card navigates to the viewer route using the aircraft id:
  - `router.push({ name: 'View', params: { aircraftId } })`

### Step 2 — Viewer page resolves `aircraftId` into an aircraft record
- File: `src/views/HmsViewerPage.vue`
- Route: `/view/:aircraftId`
- The viewer page reads `route.params.aircraftId`, finds the matching record in `aircraftList`, and passes these into `HmsViewer`:
  - `modelUrl` (which model JSON to load)
  - `faultyPart` (string part name)
  - `faultType` (optional, affects overlay text)
  - `detailModelUrl` / `detailFaultyPart` (optional, for switching to a detail model)

### Step 3 — `HmsViewer` loads the GLB model
- File: `src/components/HmsViewer.vue`
- Function: `loadModelFromUrl(url)`
- Process:
  - `gltfLoader.loadAsync(url)` -> a parsed glTF scene
  - Call `renderGltf(gltf)`

### Step 4 — Part names are read from glTF node names and stored on each Three.js mesh
- File: `src/components/HmsViewer.vue`
- Function: `renderGltf(gltf)` / `pickPartName(mesh, index)`
- For each mesh in the loaded scene:
  - Part name is taken from `mesh.name` (falling back up the parent hierarchy, then a generated name)
  - It is stored as: `mesh.userData.partName = partName`

This `mesh.userData.partName` is the key used everywhere for matching/highlighting/labels.

### Step 5 — Faulty part name is injected via props and activates highlight
- `HmsViewer` receives `props.faultyPart` from the selected aircraft record.
- After rendering meshes, the viewer sets:
  - `faultyPartName.value = props.faultyPart ?? ''`
  - `transparentOthers.value = true` (when a faulty part exists, to make the red highlight clearer)
  - then calls `updateFaultyHighlight()`

### Step 6 — Red highlight is applied by comparing mesh part names
- File: `src/components/HmsViewer.vue`
- Function: `applyPartStyle(mesh)`
- Fault condition:
  - `mesh.userData.partName === faultyPartName.value`
- Fault style:
  - red diffuse: `mat.color.setHex(0xdc2626)`
  - red emissive: `mat.emissive.setHex(0xb91c1c)`

`updateFaultyHighlight()` traverses the model and calls `applyPartStyle` for each mesh.

### Step 7 — Fault overlay card (FIN / status / warnings) is derived from `faultyPartName`
- File: `src/components/HmsViewer.vue`
- Computed: `faultCardData`
- This is currently demo UI data (not from backend).
- Its screen position is updated every frame in `loop()` by projecting the faulty part's bounding box center into screen coordinates.

### Step 8 — Clicking a part isolates it and zooms camera to it
- File: `src/components/HmsViewer.vue`
- Click handler: `onPointerDown()`
- Action:
  - `isolatePart(clickedMesh)` hides other meshes
  - `focusToBox(bbox, distanceMultiplier)` fits camera to the selected mesh
  - smaller `distanceMultiplier` => closer zoom

### Step 9 (optional) — Switch to detail model when clicking the faulty part
- File: `src/components/HmsViewer.vue`
- In `onPointerDown()`, if:
  - `detailModelUrl` and `detailFaultyPart` exist, and
  - user clicked the current faulty part,
then the viewer loads the detail model and updates `faultyPartName` to the detail part name.
