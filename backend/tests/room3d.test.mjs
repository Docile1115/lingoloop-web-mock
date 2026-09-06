import test from "node:test";
import assert from "node:assert/strict";
import { validateRoom3D } from "../room3d.mjs";
const room = (items = []) => ({ version: 1, items });
const item = (extra = {}) => ({ id: "whiteboard", kind: "board", x: -3, z: 0, rotation: 0, ...extra });
test("3D layout is versioned, bounded and strips no validation failures silently", () => {
  assert.deepEqual(validateRoom3D(room()), room());
  assert.ok(validateRoom3D(room([item({ rotation: -0.2 })])).items[0].rotation > 0);
  for (const value of [
    null,
    [],
    {},
    room(Array(17).fill(item())),
    { ...room(), ownerId: "someone" },
    room([item({ x: NaN })]),
    room([item({ z: Infinity })]),
    room([item({ x: 9 })]),
    room([item({ kind: "script" })]),
    room([item({ url: "https://invalid" })]),
    room([item({ id: "frame" })]),
  ])
    assert.throws(() => validateRoom3D(value));
});
test("3D layouts protect entry, fixed lighting, unique photo slots and collisions", () => {
  for (const items of [
    [item({ x: 0, z: 2.2 })],
    [item({ x: 0.54, z: -1.75 })],
    [item(), item()],
    [item({ id: "random", kind: "frame" })],
    [item({ id: "board" })],
  ])
    assert.throws(() => validateRoom3D(room(items)));
  const one = item({ id: "frame", kind: "frame" }),
    two = item({ id: "frame2", kind: "frame", x: 3 });
  assert.equal(validateRoom3D(room([one, two])).items.length, 2);
  assert.throws(() => validateRoom3D(room([one, { ...two, x: -3 }])));
});
