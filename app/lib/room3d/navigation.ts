export type Point = { x: number; z: number };
export type Obstacle = Point & { halfX: number; halfZ: number; id: string };
export const ROOM_BOUNDS = { minX: -4.35, maxX: 4.35, minZ: -3.35, maxZ: 3.35 };
export const PERSON_RADIUS = 0.25;
const STEP = 0.2;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function free(
  point: Point,
  obstacles: readonly Obstacle[],
  radius = PERSON_RADIUS,
) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.z) &&
    point.x >= ROOM_BOUNDS.minX + radius &&
    point.x <= ROOM_BOUNDS.maxX - radius &&
    point.z >= ROOM_BOUNDS.minZ + radius &&
    point.z <= ROOM_BOUNDS.maxZ - radius &&
    !obstacles.some(
      (box) =>
        Math.abs(point.x - box.x) < box.halfX + radius &&
        Math.abs(point.z - box.z) < box.halfZ + radius,
    )
  );
}
export function visible(a: Point, b: Point, obstacles: readonly Obstacle[]) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.06));
  for (let i = 0; i <= steps; i++)
    if (
      !free(
        {
          x: a.x + ((b.x - a.x) * i) / steps,
          z: a.z + ((b.z - a.z) * i) / steps,
        },
        obstacles,
      )
    )
      return false;
  return true;
}
/** Continuous endpoints, inflated footprints, A* and line-of-sight smoothing.
 * Pure geometry: rendering frame rate never changes navigation decisions. */
export function findPath(
  start: Point,
  end: Point,
  obstacles: readonly Obstacle[],
): Point[] | null {
  if (!free(start, obstacles) || !free(end, obstacles)) return null;
  if (visible(start, end, obstacles))
    return distance(start, end) < 0.015 ? [] : [end];
  const grid = (point: Point) => ({
    x: Math.round(point.x / STEP),
    z: Math.round(point.z / STEP),
  });
  const world = (point: Point) => ({ x: point.x * STEP, z: point.z * STEP });
  const key = (p: Point) => `${p.x},${p.z}`;
  const nearest = (point: Point) => {
    const c = grid(point);
    const candidates: Point[] = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const p = { x: c.x + dx, z: c.z + dz };
        if (visible(point, world(p), obstacles)) candidates.push(p);
      }
    return candidates.sort(
      (a, b) => distance(world(a), point) - distance(world(b), point),
    )[0];
  };
  const first = nearest(start),
    last = nearest(end);
  if (!first || !last) return null;
  const open = [first],
    cost = new Map([[key(first), 0]]),
    parents = new Map<string, Point>(),
    closed = new Set<string>();
  while (open.length) {
    open.sort(
      (a, b) =>
        cost.get(key(a))! +
        distance(a, last) -
        (cost.get(key(b))! + distance(b, last)),
    );
    const node = open.shift()!,
      nodeKey = key(node);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    if (nodeKey === key(last)) {
      const route: Point[] = [end];
      let cursor: Point | undefined = node;
      while (cursor) {
        route.unshift(world(cursor));
        cursor = parents.get(key(cursor));
      }
      route.unshift(start);
      const smooth: Point[] = [];
      let index = 0;
      while (index < route.length - 1) {
        let far = route.length - 1;
        while (far > index + 1 && !visible(route[index], route[far], obstacles))
          far--;
        smooth.push(route[far]);
        index = far;
      }
      return smooth;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const next = { x: node.x + dx, z: node.z + dz },
        nextKey = key(next);
      if (closed.has(nextKey) || !visible(world(node), world(next), obstacles))
        continue;
      const score = cost.get(nodeKey)! + Math.hypot(dx, dz);
      if (score < (cost.get(nextKey) ?? Infinity)) {
        cost.set(nextKey, score);
        parents.set(nextKey, node);
        open.push(next);
      }
    }
  }
  return null;
}
/**
 * Rounds the corners of a line-of-sight route so a walker turns while moving
 * instead of stopping at every waypoint. Each corner becomes a quadratic curve
 * from `radius` before the corner to `radius` after it; a corner stays sharp when
 * its curve would touch an obstacle. Straight parts are sub-segments of the
 * original (already visible) route, so the result never enters furniture.
 * Returns the points after `start`, ending exactly at the route's endpoint.
 */
export function smoothRoute(
  start: Point,
  route: readonly Point[],
  obstacles: readonly Obstacle[],
  radius = 0.55,
): Point[] {
  const points = [start, ...route];
  if (points.length < 3) return [...route];
  const result: Point[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1],
      corner = points[i],
      after = points[i + 1];
    const inLength = distance(before, corner),
      outLength = distance(corner, after),
      r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 0.03) {
      result.push(corner);
      continue;
    }
    const from = {
        x: corner.x + ((before.x - corner.x) * r) / inLength,
        z: corner.z + ((before.z - corner.z) * r) / inLength,
      },
      to = {
        x: corner.x + ((after.x - corner.x) * r) / outLength,
        z: corner.z + ((after.z - corner.z) * r) / outLength,
      };
    const curve: Point[] = [];
    for (let step = 0; step <= 8; step++) {
      const t = step / 8,
        a = (1 - t) * (1 - t),
        b = 2 * (1 - t) * t,
        c = t * t;
      curve.push({
        x: a * from.x + b * corner.x + c * to.x,
        z: a * from.z + b * corner.z + c * to.z,
      });
    }
    const clear = curve.every((point, index) => index === 0 || visible(curve[index - 1], point, obstacles));
    result.push(...(clear ? curve : [corner]));
  }
  result.push(points[points.length - 1]);
  return result;
}
export function placementFree(
  box: Obstacle,
  others: readonly Obstacle[],
  actor: Point,
) {
  return (
    box.x - box.halfX >= ROOM_BOUNDS.minX &&
    box.x + box.halfX <= ROOM_BOUNDS.maxX &&
    box.z - box.halfZ >= ROOM_BOUNDS.minZ &&
    box.z + box.halfZ <= ROOM_BOUNDS.maxZ &&
    !others.some(
      (other) =>
        other.id !== box.id &&
        Math.abs(box.x - other.x) < box.halfX + other.halfX + 0.05 &&
        Math.abs(box.z - other.z) < box.halfZ + other.halfZ + 0.05,
    ) &&
    !(
      Math.abs(box.x - actor.x) < box.halfX + PERSON_RADIUS &&
      Math.abs(box.z - actor.z) < box.halfZ + PERSON_RADIUS
    )
  );
}
