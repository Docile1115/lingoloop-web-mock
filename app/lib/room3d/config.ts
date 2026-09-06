/** Platform-neutral wire types: native clients must not pull in the web renderer. */
export type Kind = "sofa" | "table" | "desk" | "chair" | "shelf" | "plant" | "frame" | "board" | "bed";
export type Furnishing = { id: string; kind: Kind; x: number; z: number; rotation: number };
export type Room3DConfig = { version: 1; items: Furnishing[] };
