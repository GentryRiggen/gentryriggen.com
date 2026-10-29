import { readFileSync } from "node:fs";

/** The parts of a glb's JSON chunk the checks read. */
export interface GltfJson {
  nodes: {
    name?: string;
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes: {
    name?: string;
    primitives: { attributes: Record<string, number> }[];
  }[];
  accessors: {
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    min?: number[];
    max?: number[];
  }[];
  bufferViews: {
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }[];
}

export interface GlbFile {
  json: GltfJson;
  /** The BIN chunk. */
  bin: Buffer;
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const FLOAT = 5126;

/** Reads a binary glTF file's JSON and BIN chunks (Node, for tests). */
export function readGlb(path: string): GlbFile {
  const data = readFileSync(path);
  if (data.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path}: not a glb`);
  const jsonLength = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== JSON_CHUNK) {
    throw new Error(`${path}: first chunk is not JSON`);
  }
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength;
  const binLength = binStart < data.length ? data.readUInt32LE(binStart) : 0;
  const bin = data.subarray(binStart + 8, binStart + 8 + binLength);
  return { json, bin };
}

/** A mesh's vertex positions as [x, y, z] triples (tightly packed floats). */
export function meshPositions(glb: GlbFile, meshName: string): number[][] {
  const mesh = glb.json.meshes.find((m) => m.name === meshName);
  if (!mesh) throw new Error(`no mesh "${meshName}"`);
  const points: number[][] = [];
  for (const primitive of mesh.primitives) {
    const accessor = glb.json.accessors[primitive.attributes.POSITION];
    if (accessor.componentType !== FLOAT || accessor.type !== "VEC3") {
      throw new Error(`mesh "${meshName}": POSITION is not float VEC3`);
    }
    const view = glb.json.bufferViews[accessor.bufferView ?? 0];
    const stride = view.byteStride ?? 12;
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i++) {
      const at = start + i * stride;
      points.push([
        glb.bin.readFloatLE(at),
        glb.bin.readFloatLE(at + 4),
        glb.bin.readFloatLE(at + 8),
      ]);
    }
  }
  return points;
}
