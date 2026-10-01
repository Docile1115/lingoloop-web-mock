# TimoTalk Home — 3D interaction prototype

## Run and scope

Run `npm install`, then `npm run dev`, and open <http://localhost:5174/room-preview>.
This route is an isolated design preview, not a replacement for the
production profile room. There are no production API requests or server writes.
Layouts, uploaded photos and guestbook drafts on `/room-preview` disappear on
reload. The legacy persisted room schema is unchanged.

## Product integration (beta)

`HomeDialog` is 3D only on the web: the room fills the dialog and every control
(title, window buttons, shortcut dock, furniture card, camera, edit bar) floats over it.
Homes without a saved layout show the starter room to everyone, and its whiteboard
accepts guestbook notes (the server applies the same rule). Existing profile
`roomConfig` is never overwritten. The native app retains its original 2D renderer;
3D avatar customization is pending. The viewer walks around as a default VRM avatar
picked by their profile gender (male avatar for `man`, the female one otherwise).

- `GET /api/homes/:ownerId` includes `room3d` and `room3dRevision`, only after the
  existing transactional privacy, active-account and bidirectional-block checks.
- `PUT /api/homes/:ownerId/room3d` accepts `{config, revision}` from the owner only.
  Firestore transaction checks the revision; stale writers receive HTTP 409.
- Storage: `homes/{ownerId}.room3d = {version:1, items:[...]}` and integer
  `room3dRevision`. Legacy `profiles/{ownerId}.roomConfig` remains separate.
- Server validates catalogue IDs, unique slots, finite coordinates, room bounds,
  entry clearance, fixed lamp, overlapping footprints and a maximum of 16 items.
- Photo slots remain `frame`, `frame2`, `frame3`; one `whiteboard` reuses the real
  guestbook. Existing APIs still own photo sanitization, visibility, moderation,
  report/block behavior, guestbook rate limits and notifications.
- Only server-authorized photos and entries become 3D textures. Removing access
  clears textures on refresh; pending older texture loads cannot restore them.
- Dirty layouts block mode switching/refresh, prompt before discarding, and survive
  failed saves. Unloading warns; successful saves use the server-returned layout.
- Browser UI checks used a temporary local component harness, subsequently removed.
  Real-account browser testing was unavailable because local auth configuration API
  was unavailable. Real Express route tests used the transactional Firestore double,
  not a production Firestore write. Web tests: 57; backend tests: 56; both passed.
  Web/native type checks passed; ESLint has only the two pre-existing image warnings.

Deploy the API **before** the web revision so `/room3d` exists when controls appear.
Production releases use the main-branch Cloud Run workflow. Existing rooms are
never automatically migrated. Check the workflow run for the live revision.

The goal is to validate real 3D room interaction after the previous SVG prototype
failed to meet the requested visual/movement quality. This is **not a claim of
Sims 3-level completeness**. No EA/Sims artwork, animation or code is used.

## Implemented

- React owns controls/dialogs; a lazily loaded Three.js scene owns rendering.
- Perspective camera: desktop right-drag and scroll; mobile drag and pinch;
  explicit zoom/reset controls. Portrait field of view fits the room horizontally.
- Sculpted, rounded furniture geometry, material roughness, fabric bump mapping,
  generated wood grain, environment lighting and directional shadows.
- VRM avatars (official CC0 VRoid samples, `@pixiv/three-vrm`) with spring-bone
  hair/clothes, blinking and eye contact. Authored CC0 humanoid clips (idle, walk,
  nod, interact, water, pick up, sit down/sit/stand up) are retargeted offline to the
  VRM humanoid. Avatars taller than 1.76 m are scaled down at load time.
- Continuous floor destinations, inflated furniture collision footprints, A*
  navigation and line-of-sight path smoothing. Approaches stop beside furniture.
- Sitting plays the authored sit-down/stand-up clips. At load time the sit pose is
  measured on the avatar (seat contact, soles, back of the body, back of the calves),
  so each avatar rests on the 0.5 m cushions with its feet on the floor and its back
  near the backrest; standing up steps back out of the seat's footprint.
- Rendering cost: each furniture piece and the room shell are merged into one mesh
  per material (picture canvases stay separate), small bevels use fewer segments, and
  the avatars ship with one primitive per material. Touch devices (`pointer: coarse`)
  use a lite tier: no toon outlines, a blob shadow under the avatar, a 1024 shadow map
  redrawn only when furniture moves, and a 1.5 pixel-ratio cap.
- The loading screen shows the avatar download progress when the size is known.
- Layout mode supports pointer capture, fine-grid drag, cancellation, 90-degree
  rotation, add/remove, and rejection of overlapping/out-of-bounds placements.
- Clicking a frame/board walks there and opens its photo/guestbook dialog.
  Photos decode locally and are bounded/resized before becoming a texture;
  guestbook text also appears on the board's sticky notes (latest three).
- Native modal dialogs trap focus and make background controls inert.
- Context-loss/model-load fallback, resize handling, renderer/texture disposal.

## Source map

| File | Responsibility |
| --- | --- |
| `app/room-preview/page.tsx` | Prototype UI and in-memory photo/guestbook drafts |
| `app/room-preview/preview.css` | Responsive, room-first control layout |
| `app/lib/room3d/scene.ts` | Renderer, quality tier, input, animation and lifecycle |
| `app/lib/room3d/avatar.ts` | VRM loading, clip conversion, sit-pose measurement |
| `app/lib/room3d/models.ts` | Original furniture geometry, seats, materials, batching |
| `app/lib/room3d/navigation.ts` | Pure pathfinding and collision checks |
| `scripts/room3d/vrm-shrink.mjs` | Texture resize and primitive merge for the avatars |
| `scripts/room3d/ual-to-vrm.mjs` | Bakes the CC0 animation clips for the VRM humanoid |
| `public/room3d/ATTRIBUTION.md` | Avatar/animation sources, pinned mirror and licenses |
| `tests/room3d.test.mjs` | Path, placement, avatar and clip contracts |

`/room-preview?avatar=male` and `?quality=lite` (or `high`) switch the avatar and the
quality tier for local checks.

Canvas `data-fps`, `data-draw-calls`, and `data-triangles` expose lightweight local
diagnostics; these do not send telemetry. FPS must be measured on actual target
devices before setting a release target. Browser viewport emulation is not device
performance testing.

## Required before product integration

1. Avatar customization: the legacy SVG options do not control the VRM avatars, and
   only the two default avatars exist. Combining VRoid parts inside the app needs a
   separate pixiv license; authored turn/start/stop clips are still missing.
2. Replace approximate AABB footprints where needed and add foot IK/contact
   alignment for uneven poses. Bed sleep, simulation needs, autonomous behavior and
   multiplayer are absent.
3. Profile real iOS/Android devices (the lite tier is chosen by pointer type, not by
   measured performance); consider compressed textures/meshes. The native app is unchanged.
4. The separate 3D layout schema and authenticated API integration are implemented
   above. Verify them against deployed infrastructure before release. A full 2D-to-3D
   furniture conversion is not implemented; conversion is an explicit new layout.
5. Add browser interaction regression coverage and release behind a feature flag.
   Do not merge/deploy this preview as if it were the completed profile feature.

## Verification — 2026-09-06

- Web build and all 56 unit/regression tests pass; TypeScript passes.
- ESLint has no errors (two existing image warnings in `components/ui.tsx`).
- Browser checks: floor walk, sofa approach/sit/stand, frame photo application,
  board message submission, furniture drag/rotate/add/remove, invalid-drop reset.
- A 390 × 844 viewport was checked; portrait cropping was corrected. This is
  viewport emulation, not an actual phone/touch-hardware test.
- The final scene remains a local deliverable; no commit, push, merge or deployment
  was performed for this prototype. Test-only drafts were cleared by reloading.
- Build still reports a large client chunk; optimize and benchmark before release.

## References

- Avatars: VRoid official samples Sendagaya Shino and Sakurada Fumiriya (pixiv), CC0.
- Animations: [Quaternius Universal Animation Library 1 and 2](https://quaternius.com/packs/universalanimationlibrary.html), CC0.
- [three-vrm](https://github.com/pixiv/three-vrm) and its Mixamo retargeting example (MIT).
- [Three.js animation system](https://threejs.org/manual/en/animation-system.html).
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
