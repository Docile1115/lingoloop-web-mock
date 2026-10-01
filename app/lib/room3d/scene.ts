import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  CATALOG,
  INITIAL_FURNITURE,
  footprint,
  furniture,
  materials,
  pictureTexture,
  shell,
  type Furnishing,
  type Kind,
} from "./models";
import { distance, findPath, placementFree, smoothRoute, type Point } from "./navigation";

type Hooks = {
  ready: () => void;
  error: (kind: "webgl" | "model") => void;
  select: (item: Furnishing | null) => void;
  open: (item: Furnishing) => void;
  status: (status: "idle" | "walking" | "sitting" | "blocked" | "editing") => void;
  layout: (items: Furnishing[]) => void;
};
type Item = { data: Furnishing; model: T.Group };
const Y_AXIS = new T.Vector3(0, 1, 0);
/** Planted-foot speed of the bundled Walk clip in armature units per second (measured from casual.gltf). */
const WALK_CLIP_SPEED = 1.1;
const CRUISE_SPEED = 1.25;
const DECELERATION = 2.4;
const TURN_RATE = 7;
const HOME_CAMERA = new T.Vector3(8.6, 7.1, 10.8);
const HOME_TARGET = new T.Vector3(0, 0.7, -0.15);
function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    mats = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((node) => {
    if (node instanceof T.Mesh || node instanceof T.Line || node instanceof T.Points) {
      geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        mats.add(mat);
        for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
/** A self-contained, client-only rendering prototype. It never calls production APIs. */
export class RoomScene3D {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(42, 1, 0.1, 100);
  private renderer: T.WebGLRenderer;
  private controls: OrbitControls;
  private resize: ResizeObserver;
  private mat: ReturnType<typeof materials>;
  private items: Item[] = [];
  private person = new T.Group();
  private model: T.Group | null = null;
  private mixer: T.AnimationMixer | null = null;
  private actions = new Map<string, T.AnimationAction>();
  private currentAction: T.AnimationAction | null = null;
  private route: Point[] = [];
  private destination: string | null = null;
  private speed = 0;
  private editing = false;
  private selected: string | null = null;
  private disposed = false;
  private raf = 0;
  private previousTime = 0;
  private lastStatus = "";
  private ray = new T.Raycaster();
  private mouse = new T.Vector2();
  private plane = new T.Plane(Y_AXIS, 0);
  private floorPoint = new T.Vector3();
  private pointer: {
    id: number;
    x: number;
    y: number;
    item: Item | null;
    original: Point;
    offset: Point;
    moved: boolean;
  } | null = null;
  private marker = new T.Mesh(
    new T.RingGeometry(0.12, 0.16, 48),
    new T.MeshBasicMaterial({
      color: "#487c5d",
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.8,
    }),
  );
  private outline = new T.LineLoop(new T.BufferGeometry(), new T.LineBasicMaterial({ color: "#548460" }));
  private grid = new T.GridHelper(8.4, 42, "#7a9a85", "#bbd0be");
  private seated: Item | null = null;
  private sitBlend = 0;
  private sitOrigin: Point = { x: 0, z: 2.2 };
  private leavingSeat = false;
  private queuedTarget: Point | string | null = null;
  private oneShot = false;
  private env: T.WebGLRenderTarget;
  private locked = false;
  /** Ground speed at which the Walk clip's feet do not slide; set once the model is scaled. */
  private walkGroundSpeed = WALK_CLIP_SPEED;
  private heading = new T.Quaternion();
  private markerAge = 0;
  private hoverId: string | null = null;
  private hoverPoint: { x: number; y: number } | null = null;
  private zoomGoal: number | null = null;
  private cameraGoal: { position: T.Vector3; target: T.Vector3 } | null = null;
  setLocked(value: boolean) {
    this.locked = value;
    if (value) this.cancel();
    this.controls.enabled = !value;
  }
  private canPlace(data: Furnishing) {
    const box = footprint(data);
    return placementFree(box, this.boxes(), this.person.position) && placementFree(box, this.boxes(), { x: 0, z: 2.2 });
  }
  constructor(
    private host: HTMLDivElement,
    private hooks: Hooks,
    private options: { items?: Furnishing[]; editable?: boolean } = {},
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, host.clientWidth < 700 ? 1.5 : 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "3D room");
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.addEventListener("webglcontextlost", this.contextLost);
    this.scene.background = new T.Color("#e8e5db");
    this.scene.fog = new T.Fog("#e8e5db", 25, 55);
    const environment = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(environment, 0.02);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.42;
    disposeObject(environment);
    pmrem.dispose();
    this.mat = materials();
    this.scene.add(shell(this.mat));
    const ground = new T.Mesh(
      new T.PlaneGeometry(200, 200),
      new T.MeshStandardMaterial({ color: "#e8e5db", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.29;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(new T.HemisphereLight("#e7eeff", "#ac956f", 1.5));
    const sun = new T.DirectionalLight("#fff2d7", 4.2);
    sun.position.set(-3, 8, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -7,
      right: 7,
      top: 7,
      bottom: -7,
      near: 0.1,
      far: 25,
    });
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const fill = new T.DirectionalLight("#dce9ff", 0.7);
    fill.position.set(6, 4, -3);
    this.scene.add(fill);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, -0.15);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = 1.3;
    this.controls.minPolarAngle = 0.4;
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 17;
    this.controls.minAzimuthAngle = -0.05;
    this.controls.maxAzimuthAngle = 1.45;
    this.controls.enablePan = false;
    this.controls.mouseButtons.LEFT = undefined;
    this.controls.mouseButtons.RIGHT = T.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = T.MOUSE.DOLLY;
    this.controls.touches.ONE = T.TOUCH.ROTATE;
    this.controls.touches.TWO = T.TOUCH.DOLLY_PAN;
    // A user drag always wins over an animated zoom or reset.
    this.controls.addEventListener("start", this.stopCameraMotion);
    this.camera.position.copy(HOME_CAMERA);
    this.controls.target.copy(HOME_TARGET);
    this.controls.update();
    this.person.position.set(0, 0, 2.2);
    this.scene.add(this.person);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.065;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.outline.position.y = 0.065;
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.grid.position.y = 0.045;
    this.grid.scale.z = 0.8;
    this.grid.visible = false;
    this.scene.add(this.grid);
    for (const data of options.items ?? INITIAL_FURNITURE) this.createItem({ ...data });
    this.publishLayout();
    this.renderer.domElement.addEventListener("pointerdown", this.down);
    this.renderer.domElement.addEventListener("pointermove", this.move);
    this.renderer.domElement.addEventListener("pointerup", this.up);
    this.renderer.domElement.addEventListener("pointercancel", this.cancel);
    this.renderer.domElement.addEventListener("pointerleave", this.leave);
    this.renderer.domElement.addEventListener("contextmenu", this.contextMenu);
    this.resize = new ResizeObserver(() => {
      if (this.disposed) return;
      const width = host.clientWidth,
        height = host.clientHeight;
      if (!width || !height) return;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.fov = T.MathUtils.radToDeg(
        2 * Math.atan(Math.tan(T.MathUtils.degToRad(21)) * Math.max(1, 1.12 / this.camera.aspect)),
      );
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    this.raf = requestAnimationFrame(this.frame);
    void this.loadPerson();
  }
  private contextMenu = (event: Event) => event.preventDefault();
  private stopCameraMotion = () => {
    this.zoomGoal = null;
    this.cameraGoal = null;
  };
  private leave = () => {
    this.hoverPoint = null;
    this.hoverId = null;
    this.renderer.domElement.style.cursor = "";
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.hooks.error("webgl");
  };
  private publishLayout() {
    this.hooks.layout(this.items.map((item) => ({ ...item.data })));
    if (this.editing) this.status("editing");
  }
  private status(value: Parameters<Hooks["status"]>[0]) {
    if (value !== this.lastStatus) {
      this.lastStatus = value;
      this.hooks.status(value);
    }
  }
  private boxes() {
    return [
      ...this.items.map((item) => footprint(item.data)),
      { id: "fixed-lamp", x: 0.54, z: -1.75, halfX: 0.23, halfZ: 0.23 },
    ];
  }
  private createItem(data: Furnishing) {
    const model = furniture(data.kind, this.mat);
    model.position.set(data.x, 0, data.z);
    model.rotation.y = data.rotation;
    model.userData.itemId = data.id;
    this.scene.add(model);
    this.items.push({ data, model });
  }
  private async loadPerson() {
    try {
      const gltf = await new GLTFLoader().loadAsync("/room3d/casual.gltf");
      if (this.disposed) {
        disposeObject(gltf.scene);
        return;
      }
      this.model = gltf.scene;
      const bounds = new T.Box3().setFromObject(this.model),
        size = bounds.getSize(new T.Vector3()),
        scale = 1.72 / size.y;
      this.model.scale.setScalar(scale);
      this.model.position.y = -bounds.min.y * scale;
      this.walkGroundSpeed = WALK_CLIP_SPEED * scale;
      this.model.traverse((node) => {
        if (node instanceof T.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = false;
          for (const mat of Array.isArray(node.material) ? node.material : [node.material])
            if (mat instanceof T.MeshStandardMaterial) {
              mat.roughness = 0.86;
              mat.metalness = 0;
            }
        }
      });
      this.person.add(this.model);
      this.mixer = new T.AnimationMixer(this.model);
      for (const clip of gltf.animations) {
        if (!["Idle", "Walk", "Wave", "Interact"].includes(clip.name)) continue;
        const cleaned = clip.clone();
        for (const track of cleaned.tracks) {
          if (/^(Body|Root)\.position$/.test(track.name))
            for (let i = 0; i < track.values.length; i += 3) {
              track.values[i] = track.values[0];
              track.values[i + 2] = track.values[2];
            }
        }
        this.actions.set(clip.name, this.mixer.clipAction(cleaned));
      }
      this.play("Idle");
      this.mixer.update(0);
      this.hooks.ready();
      this.status("idle");
    } catch {
      if (!this.disposed) this.hooks.error("model");
    }
  }
  private play(name: string, once = false) {
    const action = this.actions.get(name);
    if (!action || this.currentAction === action) return;
    const before = this.currentAction;
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    action.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.play();
    if (before) before.crossFadeTo(action, 0.24, false);
    this.currentAction = action;
    this.oneShot = once;
  }
  private setRay(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.mouse, this.camera);
  }
  private hitItem() {
    for (const hit of this.ray.intersectObjects(
      this.items.map((item) => item.model),
      true,
    )) {
      let node: T.Object3D | null = hit.object;
      while (node) {
        if (node.userData.itemId) return this.items.find((item) => item.data.id === node!.userData.itemId) || null;
        node = node.parent;
      }
    }
    return null;
  }
  private down = (event: PointerEvent) => {
    if (this.locked || event.button !== 0 || !event.isPrimary || !this.model) return;
    this.setRay(event);
    const item = this.hitItem();
    this.ray.ray.intersectPlane(this.plane, this.floorPoint);
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      item,
      original: { x: item?.data.x || 0, z: item?.data.z || 0 },
      offset: {
        x: (item?.data.x || 0) - this.floorPoint.x,
        z: (item?.data.z || 0) - this.floorPoint.z,
      },
      moved: false,
    };
    if (this.editing && item) {
      this.select(item.data.id);
      this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture(event.pointerId);
    }
  };
  private move = (event: PointerEvent) => {
    const p = this.pointer;
    if (!p) {
      // Hover is resolved once per frame; raycasting every pointer event is wasted work.
      if (event.pointerType === "mouse") this.hoverPoint = { x: event.clientX, y: event.clientY };
      return;
    }
    if (p.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - p.x, event.clientY - p.y) > 5) p.moved = true;
    if (!this.editing || !p.item || !p.moved) return;
    this.renderer.domElement.style.cursor = "grabbing";
    this.setRay(event);
    if (!this.ray.ray.intersectPlane(this.plane, this.floorPoint)) return;
    const next = {
      ...p.item.data,
      x: Math.round((this.floorPoint.x + p.offset.x) * 20) / 20,
      z: Math.round((this.floorPoint.z + p.offset.z) * 20) / 20,
    };
    p.item.model.position.set(next.x, 0, next.z);
    this.drawOutline(next, this.canPlace(next));
  };
  private up = (event: PointerEvent) => {
    const p = this.pointer;
    if (!p || p.id !== event.pointerId) return;
    this.pointer = null;
    this.controls.enabled = !this.locked;
    if (event.pointerType === "mouse") this.hoverPoint = { x: event.clientX, y: event.clientY };
    if (this.renderer.domElement.hasPointerCapture(event.pointerId))
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (this.editing) {
      if (p.item) {
        const next = {
          ...p.item.data,
          x: p.item.model.position.x,
          z: p.item.model.position.z,
        };
        if (this.canPlace(next)) {
          p.item.data = next;
          this.publishLayout();
          this.hooks.select(next);
        } else {
          p.item.model.position.set(p.original.x, 0, p.original.z);
          this.status("blocked");
        }
        this.drawOutline(p.item.data, true);
      }
      return;
    }
    if (p.moved) return;
    this.setRay(event);
    if (p.item) this.go(p.item.data.id);
    else if (this.ray.ray.intersectPlane(this.plane, this.floorPoint))
      this.go({ x: this.floorPoint.x, z: this.floorPoint.z });
  };
  private cancel = () => {
    if (this.pointer?.item) {
      this.pointer.item.model.position.set(this.pointer.original.x, 0, this.pointer.original.z);
      this.drawOutline(this.pointer.item.data, true);
    }
    this.pointer = null;
    this.controls.enabled = true;
  };
  private drawOutline(data: Furnishing, valid: boolean) {
    const { halfX, halfZ } = footprint(data);
    const points = [
      [-halfX, -halfZ],
      [halfX, -halfZ],
      [halfX, halfZ],
      [-halfX, halfZ],
    ].map(([x, z]) => new T.Vector3(data.x + x, 0, data.z + z));
    this.outline.geometry.dispose();
    this.outline.geometry = new T.BufferGeometry().setFromPoints(points);
    (this.outline.material as T.LineBasicMaterial).color.set(valid ? "#508665" : "#c05b44");
    this.outline.visible = true;
  }
  select(id: string | null) {
    this.selected = id;
    const item = this.items.find((item) => item.data.id === id);
    this.hooks.select(item?.data || null);
    if (item) this.drawOutline(item.data, true);
    else this.outline.visible = false;
  }
  /** Walks to a floor point or beside a piece of furniture. Returns false when no route exists. */
  go(target: Point | string): boolean {
    if (!this.model || this.editing || this.locked) return false;
    this.facing = null;
    if (this.seated) {
      this.queuedTarget = target;
      this.leavingSeat = true;
      return true;
    }
    this.route = [];
    this.destination = null;
    this.marker.visible = false;
    this.select(null);
    const start = { x: this.person.position.x, z: this.person.position.z };
    let route: Point[] | null = null;
    if (typeof target === "string") {
      const item = this.items.find((item) => item.data.id === target);
      if (!item) return false;
      const d = CATALOG[item.data.kind];
      const candidates: Point[] = [];
      for (const [x, z] of [
        [0, d.depth / 2 + 0.45],
        [d.width / 2 + 0.45, 0],
        [-d.width / 2 - 0.45, 0],
        [0, -d.depth / 2 - 0.45],
      ]) {
        if (item.data.kind === "sofa" && candidates.length) break;
        const c = Math.cos(item.data.rotation),
          s = Math.sin(item.data.rotation);
        candidates.push({
          x: item.data.x + x * c + z * s,
          z: item.data.z + z * c - x * s,
        });
      }
      const routes = candidates
        .map((point) => findPath(start, point, this.boxes()))
        .filter((path): path is Point[] => path !== null);
      routes.sort(
        (a, b) =>
          a.reduce((sum, p, i) => sum + distance(i ? a[i - 1] : start, p), 0) -
          b.reduce((sum, p, i) => sum + distance(i ? b[i - 1] : start, p), 0),
      );
      route = routes[0] ?? null;
      if (route) this.destination = target;
    } else route = findPath(start, target, this.boxes());
    if (route === null) {
      this.speed = 0;
      this.play("Idle");
      this.status("blocked");
      return false;
    }
    this.route = smoothRoute(start, route, this.boxes());
    if (route.length) {
      const end = route.at(-1)!;
      this.marker.position.set(end.x, 0.065, end.z);
      this.marker.visible = true;
      this.markerAge = 0;
      this.status("walking");
    } else this.arrive();
    return true;
  }
  /** The point `lookahead` metres further along the remaining route. */
  private pointAhead(lookahead: number): Point {
    let from: Point = { x: this.person.position.x, z: this.person.position.z },
      left = lookahead;
    for (const point of this.route) {
      const d = distance(from, point);
      if (d >= left) return { x: from.x + ((point.x - from.x) * left) / d, z: from.z + ((point.z - from.z) * left) / d };
      left -= d;
      from = point;
    }
    return from;
  }
  private remainingDistance() {
    let from: Point = { x: this.person.position.x, z: this.person.position.z },
      total = 0;
    for (const point of this.route) {
      total += distance(from, point);
      from = point;
    }
    return total;
  }
  /** Moves exactly along the route, carrying leftover distance past waypoints so speed never dips at them. */
  private advance(step: number) {
    const position = this.person.position;
    while (step > 0 && this.route.length) {
      const target = this.route[0],
        dx = target.x - position.x,
        dz = target.z - position.z,
        d = Math.hypot(dx, dz);
      if (d <= step) {
        position.x = target.x;
        position.z = target.z;
        step -= d;
        this.route.shift();
      } else {
        position.x += (dx / d) * step;
        position.z += (dz / d) * step;
        step = 0;
      }
    }
  }
  private facing: T.Quaternion | null = null;
  private arrive() {
    this.marker.visible = false;
    this.speed = 0;
    this.play("Idle");
    this.status("idle");
    if (this.destination) {
      const item = this.items.find((item) => item.data.id === this.destination);
      this.destination = null;
      if (!item) return;
      this.select(item.data.id);
      const angle = Math.atan2(item.data.x - this.person.position.x, item.data.z - this.person.position.z);
      this.facing = new T.Quaternion().setFromAxisAngle(Y_AXIS, angle);
      if (item.data.kind === "frame" || item.data.kind === "board") {
        this.play("Interact", true);
        this.hooks.open(item.data);
      }
    }
  }
  setEditing(value: boolean) {
    if (this.locked || (value && this.options.editable === false)) return false;
    if (this.seated) {
      this.leavingSeat = true;
      return false;
    }
    this.cancel();
    this.editing = value;
    this.route = [];
    this.speed = 0;
    this.marker.visible = false;
    this.grid.visible = value;
    this.play("Idle");
    this.select(null);
    this.status(value ? "editing" : "idle");
    return true;
  }
  add(kind: Kind) {
    if (!this.editing || this.locked) return false;
    const slot =
      kind === "frame"
        ? ["frame", "frame2", "frame3"].find((id) => !this.items.some((item) => item.data.id === id))
        : kind === "board"
          ? this.items.some((item) => item.data.kind === "board")
            ? undefined
            : "whiteboard"
          : crypto.randomUUID();
    if (this.items.length >= 16 || !slot) {
      this.status("blocked");
      return false;
    }
    for (let z = 2.5; z >= -3; z -= 0.35)
      for (let x = -3.4; x <= 3.5; x += 0.35) {
        const data = { id: slot, kind, x, z, rotation: 0 };
        if (this.canPlace(data)) {
          this.createItem(data);
          this.select(data.id);
          this.publishLayout();
          return true;
        }
      }
    this.status("blocked");
    return false;
  }
  rotate() {
    const item = this.items.find((item) => item.data.id === this.selected);
    if (!item || !this.editing || this.locked) return;
    // Same [0, 2π) range the server stores, so a saved layout compares equal to the one on screen.
    const next = { ...item.data, rotation: (((item.data.rotation + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) };
    if (!this.canPlace(next)) {
      this.status("blocked");
      return;
    }
    item.data = next;
    item.model.rotation.y = next.rotation;
    this.drawOutline(next, true);
    this.hooks.select(next);
    this.publishLayout();
  }
  remove() {
    const item = this.items.find((item) => item.data.id === this.selected);
    if (!item || !this.editing || this.locked) return;
    this.scene.remove(item.model);
    /* Shared materials stay alive until the renderer is disposed. */ item.model.traverse((node) => {
      if (node instanceof T.Mesh) {
        node.geometry.dispose();
        if (node.name === "picture") {
          node.material.map?.dispose();
          node.material.dispose();
        }
      }
    });
    this.items = this.items.filter((row) => row !== item);
    this.select(null);
    this.publishLayout();
  }
  action() {
    if (this.seated) {
      this.stand();
      return;
    }
    const item = this.items.find((item) => item.data.id === this.selected);
    if (!item || this.editing || this.route.length) return;
    if (item.data.kind === "frame" || item.data.kind === "board") {
      this.hooks.open(item.data);
      return;
    }
    if (item.data.kind === "sofa" || item.data.kind === "chair") {
      this.seated = item;
      this.sitOrigin = { x: this.person.position.x, z: this.person.position.z };
      this.sitBlend = 0;
      this.leavingSeat = false;
      this.play("Idle");
      this.status("sitting");
    } else {
      this.play("Interact", true);
    }
  }
  stand() {
    this.leavingSeat = true;
  }
  wave() {
    if (!this.route.length && !this.seated && !this.editing) this.play("Wave", true);
  }
  /** Glides back to the default view instead of jumping. */
  resetCamera() {
    this.zoomGoal = null;
    this.cameraGoal = { position: HOME_CAMERA.clone(), target: HOME_TARGET.clone() };
  }
  zoom(factor: number) {
    this.cameraGoal = null;
    const current = this.zoomGoal ?? this.camera.position.distanceTo(this.controls.target);
    this.zoomGoal = T.MathUtils.clamp(current * factor, this.controls.minDistance, this.controls.maxDistance);
  }
  private moveCamera(dt: number) {
    const blend = 1 - Math.exp(-9 * dt);
    if (this.cameraGoal) {
      this.camera.position.lerp(this.cameraGoal.position, blend);
      this.controls.target.lerp(this.cameraGoal.target, blend);
      if (
        this.camera.position.distanceTo(this.cameraGoal.position) < 0.01 &&
        this.controls.target.distanceTo(this.cameraGoal.target) < 0.01
      )
        this.cameraGoal = null;
    }
    if (this.zoomGoal !== null) {
      const offset = this.camera.position.clone().sub(this.controls.target),
        length = T.MathUtils.lerp(offset.length(), this.zoomGoal, blend);
      this.camera.position.copy(this.controls.target).add(offset.setLength(length));
      if (Math.abs(length - this.zoomGoal) < 0.01) this.zoomGoal = null;
    }
  }
  /** Mouse hover: pointer cursor and a small lift on furniture that reacts to a click. */
  private updateHover(dt: number) {
    if (this.hoverPoint && !this.pointer) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.set(
        ((this.hoverPoint.x - rect.left) / rect.width) * 2 - 1,
        (-(this.hoverPoint.y - rect.top) / rect.height) * 2 + 1,
      );
      this.ray.setFromCamera(this.mouse, this.camera);
      const item = this.locked ? null : this.hitItem();
      this.hoverId = item?.data.id ?? null;
      this.renderer.domElement.style.cursor = item ? (this.editing ? "grab" : "pointer") : "";
      this.hoverPoint = null;
    }
    for (const item of this.items) {
      const lifted = item.data.id === this.hoverId && !this.editing && !this.locked && !this.pointer;
      item.model.scale.setScalar(T.MathUtils.damp(item.model.scale.x, lifted ? 1.035 : 1, 14, dt));
    }
  }
  async photo(id: string, url: string) {
    const ticket = (this.photoTickets.get(id) || 0) + 1;
    this.photoTickets.set(id, ticket);
    const item = this.items.find((row) => row.data.id === id);
    if (!item || item.data.kind !== "frame") return;
    const texture = await new T.TextureLoader().loadAsync(url);
    if (this.disposed || !this.items.includes(item) || this.photoTickets.get(id) !== ticket) {
      texture.dispose();
      return;
    }
    const image = item.model.getObjectByName("picture") as T.Mesh<T.PlaneGeometry, T.MeshStandardMaterial>;
    // Fit the whole image inside the actual frame ratio instead of stretching it.
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = Math.round((768 * image.geometry.parameters.height) / image.geometry.parameters.width);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f3efe5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const source = texture.image as HTMLImageElement;
    const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
    context.drawImage(
      source,
      (canvas.width - source.width * scale) / 2,
      (canvas.height - source.height * scale) / 2,
      source.width * scale,
      source.height * scale,
    );
    texture.dispose();
    const fitted = new T.CanvasTexture(canvas);
    fitted.colorSpace = T.SRGBColorSpace;
    image.material.map?.dispose();
    image.material.map = fitted;
    image.material.needsUpdate = true;
  }
  private photoTickets = new Map<string, number>();
  resetPhoto(id: string) {
    this.photoTickets.set(id, (this.photoTickets.get(id) || 0) + 1);
    const item = this.items.find((row) => row.data.id === id);
    if (!item || item.data.kind !== "frame") return;
    const image = item.model.getObjectByName("picture") as T.Mesh<T.PlaneGeometry, T.MeshStandardMaterial>;
    image.material.map?.dispose();
    image.material.map = pictureTexture();
    image.material.needsUpdate = true;
  }
  notes(id: string, notes: string[]) {
    const item = this.items.find((row) => row.data.id === id);
    if (!item || item.data.kind !== "board") return;
    const image = item.model.getObjectByName("picture") as T.Mesh<T.PlaneGeometry, T.MeshStandardMaterial>;
    image.material.map?.dispose();
    image.material.map = pictureTexture(true, notes);
    image.material.needsUpdate = true;
  }
  private aim(bone: T.Object3D, target: T.Vector3, blend: number) {
    const child = bone.children.find((node) => node instanceof T.Bone);
    if (!child || !bone.parent) return;
    const original = bone.quaternion.clone(),
      from = bone.getWorldPosition(new T.Vector3()),
      direction = child.getWorldPosition(new T.Vector3()).sub(from).normalize(),
      desired = target.clone().sub(from).normalize();
    const delta = new T.Quaternion().setFromUnitVectors(direction, desired),
      world = bone.getWorldQuaternion(new T.Quaternion()),
      parent = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(delta.multiply(world)));
    bone.quaternion.slerpQuaternions(original, bone.quaternion.clone(), blend);
    bone.updateMatrixWorld(true);
  }
  private seat(dt: number) {
    if (!this.seated || !this.model) return;
    this.sitBlend = T.MathUtils.clamp(this.sitBlend + (this.leavingSeat ? -1 : 1) * dt * 2, 0, 1);
    const b = this.sitBlend * this.sitBlend * (3 - 2 * this.sitBlend),
      data = this.seated.data,
      forward = new T.Vector3(Math.sin(data.rotation), 0, Math.cos(data.rotation));
    this.person.position.set(
      T.MathUtils.lerp(this.sitOrigin.x, data.x + forward.x * 0.05, b),
      0,
      T.MathUtils.lerp(this.sitOrigin.z, data.z + forward.z * 0.05, b),
    );
    this.person.quaternion.rotateTowards(new T.Quaternion().setFromAxisAngle(Y_AXIS, data.rotation), dt * 6);
    this.person.updateMatrixWorld(true);
    const upperL = this.model.getObjectByName("UpperLegL"),
      upperR = this.model.getObjectByName("UpperLegR");
    if (upperL && upperR) {
      const hipY = (upperL.getWorldPosition(new T.Vector3()).y + upperR.getWorldPosition(new T.Vector3()).y) / 2;
      const height = data.kind === "sofa" ? 0.69 : 0.6;
      this.person.position.y = (height - hipY) * b;
      this.person.updateMatrixWorld(true);
      for (const side of ["L", "R"]) {
        const upper = this.model.getObjectByName("UpperLeg" + side),
          lower = this.model.getObjectByName("LowerLeg" + side);
        if (!upper || !lower) continue;
        const hip = upper.getWorldPosition(new T.Vector3()),
          knee = hip.clone().addScaledVector(forward, 0.44);
        knee.y = height - 0.035;
        this.aim(upper, knee, b);
        const ankle = hip.clone().addScaledVector(forward, 0.46);
        ankle.y = 0.12;
        this.aim(lower, ankle, b);
      }
      // Rest the hands on the thighs; arms hanging straight through the seat looked broken.
      for (const side of ["L", "R"]) {
        const upperArm = this.model.getObjectByName("UpperArm" + side),
          lowerArm = this.model.getObjectByName("LowerArm" + side),
          thigh = this.model.getObjectByName("UpperLeg" + side);
        if (!upperArm || !lowerArm || !thigh) continue;
        const shoulder = upperArm.getWorldPosition(new T.Vector3()),
          hip = thigh.getWorldPosition(new T.Vector3());
        const elbow = shoulder.clone().addScaledVector(forward, 0.1);
        elbow.y -= 0.24;
        this.aim(upperArm, elbow, b);
        const hand = hip.clone().addScaledVector(forward, 0.3);
        hand.y = height + 0.13;
        this.aim(lowerArm, hand, b);
      }
    }
    if (this.leavingSeat && this.sitBlend === 0) {
      this.seated = null;
      this.leavingSeat = false;
      this.person.position.y = 0;
      this.status("idle");
      const target = this.queuedTarget;
      this.queuedTarget = null;
      if (target) this.go(target);
    }
  }
  private diagnosticTime = 0;
  private diagnosticFrames = 0;
  private frame = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min((time - this.previousTime) / 1000 || 0.016, 0.05);
    this.previousTime = time;
    if (this.route.length && !this.seated) {
      // Steer toward a point slightly ahead on the path so turns begin before corners.
      const ahead = this.pointAhead(0.4),
        dx = ahead.x - this.person.position.x,
        dz = ahead.z - this.person.position.z;
      if (Math.hypot(dx, dz) > 0.05) this.heading.setFromAxisAngle(Y_AXIS, Math.atan2(dx, dz));
      this.person.quaternion.rotateTowards(this.heading, dt * TURN_RATE);
      // Turn (almost) in place before setting off in a very different direction,
      // then ease to a stop at the destination instead of halting abruptly.
      const misalignment = this.person.quaternion.angleTo(this.heading),
        alignment = T.MathUtils.clamp(1 - (misalignment - 0.45) / 1.1, 0, 1),
        remaining = this.remainingDistance(),
        desired = Math.max(Math.min(CRUISE_SPEED, Math.sqrt(2 * DECELERATION * remaining)), 0.15) * alignment;
      this.speed = T.MathUtils.damp(this.speed, desired, 7, dt);
      this.advance(this.speed * dt);
      this.play("Walk");
      // Match the stride to the ground speed so the feet do not slide.
      this.actions
        .get("Walk")
        ?.setEffectiveTimeScale(T.MathUtils.clamp(this.speed / this.walkGroundSpeed, 0.55, 1.6));
      if (!this.route.length) this.arrive();
    }
    if (this.marker.visible) {
      this.markerAge += dt;
      const grow = Math.min(1, this.markerAge / 0.22);
      this.marker.scale.setScalar(0.55 + 0.45 * (1 - (1 - grow) ** 3));
      (this.marker.material as T.MeshBasicMaterial).opacity = 0.5 + 0.3 * Math.cos(this.markerAge * 5);
    }
    if (this.facing && !this.route.length && !this.seated) this.person.quaternion.rotateTowards(this.facing, dt * 4);
    this.mixer?.update(dt);
    if (this.oneShot && this.currentAction && !this.currentAction.isRunning()) {
      this.oneShot = false;
      this.play("Idle");
    }
    this.seat(dt);
    this.updateHover(dt);
    this.moveCamera(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.diagnosticFrames++;
    if (time - this.diagnosticTime > 1000) {
      this.renderer.domElement.dataset.fps = String(
        Math.round((this.diagnosticFrames * 1000) / (time - this.diagnosticTime)),
      );
      this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
      this.renderer.domElement.dataset.triangles = String(this.renderer.info.render.triangles);
      this.diagnosticFrames = 0;
      this.diagnosticTime = time;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls.dispose();
    this.mixer?.stopAllAction();
    if (this.model) this.mixer?.uncacheRoot(this.model);
    for (const [type, listener] of [
      ["pointerdown", this.down],
      ["pointermove", this.move],
      ["pointerup", this.up],
      ["pointercancel", this.cancel],
      ["pointerleave", this.leave],
      ["contextmenu", this.contextMenu],
      ["webglcontextlost", this.contextLost],
    ] as const)
      this.renderer.domElement.removeEventListener(type, listener as EventListener);
    this.controls.removeEventListener("start", this.stopCameraMotion);
    disposeObject(this.scene);
    this.mat.woodMap.dispose();
    this.mat.weave.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
