# TimoTalk Home — 3D interaction prototype

## Run and scope

Run `npm install`, then `npm run dev`, and open <http://localhost:5174/room-preview>.
This route is an isolated design preview, not a replacement for the
production profile room. There are no production API requests or server writes.
Layouts, uploaded photos and guestbook drafts on `/room-preview` disappear on
reload. The legacy persisted room schema is unchanged.

## Product integration (beta)

`HomeDialog` now embeds `Room3DHome`. Owners can save a new 3D layout; existing
visitors see the original 2D room until the owner explicitly saves the 3D room.
Both modes remain available and existing profile `roomConfig` is never overwritten.
The native app retains its original 2D renderer; 3D avatar customization is pending.

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
- A skinned character with Idle/Walk/Wave/Interact clips, acceleration, gradual
  turning and animation cross-fades. The CC0 character is temporary validation art.
- Continuous floor destinations, inflated furniture collision footprints, A*
  navigation and line-of-sight path smoothing. Approaches stop beside furniture.
- Sofa/chair sitting uses a blended procedural leg pose; standing restores the
  prior free position. This is not yet a finished authored sit/stand animation.
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
| `app/lib/room3d/scene.ts` | Renderer, input, animation and lifecycle |
| `app/lib/room3d/models.ts` | Original furniture geometry and materials |
| `app/lib/room3d/navigation.ts` | Pure pathfinding and collision checks |
| `public/room3d/ATTRIBUTION.md` | Character source, pinned mirror and license |
| `tests/room3d.test.mjs` | Path, placement and bundled-animation contracts |

Canvas `data-fps`, `data-draw-calls`, and `data-triangles` expose lightweight local
diagnostics; these do not send telemetry. FPS must be measured on actual target
devices before setting a release target. Browser viewport emulation is not device
performance testing.

## Required before product integration

1. Approve the visual direction, then create a consistent final humanoid rig,
   skin/face/hair/clothing assets and authored turn/start/stop/sit/stand clips.
   The legacy SVG customization options do not yet control this 3D character.
2. Replace approximate AABB footprints and procedural seat transitions where
   needed, add robust foot IK/contact alignment and authored furniture actions.
   Bed sleep, simulation needs, autonomous behavior and multiplayer are absent.
3. Profile real iOS/Android devices; batch static geometry, use LODs/compressed
   assets and define a reduced-quality fallback. The native app is unchanged.
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

- Character: [Quaternius Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html), CC0.
- [Three.js animation system](https://threejs.org/manual/en/animation-system.html).
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
